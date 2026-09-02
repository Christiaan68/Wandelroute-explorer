import type { Coordinate, LngLat } from "@/lib/types";

const EARTH_RADIUS_METERS = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Haversine-afstand in meters tussen twee coördinaten. */
export function haversineDistanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lngLatToCoord([lng, lat]: LngLat): Coordinate {
  return { lng, lat };
}

/** Initiële kompaskoers (0-360, 0 = noord) van a naar b. */
export function bearingDegrees(a: Coordinate, b: Coordinate): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Verplaats een coördinaat `distanceMeters` in de richting `bearing`. */
export function destinationPoint(origin: Coordinate, distanceMeters: number, bearing: number): Coordinate {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRad = toRad(bearing);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

/** Totale lengte van een polylijn in meters. */
export function polylineLengthMeters(line: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += haversineDistanceMeters(lngLatToCoord(line[i - 1]!), lngLatToCoord(line[i]!));
  }
  return total;
}

/** Cumulatieve afstand (meters) tot en met elk punt van de lijn; result[0] === 0. */
export function cumulativeDistances(line: LngLat[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < line.length; i++) {
    out.push(out[i - 1]! + haversineDistanceMeters(lngLatToCoord(line[i - 1]!), lngLatToCoord(line[i]!)));
  }
  return out;
}

export interface ClosestPointResult {
  /** Index van het segment (tussen segmentIndex en segmentIndex+1) waarop het dichtstbijzijnde punt ligt. */
  segmentIndex: number;
  /** Interpolatiefactor 0..1 langs dat segment. */
  t: number;
  point: Coordinate;
  distanceToLineMeters: number;
  /** Afstand langs de lijn vanaf het startpunt tot het geprojecteerde punt. */
  distanceAlongLineMeters: number;
}

export interface ClosestPointSearchWindow {
  /** Verwachte positie langs de lijn (meters vanaf het startpunt), gebaseerd op de vorige meting. */
  anchorMeters: number;
  /** Maximale afwijking t.o.v. anchorMeters die nog als plausibel geldt voor één gps-update. */
  maxJumpMeters: number;
}

/**
 * Projecteer `point` loodrecht op de polylijn `line` en geef het dichtstbijzijnde punt terug.
 * Gebruikt een lokale equirectangular-benadering (nauwkeurig genoeg over de korte afstanden
 * van een segment binnen een wandelroute) in plaats van zware sferische interpolatie.
 *
 * `searchWindow` beperkt de zoektocht (optioneel) tot segmenten rond een verwachte
 * positie langs de route. Dit is nodig voor rondwandelingen (start == eindpunt): zonder
 * venster kan een punt vlakbij het startpunt qua rechte-lijn-afstand even dicht (of
 * dichter, door gps-ruis) bij het SLUITENDE stuk van de lus liggen als bij het begin
 * ervan, waardoor "afstand langs de route" abrupt naar bijna-de-volledige-lengte kan
 * springen — met een valse aankomstmelding meteen bij vertrek tot gevolg. Als het venster
 * geen (goede) match oplevert, valt deze functie terug op een ongefilterde zoektocht over
 * de hele lijn, zodat een echte, grote afwijking (bv. na langdurig gps-signaalverlies) nog
 * steeds correct wordt gevonden.
 */
export function closestPointOnLine(
  point: Coordinate,
  line: LngLat[],
  searchWindow?: ClosestPointSearchWindow,
): ClosestPointResult {
  if (line.length === 0) {
    throw new Error("closestPointOnLine: lege lijn");
  }
  if (line.length === 1) {
    const only = lngLatToCoord(line[0]!);
    return {
      segmentIndex: 0,
      t: 0,
      point: only,
      distanceToLineMeters: haversineDistanceMeters(point, only),
      distanceAlongLineMeters: 0,
    };
  }

  const cumDist = cumulativeDistances(line);
  const cosLat = Math.cos(toRad(point.lat));

  // Lokale projectie: x = lng * cos(lat), y = lat -- schaal met EARTH_RADIUS voor meters.
  const project = (c: Coordinate) => ({
    x: toRad(c.lng) * cosLat * EARTH_RADIUS_METERS,
    y: toRad(c.lat) * EARTH_RADIUS_METERS,
  });

  const p = project(point);

  let best: ClosestPointResult | null = null;

  for (let i = 0; i < line.length - 1; i++) {
    if (searchWindow) {
      const segStartDist = cumDist[i]!;
      const segEndDist = cumDist[i + 1]!;
      const { anchorMeters, maxJumpMeters } = searchWindow;
      // Segment valt volledig buiten het venster rond de verwachte positie -> overslaan.
      if (segEndDist < anchorMeters - maxJumpMeters || segStartDist > anchorMeters + maxJumpMeters) {
        continue;
      }
    }

    const a = project(lngLatToCoord(line[i]!));
    const b = project(lngLatToCoord(line[i + 1]!));
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const segLenSq = abx * abx + aby * aby;

    let t = segLenSq === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / segLenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * abx;
    const projY = a.y + t * aby;
    const distMeters = Math.hypot(p.x - projX, p.y - projY);

    if (!best || distMeters < best.distanceToLineMeters) {
      const segStart = lngLatToCoord(line[i]!);
      const segEnd = lngLatToCoord(line[i + 1]!);
      const interpolated: Coordinate = {
        lat: segStart.lat + (segEnd.lat - segStart.lat) * t,
        lng: segStart.lng + (segEnd.lng - segStart.lng) * t,
      };
      const segLenMeters = cumDist[i + 1]! - cumDist[i]!;
      best = {
        segmentIndex: i,
        t,
        point: interpolated,
        distanceToLineMeters: distMeters,
        distanceAlongLineMeters: cumDist[i]! + t * segLenMeters,
      };
    }
  }

  if (searchWindow && (!best || best.distanceToLineMeters > searchWindow.maxJumpMeters)) {
    // Binnen het venster is niets (goeds) gevonden — bv. een grote gps-sprong voorbij wat
    // nog plausibel was, of langdurig signaalverlies. Val terug op de volledige, ongefilterde
    // zoektocht zodat de werkelijke positie op de route alsnog gevonden wordt.
    return closestPointOnLine(point, line);
  }

  return best!;
}
