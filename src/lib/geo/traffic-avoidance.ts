import type { Coordinate, LngLat } from "@/lib/types";
import { closestPointOnLine, destinationPoint, lngLatToCoord } from "@/lib/geo/distance";

/**
 * Ondersteunt de voorkeur "vermijd stoplichten en drukke oversteekplaatsen".
 *
 * BELANGRIJKE BEPERKING: openrouteservice (de routingdienst die deze app
 * gebruikt) heeft GEEN optie om stoplichten of drukke-weg-oversteken te
 * vermijden — de `avoid_features`-optie van de foot-walking-routering
 * ondersteunt alleen "ferries", "fords" en "steps" (bron:
 * https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options).
 * Er bestaat ook geen "alternative_routes"-optie in de ORS-API om uit
 * meerdere routes tussen twee punten te kiezen.
 *
 * Daarom werkt deze voorkeur op een andere manier: we halen zelf ruwe
 * OpenStreetMap-gegevens op (via de publieke Overpass-API) over
 * stoplicht-knopen en drukke/grote wegen in het gebied van de wandeling, en
 * gebruiken die om kandidaat-routes te SCOREN (zie route-generation/engine.ts)
 * — een route die minder stoplichten/oversteken bevat wint dan van een route
 * die er meer bevat, ook als die net iets minder goed bij de gevraagde
 * afstand past. Dit is dus een echte aanpassing van de routekeuze, niet
 * alleen een visuele indicatie.
 *
 * Belangrijke, bewuste beperkingen (zie ook README/gebruikersuitleg):
 * - We doorzoeken alleen een gebied rond het startpunt tot een maximale
 *   straal (zie MAX_QUERY_RADIUS_METERS). Bij lange wandelingen kan een deel
 *   van de route dus buiten het doorzochte gebied vallen.
 * - De routegeometrie van openrouteservice bevat geen brug/tunnel-informatie
 *   per coördinaat. Een voetgangersbrug of -tunnel over een drukke weg kan
 *   daardoor soms toch als een "gelijkvloerse kruising" meetellen.
 * - Wegcategorie/maximumsnelheid/rijstroken komen uit OpenStreetMap-tags;
 *   ontbrekende of onjuiste tags in het brongebied worden niet gedetecteerd.
 * Als de Overpass-aanvraag zelf mislukt (geen netwerk, timeout, overbelaste
 * server), geeft deze module `dataComplete: false` terug — de aanroepende
 * code MAG dan NOOIT beweren dat een route gegarandeerd vrij is van
 * stoplichten/drukke oversteken.
 */

export interface TrafficAvoidanceData {
  /** Knopen met stoplichten: kruispunten (highway=traffic_signals) en stoplicht-oversteekplaatsen (crossing=traffic_signals). */
  trafficLightPoints: LngLat[];
  /** Geometrieën van wegen die als "druk/groot" gelden (wegcategorie, maximumsnelheid of aantal rijstroken). */
  busyRoadWays: LngLat[][];
  /** false als de OSM-gegevens niet (volledig) opgehaald konden worden. */
  dataComplete: boolean;
}

export interface TrafficAvoidanceScore {
  /** Aantal stoplicht-gerelateerde punten die de route (naar schatting) passeert. */
  trafficLightCount: number;
  /** Aantal keer dat de route (naar schatting) gelijkvloers een drukke/grote weg kruist. */
  majorRoadCrossingCount: number;
  /** false als dit resultaat op onvolledige kaartgegevens is gebaseerd. */
  dataComplete: boolean;
}

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
/** Maximale straal (meters) rond het startpunt die wordt doorzocht — grotere aanvragen duren te lang/belasten de gratis Overpass-server te veel. */
const MAX_QUERY_RADIUS_METERS = 4000;
/** Een stoplicht-knoop binnen deze afstand (meters) van de route telt als "de route passeert dit stoplicht". */
const TRAFFIC_LIGHT_PROXIMITY_METERS = 15;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function boundingBoxString(center: Coordinate, radiusMeters: number): string {
  const north = destinationPoint(center, radiusMeters, 0).lat;
  const east = destinationPoint(center, radiusMeters, 90).lng;
  const south = destinationPoint(center, radiusMeters, 180).lat;
  const west = destinationPoint(center, radiusMeters, 270).lng;
  return `${south},${west},${north},${east}`;
}

