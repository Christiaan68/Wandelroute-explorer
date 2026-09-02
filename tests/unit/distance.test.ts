import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  closestPointOnLine,
  cumulativeDistances,
  destinationPoint,
  haversineDistanceMeters,
  polylineLengthMeters,
} from "@/lib/geo/distance";

describe("haversineDistanceMeters", () => {
  it("geeft 0 voor identiek punt", () => {
    const p = { lat: 52.09, lng: 5.12 };
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 5);
  });

  it("is symmetrisch", () => {
    const a = { lat: 52.09, lng: 5.12 };
    const b = { lat: 52.1, lng: 5.15 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 6);
  });

  it("komt overeen met destinationPoint (round-trip)", () => {
    const origin = { lat: 52.09, lng: 5.12 };
    const dest = destinationPoint(origin, 500, 90);
    expect(haversineDistanceMeters(origin, dest)).toBeCloseTo(500, 0);
  });
});

describe("bearingDegrees", () => {
  it("noord is 0 graden", () => {
    const a = { lat: 52.0, lng: 5.0 };
    const b = destinationPoint(a, 1000, 0);
    expect(bearingDegrees(a, b)).toBeCloseTo(0, 0);
  });

  it("oost is 90 graden", () => {
    const a = { lat: 52.0, lng: 5.0 };
    const b = destinationPoint(a, 1000, 90);
    expect(bearingDegrees(a, b)).toBeCloseTo(90, 0);
  });
});

describe("polylineLengthMeters / cumulativeDistances", () => {
  it("is monotoon stijgend en eindigt op de totale lengte", () => {
    const line: [number, number][] = [
      [5.0, 52.0],
      [5.001, 52.0],
      [5.001, 52.001],
      [5.002, 52.001],
    ];
    const cum = cumulativeDistances(line);
    expect(cum[0]).toBe(0);
    for (let i = 1; i < cum.length; i++) {
      expect(cum[i]!).toBeGreaterThanOrEqual(cum[i - 1]!);
    }
    expect(cum[cum.length - 1]).toBeCloseTo(polylineLengthMeters(line), 6);
  });
});

describe("closestPointOnLine", () => {
  it("vindt (bij benadering) het loodrecht geprojecteerde punt op een rechte lijn", () => {
    const line: [number, number][] = [
      [5.0, 52.0],
      [5.0, 52.01],
    ];
    // Punt iets oostelijk van het midden van de lijn.
    const off = { lat: 52.005, lng: 5.0005 };
    const result = closestPointOnLine(off, line);

    expect(result.point.lat).toBeCloseTo(52.005, 2);
    expect(result.point.lng).toBeCloseTo(5.0, 3);
    expect(result.distanceToLineMeters).toBeGreaterThan(0);
    expect(result.distanceAlongLineMeters).toBeGreaterThan(0);
    expect(result.distanceAlongLineMeters).toBeLessThan(polylineLengthMeters(line));
  });

  it("geeft ~0 afstand voor een punt dat exact op de lijn ligt", () => {
    const line: [number, number][] = [
      [5.0, 52.0],
      [5.01, 52.0],
      [5.02, 52.0],
    ];
    const onLine = { lat: 52.0, lng: 5.01 };
    const result = closestPointOnLine(onLine, line);
    expect(result.distanceToLineMeters).toBeCloseTo(0, 0);
  });

  describe("met searchWindow (rondwandelingen: start === eindpunt)", () => {
    // Vierkante lus van ~2,4 km, start en eindpunt zijn hetzelfde punt — net als een
    // door de routing-provider gegenereerde rondwandeling.
    const LOOP: [number, number][] = [
      [5.0, 52.0],
      [5.009, 52.0],
      [5.009, 52.0055],
      [5.0, 52.0055],
      [5.0, 52.0],
    ];
    const START = { lat: 52.0, lng: 5.0 };

    it("wijst een punt vlak bij start/eindpunt zonder venster toe aan het begin van de lijn", () => {
      // Zonder venster kan dit in theorie naar beide kanten omslaan; met de huidige
      // (eerst-gevonden-wint-bij-gelijke-afstand) implementatie hoort dit naar het begin
      // te gaan. Deze test legt dat gedrag vast zodat een regressie opvalt.
      const result = closestPointOnLine(START, LOOP);
      expect(result.distanceAlongLineMeters).toBeLessThan(50);
    });

    it("blijft bij het begin van de lus wanneer het venster rond 0 verankerd is", () => {
      const result = closestPointOnLine(START, LOOP, { anchorMeters: 0, maxJumpMeters: 200 });
      expect(result.distanceAlongLineMeters).toBeLessThan(50);
    });

    it("valt terug op een ongefilterde zoektocht als het venster geen goede match oplevert", () => {
      // Venster rond 1000m verankerd, maar het punt ligt in werkelijkheid bij het begin
      // (0m) — binnen dat venster is geen enkel segment fysiek dichtbij, dus dit moet
      // terugvallen op de volledige zoektocht en alsnog bij het begin uitkomen.
      const result = closestPointOnLine(START, LOOP, { anchorMeters: 1000, maxJumpMeters: 10 });
      expect(result.distanceAlongLineMeters).toBeLessThan(50);
    });
  });
});
