import type { LngLat, RouteCandidate, RouteSearchParams } from "@/lib/types";
import type { RoutingProvider } from "@/lib/routing/provider";
import { maxOverlapFraction } from "@/lib/routing/similarity";

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
 */

const DEFAULT_MAX_ATTEMPTS = 10;
const DESIRED_POOL_SIZE = 3;
/** Vanaf welke overlapfractie (0..1) een route als "grotendeels dezelfde route" geldt. */
const OVERLAP_REJECT_THRESHOLD = 0.55;

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

  const best = pool.sort((a, b) => score(a, params) - score(b, params))[0]!;
  return { candidate: best.candidate, attemptsUsed: attempt, rejectionLog };
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
