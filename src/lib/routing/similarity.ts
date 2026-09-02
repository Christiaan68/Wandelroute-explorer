import type { LngLat } from "@/lib/types";
import { closestPointOnLine, haversineDistanceMeters, lngLatToCoord, polylineLengthMeters } from "@/lib/geo/distance";

/** Hoe dicht (in meters) twee routes bij elkaar moeten liggen om als "hetzelfde stuk pad" te tellen. */
const OVERLAP_DISTANCE_THRESHOLD_METERS = 25;
/** Steekproefinterval langs de kandidaat-route om overlap te bepalen. */
const SAMPLE_INTERVAL_METERS = 20;

/**
 * Schat hoeveel van `candidate` samenvalt met `existing`, als fractie 0..1.
 *
 * Aanpak: bemonster `candidate` op vaste afstanden, en check per steekproefpunt
 * of er ergens op `existing` een punt binnen OVERLAP_DISTANCE_THRESHOLD_METERS
 * ligt. De fractie steekproefpunten die "dekking" heeft, is de overlapscore.
 * Dit is een pragmatische benadering van geometrische lijn-overlap (i.p.v.
 * een volledige polygon-buffer-intersectie) die goed genoeg is om "loopt
 * grotendeels over dezelfde straten" te detecteren, en goedkoop genoeg om
 * tientallen keren per zoekopdracht te draaien.
 */
export function routeOverlapFraction(candidate: LngLat[], existing: LngLat[]): number {
  if (candidate.length < 2 || existing.length < 2) return 0;

  const samples = sampleAlongLine(candidate, SAMPLE_INTERVAL_METERS);
  if (samples.length === 0) return 0;

  let covered = 0;
  for (const sample of samples) {
    const closest = closestPointOnLine(sample, existing);
    if (closest.distanceToLineMeters <= OVERLAP_DISTANCE_THRESHOLD_METERS) {
      covered++;
    }
  }
  return covered / samples.length;
}

/** Hoogste overlapfractie van `candidate` t.o.v. een lijst eerder afgewezen/getoonde routes. */
export function maxOverlapFraction(candidate: LngLat[], others: LngLat[][]): number {
  let max = 0;
  for (const other of others) {
    const overlap = routeOverlapFraction(candidate, other);
    if (overlap > max) max = overlap;
    if (max >= 0.999) break;
  }
  return max;
}

function sampleAlongLine(line: LngLat[], intervalMeters: number) {
  const totalLength = polylineLengthMeters(line);
  const sampleCount = Math.max(1, Math.floor(totalLength / intervalMeters));
  const samples = [];
  for (let i = 0; i <= sampleCount; i++) {
    const targetDist = (i / sampleCount) * totalLength;
    samples.push(pointAtDistance(line, targetDist));
  }
  return samples;
}

function pointAtDistance(line: LngLat[], targetDistanceMeters: number) {
  let travelled = 0;
  for (let i = 1; i < line.length; i++) {
    const a = lngLatToCoord(line[i - 1]!);
    const b = lngLatToCoord(line[i]!);
    const segLen = haversineDistanceMeters(a, b);
    if (travelled + segLen >= targetDistanceMeters || i === line.length - 1) {
      const t = segLen === 0 ? 0 : Math.min(1, Math.max(0, (targetDistanceMeters - travelled) / segLen));
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    travelled += segLen;
  }
  return lngLatToCoord(line[line.length - 1]!);
}
