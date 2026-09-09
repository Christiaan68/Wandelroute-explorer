import type { LngLat, RouteCandidate, RouteSearchParams, TrafficAvoidanceSummary } from "@/lib/types";
import type { RoutingProvider } from "@/lib/routing/provider";
import { maxOverlapFraction } from "@/lib/routing/similarity";
import {
  fetchTrafficAvoidanceData,
  scoreRouteForTrafficAvoidance,
  type TrafficAvoidanceScore,
} from "@/lib/geo/traffic-avoidance";

/**
 * Routegeneratie-engine: implementeert het stappenplan uit de opdracht bovenop
 * een willekeurige RoutingProvider.
 *
 *  1. Genereer een rondwandeling via de provider (die zelf tussenpunten rond
 *     het startpunt kiest, zie ORS "round_trip").
 *  2. Vergelijk de afstand met de gewenste afstand; val buiten de marge? Pas
 *     de gevraagde lengte aan (over- of ondercorrigeren) en probeer opnieuw.
 *  3. Val binnen de marge? Bereken de overlapscore t.o.v. reeds afgewezen/
 *     eerder getoonde routes; te veel overlap = duplicaat, probeer opnieuw
 *     met een andere seed/richting.
 *  4. Herhaal tot een pool van kandidaten is verzameld of het maximum aantal
 *     pogingen is bereikt.
 *  5. Sorteer de pool op afstandsafwijking, ondergrondvoorkeur-match en
 *     variatie (lage overlap) en geef de beste kandidaat terug.
 *
 * "Geen alternatieven meer" betekent hier expliciet: binnen MAX_ATTEMPTS
 * pogingen en de ingestelde afstandsmarge is geen voldoende verschillende
 * route gevonden — niet dat er wiskundig bewezen geen enkele route meer
 * bestaat (dat kan geen enkele routingdienst garanderen).
 *
 * Stap 5 (kandidaat kiezen) houdt ook rekening met de voorkeur "vermijd
 * stoplichten en drukke oversteekplaatsen" (params.avoidTrafficLights): dit
 * is de plek waar die voorkeur de ECHTE routekeuze beïnvloedt, niet alleen
 * een visuele indicatie. Zie het uitgebreide dossier in
 * src/lib/geo/traffic-avoidance.ts voor waarom dit via losse OSM-data en
 * scoring gebeurt in plaats van een openrouteservice-optie (die bestaat
 * niet).
 */

const DEFAULT_MAX_ATTEMPTS = 10;
const DESIRED_POOL_SIZE = 3;
/** Vanaf welke overlapfractie (0..1) een route als "grotendeels dezelfde route" geldt. */
const OVERLAP_REJECT_THRESHOLD = 0.55;
/** Extra "straf" per geschat stoplicht, als de voorkeur aan staat — zie scoreWithAvoidance. */
const TRAFFIC_LIGHT_PENALTY_WEIGHT = 1.5;
/** Extra "straf" per geschatte gelijkvloerse oversteek van een drukke weg — zwaarder dan een stoplicht, want een stoplicht biedt in elk geval een veilige oversteekplek. */
const MAJOR_ROAD_CROSSING_PENALTY_WEIGHT = 2.5;

export interface GenerateRouteOptions {
  provider: RoutingProvider;
  params: RouteSearchParams;
  /** Geometrieën van routes die de gebruiker al heeft afgewezen (of eerder geaccepteerd) in deze zoeksessie. */
  rejectedGeometries: LngLat[][];
  maxAttempts?: number;
}

export type NoRouteReason = "no_alternatives";

export interface GenerateRouteResult {
  candidate: RouteCandidate | null;
  attemptsUsed: number;
  reason?: NoRouteReason;
  /** Voor transparantie/debug: waarom kandidaten werden afgewezen. */
  rejectionLog: string[];
}

interface ScoredCandidate {
  candidate: RouteCandidate;
  deviation: number;
  overlap: number;
}

