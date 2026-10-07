import { describe, expect, it } from "vitest";
import { hasOutAndBackSpur, longestOutAndBackSpurMeters, MIN_SPUR_LENGTH_METERS } from "@/lib/routing/out-and-back";
import type { LngLat } from "@/lib/types";

const A: LngLat = [5.0, 52.0];
// ~100m ten oosten van A (op breedtegraad 52°).
const B: LngLat = [5.001459, 52.0];
// ~20m ten oosten van A — voor een kort, onschuldig "uitstapje".
const SHORT_SPUR_END: LngLat = [5.000292, 52.0];
// Verre, grote lus zonder enige relatie tot de lijn A-B (kilometers verderop).
const C: LngLat = [5.02, 52.02];
const D: LngLat = [5.03, 52.0];

describe("longestOutAndBackSpurMeters / hasOutAndBackSpur", () => {
  it("vindt geen heen-en-terug-stuk in een gewone lus zonder zijpaadje", () => {
    const geometry: LngLat[] = [A, C, D, A];
    expect(longestOutAndBackSpurMeters(geometry)).toBe(0);
    expect(hasOutAndBackSpur(geometry)).toBe(false);
  });

  it("herkent een duidelijk zijpad dat heen en weer over hetzelfde stuk gaat (zoals op het kaartje van Christiaan)", () => {
    // Loop eerst 100m heen en weer over exact dezelfde lijn (A -> B -> A),
    // en maak daarna pas de eigenlijke rondwandeling (A -> C -> D -> A), ver
    // weg van de zijpad-lijn.
    const geometry: LngLat[] = [A, B, A, C, D, A];
    const longest = longestOutAndBackSpurMeters(geometry);
    expect(longest).toBeGreaterThanOrEqual(MIN_SPUR_LENGTH_METERS);
    expect(hasOutAndBackSpur(geometry)).toBe(true);
  });

  it("wijst een kort, onschuldig uitstapje van maar ~20m niet af als heen-en-terug-stuk", () => {
    const geometry: LngLat[] = [A, SHORT_SPUR_END, A, C, D, A];
    expect(longestOutAndBackSpurMeters(geometry)).toBeLessThan(MIN_SPUR_LENGTH_METERS);
    expect(hasOutAndBackSpur(geometry)).toBe(false);
  });

  it("geeft 0 voor een te korte of te kleine geometrie om betrouwbaar te kunnen beoordelen", () => {
    expect(longestOutAndBackSpurMeters([A, B])).toBe(0);
    expect(longestOutAndBackSpurMeters([])).toBe(0);
  });
});