/**
 * Haalt stoplicht-knopen en drukke-wegen-geometrieën op uit OpenStreetMap via
 * de publieke Overpass-API, voor een gebied rond `center`.
 */
export async function fetchTrafficAvoidanceData(
  center: Coordinate,
  desiredRadiusMeters: number,
): Promise<TrafficAvoidanceData> {
  const radius = Math.min(Math.max(desiredRadiusMeters, 500), MAX_QUERY_RADIUS_METERS);
  const bbox = boundingBoxString(center, radius);

  // Drie afzonderlijke way-clausules (unie): wegcategorie, maximumsnelheid of
  // aantal rijstroken — zoals gevraagd ("wegcategorie, maximumsnelheid en
  // aantal rijstroken"). Een way die aan meerdere clausules voldoet wordt
  // hieronder ontdubbeld op id.
  const query = `
[out:json][timeout:20];
(
  node["highway"="traffic_signals"](${bbox});
  node["crossing"="traffic_signals"](${bbox});
  way["highway"~"^(primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|trunk|trunk_link)$"](${bbox});
  way["highway"]["maxspeed"~"^(5[0-9]|[6-9][0-9]|1[0-9]{2})$"](${bbox});
  way["highway"]["lanes"~"^[2-9]$"](${bbox});
);
out geom;
`.trim();

  let json: OverpassResponse;
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { trafficLightPoints: [], busyRoadWays: [], dataComplete: false };
    }
    json = (await res.json().catch(() => null)) as OverpassResponse;
    if (!json || !Array.isArray(json.elements)) {
      return { trafficLightPoints: [], busyRoadWays: [], dataComplete: false };
    }
  } catch {
    // Netwerkfout, timeout, of overbelaste Overpass-server: onvolledige data,
    // nooit een verzonnen "geen stoplichten gevonden" resultaat teruggeven.
    return { trafficLightPoints: [], busyRoadWays: [], dataComplete: false };
  }

  const trafficLightPoints: LngLat[] = [];
  const busyRoadWays: LngLat[][] = [];
  const seenWayIds = new Set<number>();

  for (const el of json.elements) {
    if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
      trafficLightPoints.push([el.lon, el.lat]);
    } else if (el.type === "way" && el.geometry && el.geometry.length > 1) {
      if (seenWayIds.has(el.id)) continue;
      seenWayIds.add(el.id);
      busyRoadWays.push(el.geometry.map((g) => [g.lon, g.lat] as LngLat));
    }
  }

  return { trafficLightPoints, busyRoadWays, dataComplete: true };
}

