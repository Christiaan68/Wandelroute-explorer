import type { LngLat } from "@/lib/types";
import { bearingDegrees, cumulativeDistances, haversineDistanceMeters, lngLatToCoord, polylineLengthMeters } from "@/lib/geo/distance";

/**
 * Detecteert "heen-en-terug"-stukken BINNEN ÉÉN routegeometrie: een zijpad op
 * lopen en vervolgens over exact hetzelfde pad weer teruggaan (een "dead
 * end"-uitstapje), in plaats van door te lopen naar een ander deel van de
 * lus. Op de kaart zie je dit als twee lijnen die vlak over elkaar heen
 * liggen. Dit is een ander probleem dan src/lib/routing/similarity.ts, dat
 * twee VERSCHILLENDE routes met elkaar vergelijkt (om duplicaten binnen een
 * zoeksessie te herkennen) — hier vergelijken we één route met zichzelf.
 *
 * Net als bij het vermijden van stoplichten (src/lib/geo/traffic-avoidance.ts)
 * biedt openrouteservice's `round_trip`-optie geen parameter om dit te
 * voorkomen (alleen `length`, `points` en `seed`, zie ors-provider.ts) — dit
 * moet dus achteraf op de geometrie worden herkend.
 *
 * Werkwijze: de route wordt bemonsterd met een vaste tussenafstand. Voor elk
 * bemonsteringspunt wordt de lokale looprichting bepaald (koers naar het
 * volgende punt). Twee bemonsteringspunten die (a) fysiek dicht bij elkaar
 * liggen, (b) ver uit elkaar liggen in afgelegde afstand LANGS de route, en
 * (c) in nagenoeg tegengestelde richting worden belopen, zijn precies het
 * kenmerk van een heen-en-terug-stuk. We zoeken naar een aaneengesloten stuk
 * van voldoende lengte dat hieraan voldoet, zodat een kort moment waarop het
 * pad zichzelf bij een haarspeldbocht nadert niet onterecht wordt afgewezen.
 */

const SAMPLE_INTERVAL_METERS = 10;
/** Twee bemonsteringspunten gelden als "dezelfde plek op de kaart" binnen deze afstand. */
const MATCH_DISTANCE_METERS = 18;
/** Vanaf welk koersverschil (graden, 0-180) twee passages als "tegengesteld belopen" gelden. */
const OPPOSITE_BEARING_MIN_DEGREES = 150;
/**
 * Twee bemonsteringspunten moeten minstens dit ver uit elkaar liggen qua
 * afgelegde afstand langs de route — anders is het gewoon het omslagpunt zelf
 * van dezelfde scherpe bocht, belopen in één doorgaande richting. Bewust klein
 * gehouden (iets meer dan 1 bemonsteringsinterval): een eerdere, ruimere
 * waarde (40m) bleek ook kleine, maar nog duidelijk zichtbare zijpaadjes
 * (gemeld door Christiaan, ~20-30m) ten onrechte door te laten.
 */
const MIN_PATH_SEPARATION_METERS = 20;
/**
 * Pas vanaf een aaneengesloten stuk van deze lengte geldt het als een
 * storend heen-en-terug-uitstapje in plaats van ruis (bv. gps-/kaart-snap-
 * afwijkingen van een paar meter). Bewust laag gehouden — zie opmerking bij
 * MIN_PATH_SEPARATION_METERS hierboven.
 */
export const MIN_SPUR_LENGTH_METERS = 20;

interface Sample {
  point: LngLat;
  distanceAlongMeters: number;
  bearing: number;
}

/**
 * Lengte (in meters) van het langste aaneengesloten heen-en-terug-stuk in
 * deze routegeometrie. 0 betekent: geen (noemenswaardig) stuk gevonden.
 */
export function longestOutAndBackSpurMeters(geometry: LngLat[]): number {
  const totalLength = polylineLengthMeters(geometry);
  if (geometry.length < 4 || totalLength < MIN_PATH_SEPARATION_METERS * 2) return 0;

  const samples = sampleWithBearing(geometry, totalLength);
  if (samples.length < 2) return 0;

  const flagged = samples.map((sample, i) => isDoubledBack(sample, i, samples, totalLength));
  return longestFlaggedRunMeters(flagged, SAMPLE_INTERVAL_METERS);
}

/** Praktische ja/nee-check voor de route-generatie-engine: zit er een heen-en-terug-stuk in van minstens MIN_SPUR_LENGTH_METERS? */
export function hasOutAndBackSpur(geometry: LngLat[]): boolean {
  return longestOutAndBackSpurMeters(geometry) >= MIN_SPUR_LENGTH_METERS;
}

function isDoubledBack(sample: Sample, index: number, samples: Sample[], totalLength: number): boolean {
  for (let j = 0; j < samples.length; j++) {
    if (j === index) continue;
    const other = samples[j]!;

    const pathSeparation = loopPathSeparationMeters(sample.distanceAlongMeters, other.distanceAlongMeters, totalLength);
    if (pathSeparation < MIN_PATH_SEPARATION_METERS) continue;

    const spatialDistance = haversineDistanceMeters(lngLatToCoord(sample.point), lngLatToCoord(other.point));
    if (spatialDistance > MATCH_DISTANCE_METERS) continue;

    if (bearingDifferenceDegrees(sample.bearing, other.bearing) >= OPPOSITE_BEARING_MIN_DEGREES) return true;
  }
  return false;
}

/** Kortste afstand tussen twee posities langs een gesloten lus (houdt rekening met "rondlopen" via het start/eindpunt). */
function loopPathSeparationMeters(a: number, b: number, totalLength: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, totalLength - direct);
}

function bearingDifferenceDegrees(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function sampleWithBearing(line: LngLat[], totalLength: number): Sample[] {
  const cumDist = cumulativeDistances(line);
  const points: { point: LngLat; distanceAlongMeters: number }[] = [];

  let nextTarget = 0;
  for (let i = 0; i < line.length - 1 && nextTarget <= totalLength; ) {
    const segStart = cumDist[i]!;
    const segEnd = cumDist[i + 1]!;
    if (nextTarget > segEnd) {
      i++;
      continue;
    }
    const segLen = segEnd - segStart;
    const t = segLen === 0 ? 0 : (nextTarget - segStart) / segLen;
    const a = line[i]!;
    const b = line[i + 1]!;
    const point: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    points.push({ point, distanceAlongMeters: nextTarget });
    nextTarget += SAMPLE_INTERVAL_METERS;
  }

  // Koers per bemonsteringspunt: richting naar het volgende punt (het
  // laatste punt gebruikt, bij gebrek aan een "volgende", de koers vanaf het
  // voorlaatste punt).
  return points.map((p, i) => {
    let bearing: number;
    if (i + 1 < points.length) {
      bearing = bearingDegrees(lngLatToCoord(p.point), lngLatToCoord(points[i + 1]!.point));
    } else if (i > 0) {
      bearing = bearingDegrees(lngLatToCoord(points[i - 1]!.point), lngLatToCoord(p.point));
    } else {
      bearing = 0;
    }
    return { point: p.point, distanceAlongMeters: p.distanceAlongMeters, bearing };
  });
}

function longestFlaggedRunMeters(flagged: boolean[], intervalMeters: number): number {
  let longest = 0;
  let current = 0;
  for (const isFlagged of flagged) {
    if (isFlagged) {
      current += intervalMeters;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}