export async function generateRoute(options: GenerateRouteOptions): Promise<GenerateRouteResult> {
  const { provider, params, rejectedGeometries } = options;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const toleranceFraction = params.tolerance;

  const pool: ScoredCandidate[] = [];
  const rejectionLog: string[] = [];
  const seenGeometries: LngLat[][] = [...rejectedGeometries];

  // Start het ophalen van stoplicht-/drukke-weg-gegevens meteen, parallel aan
  // de kandidaten-generatie hieronder (die toch al op de routingdienst wacht)
  // — dit voorkomt dat de voorkeur de zoekopdracht onnodig vertraagt. Straal:
  // de helft van de gevraagde afstand, wat voor een rondwandeling van deze
  // lengte een redelijke inschatting is van hoe ver de route van het
  // startpunt af kan liggen.
  const trafficDataPromise = params.avoidTrafficLights
    ? fetchTrafficAvoidanceData(params.start, params.targetDistanceMeters / 2)
    : null;

  let requestedDistance = params.targetDistanceMeters;
  let attempt = 0;

  while (attempt < maxAttempts && pool.length < DESIRED_POOL_SIZE) {
    const seed = deterministicSeed(attempt);
    const bearing = (attempt * (360 / maxAttempts) + (attempt % 2 === 0 ? 0 : 25)) % 360;

    let candidate: RouteCandidate;
    try {
      candidate = await provider.generateRoundTrip({
        start: params.start,
        targetDistanceMeters: requestedDistance,
        seed,
        bearingDegrees: bearing,
        surfacePreference: params.surfacePreference,
      });
    } catch (err) {
      rejectionLog.push(`Poging ${attempt + 1}: routingdienst gaf een fout (${(err as Error).message}).`);
      attempt++;
      continue;
    }

    const deviation = Math.abs(candidate.distanceMeters - params.targetDistanceMeters) / params.targetDistanceMeters;

    if (deviation > toleranceFraction) {
      // Stap 4: pas de gevraagde afstand aan richting het doel voor de volgende poging.
      const correctionFactor = params.targetDistanceMeters / Math.max(candidate.distanceMeters, 1);
      requestedDistance = requestedDistance * correctionFactor;
      rejectionLog.push(
        `Poging ${attempt + 1}: ${Math.round(candidate.distanceMeters)}m ligt buiten de marge van ${Math.round(
          toleranceFraction * 100,
        )}% rond ${Math.round(params.targetDistanceMeters)}m.`,
      );
      attempt++;
      continue;
    }

    const overlap = maxOverlapFraction(candidate.geometry, seenGeometries);
    if (overlap > OVERLAP_REJECT_THRESHOLD) {
      rejectionLog.push(`Poging ${attempt + 1}: route overlapt ${Math.round(overlap * 100)}% met een eerdere route.`);
      attempt++;
      continue;
    }

    pool.push({ candidate, deviation, overlap });
    seenGeometries.push(candidate.geometry);
    attempt++;
  }

  if (pool.length === 0) {
    return { candidate: null, attemptsUsed: attempt, reason: "no_alternatives", rejectionLog };
  }

  // Kandidaat zonder de stoplicht-/oversteek-voorkeur — nodig om, als de
  // voorkeur wél aan staat, de "extra afstand/tijd" t.o.v. deze voorkeur te
  // kunnen tonen (zie TrafficAvoidanceSummary).
  const baselineBest = pool.reduce((bestSoFar, entry) =>
    score(entry, params) < score(bestSoFar, params) ? entry : bestSoFar,
  );

  if (!params.avoidTrafficLights || !trafficDataPromise) {
    return { candidate: baselineBest.candidate, attemptsUsed: attempt, rejectionLog };
  }

  const trafficData = await trafficDataPromise;
  const scoredForAvoidance = pool.map((entry) => ({
    entry,
    trafficScore: scoreRouteForTrafficAvoidance(entry.candidate.geometry, trafficData),
  }));
  const winner = scoredForAvoidance.reduce((bestSoFar, cur) =>
    scoreWithAvoidance(cur.entry, params, cur.trafficScore) <
    scoreWithAvoidance(bestSoFar.entry, params, bestSoFar.trafficScore)
      ? cur
      : bestSoFar,
  );

  const summary: TrafficAvoidanceSummary = {
    requested: true,
    trafficLightCount: winner.trafficScore.trafficLightCount,
    majorRoadCrossingCount: winner.trafficScore.majorRoadCrossingCount,
    dataComplete: winner.trafficScore.dataComplete,
    extraDistanceMeters: Math.max(0, Math.round(winner.entry.candidate.distanceMeters - baselineBest.candidate.distanceMeters)),
    extraDurationSeconds: Math.max(
      0,
      Math.round(winner.entry.candidate.durationSeconds - baselineBest.candidate.durationSeconds),
    ),
  };

  const finalCandidate: RouteCandidate = { ...winner.entry.candidate, trafficAvoidance: summary };
  return { candidate: finalCandidate, attemptsUsed: attempt, rejectionLog };
}

/**
 * Zelfde als `score()`, maar met een extra straf voor geschatte stoplichten
 * en gelijkvloerse drukke-weg-oversteken — gebruikt om, ALS de voorkeur aan
 * staat, binnen de al-geaccepteerde kandidatenpool (die al aan de
 * afstandsmarge voldoet) de route met de minste stoplichten/oversteken te
 * verkiezen boven een route die net iets beter bij afstand/ondergrond past.
 * Als de OSM-gegevens niet konden worden opgehaald, zijn alle tellingen 0 en
 * gedraagt dit zich identiek aan `score()` — er wordt dan dus nooit ten
 * onrechte gedaan alsof een route stoplichten/oversteken vermijdt.
 */
function scoreWithAvoidance(entry: ScoredCandidate, params: RouteSearchParams, trafficScore: TrafficAvoidanceScore): number {
  return (
    score(entry, params) +
    trafficScore.trafficLightCount * TRAFFIC_LIGHT_PENALTY_WEIGHT +
    trafficScore.majorRoadCrossingCount * MAJOR_ROAD_CROSSING_PENALTY_WEIGHT
  );
}

function score(entry: ScoredCandidate, params: RouteSearchParams): number {
  const total = entry.candidate.surface.pavedMeters + entry.candidate.surface.unpavedMeters + entry.candidate.surface.unknownMeters;
  const pavedFraction = total > 0 ? entry.candidate.surface.pavedMeters / total : 0.5;

  let surfaceMismatch: number;
  if (params.surfacePreference === "unpaved") surfaceMismatch = pavedFraction;
  else if (params.surfacePreference === "paved") surfaceMismatch = 1 - pavedFraction;
  else surfaceMismatch = Math.abs(pavedFraction - 0.5) * 2;

  // Gewichten: afstandsafwijking en ondergrondvoorkeur wegen het zwaarst, variatie (lage overlap) telt licht mee.
  return entry.deviation * 3 + surfaceMismatch * 2 + entry.overlap * 1;
}

function deterministicSeed(attempt: number): number {
  // 32-bit geheel getal, uniek genoeg binnen één zoeksessie zonder externe state bij te houden.
  const base = Date.now() % 100000;
  return base * 100 + attempt;
}