/** Kruisproduct (b-a) x (c-a); teken geeft aan aan welke kant van lijn a-b punt c ligt. */
function cross(a: LngLat, b: LngLat, c: LngLat): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Standaard "properly intersect"-test voor twee lijnstukken (strikt: raken/overlappen aan een eindpunt telt niet mee). */
function segmentsIntersect(p1: LngLat, p2: LngLat, p3: LngLat, p4: LngLat): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function countSegmentIntersections(routeLine: LngLat[], wayLine: LngLat[]): number {
  let count = 0;
  for (let i = 0; i < routeLine.length - 1; i++) {
    for (let j = 0; j < wayLine.length - 1; j++) {
      if (segmentsIntersect(routeLine[i]!, routeLine[i + 1]!, wayLine[j]!, wayLine[j + 1]!)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Beoordeelt hoeveel stoplichten en gelijkvloerse drukke-weg-kruisingen een
 * routegeometrie (naar schatting) bevat, op basis van eerder opgehaalde
 * OSM-gegevens. Puur en zonder side-effects, dus los te testen.
 */
export function scoreRouteForTrafficAvoidance(
  routeGeometry: LngLat[],
  data: TrafficAvoidanceData,
): TrafficAvoidanceScore {
  let trafficLightCount = 0;
  if (routeGeometry.length > 0) {
    for (const point of data.trafficLightPoints) {
      const { distanceToLineMeters } = closestPointOnLine(lngLatToCoord(point), routeGeometry);
      if (distanceToLineMeters <= TRAFFIC_LIGHT_PROXIMITY_METERS) trafficLightCount++;
    }
  }

  let majorRoadCrossingCount = 0;
  for (const way of data.busyRoadWays) {
    majorRoadCrossingCount += countSegmentIntersections(routeGeometry, way);
  }

  return { trafficLightCount, majorRoadCrossingCount, dataComplete: data.dataComplete };
}

/** Straal (meters) van de vrijwaringszone rond een te vermijden stoplicht/oversteek. */
const DEFAULT_AVOID_BUFFER_METERS = 25;
/** ORS accepteert in de praktijk maar een beperkt aantal avoid_polygons per aanvraag betrouwbaar. */
const MAX_AVOID_POLYGONS = 10;
/** Alleen stoplichten/kruisingen die dicht bij de rechte lijn van-naar liggen zijn relevant om te vermijden. */
const RELEVANT_TO_DIRECT_LINE_METERS = 80;

export interface AvoidancePolygonOptions {
  bufferMeters?: number;
  maxPolygons?: number;
}

/** Bouwt een grove, gesloten veelhoek (ring) rond `center` met straal `radiusMeters`. */
function bufferPolygon(center: Coordinate, radiusMeters: number): LngLat[] {
  const ring: LngLat[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 / steps) * i;
    const p = destinationPoint(center, radiusMeters, bearing);
    ring.push([p.lng, p.lat]);
  }
  return ring;
}

/** Exact snijpunt van twee lijnstukken, of null als ze elkaar niet (strikt) snijden. */
function segmentIntersectionPoint(a1: LngLat, a2: LngLat, b1: LngLat, b2: LngLat): LngLat | null {
  if (!segmentsIntersect(a1, a2, b1, b2)) return null;
  const [x1, y1] = a1;
  const [x2, y2] = a2;
  const [x3, y3] = b1;
  const [x4, y4] = b2;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denom === 0) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/**
 * Bouwt vrijwaringszones rond stoplichten en gelijkvloerse kruisingen met
 * drukke wegen die dicht bij de rechte verbinding tussen `from` en `to`
 * liggen. Bedoeld om als `avoid_polygons` aan openrouteservice mee te geven
 * bij het herberekenen van een DIRECTE route (zie generateDirections in
 * ors-provider.ts): dit dwingt de routingdienst om, waar de kaartgegevens dat
 * mogelijk maken, een andere oversteek of kruising te zoeken — in
 * tegenstelling tot de rondwandeling-generatie is er hier geen kandidatenpool
 * om uit te kiezen, dus dit is de enige manier om de voorkeur daadwerkelijk
 * op de berekening zelf toe te passen.
 *
 * Bewust beperkt tot een klein aantal zones (MAX_AVOID_POLYGONS, dichtstbij
 * de rechte lijn eerst): te veel vrijwaringszones in één aanvraag maakt de
 * kans groot dat openrouteservice de aanvraag afwijst of helemaal geen route
 * meer kan vinden. De aanroepende code MOET terugvallen op de gewone route
 * als dit gebeurt (zie ors-provider.ts) — dit is dus altijd een "beste
 * poging", nooit een garantie.
 */
export function buildAvoidancePolygons(
  from: Coordinate,
  to: Coordinate,
  data: TrafficAvoidanceData,
  options: AvoidancePolygonOptions = {},
): LngLat[][] {
  const bufferMeters = options.bufferMeters ?? DEFAULT_AVOID_BUFFER_METERS;
  const maxPolygons = options.maxPolygons ?? MAX_AVOID_POLYGONS;
  const directLine: LngLat[] = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];

  const candidates: { point: Coordinate; distanceMeters: number }[] = [];

  for (const tl of data.trafficLightPoints) {
    const coord = lngLatToCoord(tl);
    const { distanceToLineMeters } = closestPointOnLine(coord, directLine);
    if (distanceToLineMeters <= RELEVANT_TO_DIRECT_LINE_METERS) {
      candidates.push({ point: coord, distanceMeters: distanceToLineMeters });
    }
  }

  for (const way of data.busyRoadWays) {
    for (let i = 0; i < way.length - 1; i++) {
      const hit = segmentIntersectionPoint(directLine[0]!, directLine[1]!, way[i]!, way[i + 1]!);
      if (hit) {
        candidates.push({ point: lngLatToCoord(hit), distanceMeters: 0 });
      }
    }
  }

  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return candidates.slice(0, maxPolygons).map((c) => bufferPolygon(c.point, bufferMeters));
}
