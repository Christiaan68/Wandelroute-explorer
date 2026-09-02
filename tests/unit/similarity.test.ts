import { describe, expect, it } from "vitest";
import { maxOverlapFraction, routeOverlapFraction } from "@/lib/routing/similarity";
import type { LngLat } from "@/lib/types";

const LINE_A: LngLat[] = [
  [5.0, 52.0],
  [5.005, 52.0],
  [5.01, 52.0],
  [5.015, 52.0],
];

// Zelfde lijn, ligt dus volledig over LINE_A.
const LINE_A_DUPLICATE: LngLat[] = [...LINE_A];

// Ver weg gelegen lijn: geen enkele overlap met LINE_A.
const LINE_FAR_AWAY: LngLat[] = [
  [6.5, 53.5],
  [6.505, 53.5],
  [6.51, 53.5],
];

describe("routeOverlapFraction", () => {
  it("geeft ~1 voor (bijna) identieke routes", () => {
    expect(routeOverlapFraction(LINE_A, LINE_A_DUPLICATE)).toBeGreaterThan(0.95);
  });

  it("geeft 0 voor routes die geografisch niets met elkaar te maken hebben", () => {
    expect(routeOverlapFraction(LINE_A, LINE_FAR_AWAY)).toBe(0);
  });

  it("detecteert gedeeltelijke overlap tussen 0 en 1", () => {
    // Eerste helft identiek aan LINE_A, tweede helft loopt een heel andere kant op.
    const partiallyShared: LngLat[] = [
      [5.0, 52.0],
      [5.005, 52.0],
      [5.01, 52.0],
      [5.01, 52.05],
      [5.01, 52.1],
    ];
    const overlap = routeOverlapFraction(partiallyShared, LINE_A);
    expect(overlap).toBeGreaterThan(0);
    expect(overlap).toBeLessThan(0.95);
  });
});

describe("maxOverlapFraction", () => {
  it("neemt de hoogste overlap uit een lijst eerdere routes", () => {
    const overlap = maxOverlapFraction(LINE_A, [LINE_FAR_AWAY, LINE_A_DUPLICATE]);
    expect(overlap).toBeGreaterThan(0.95);
  });

  it("geeft 0 als er geen eerdere routes zijn", () => {
    expect(maxOverlapFraction(LINE_A, [])).toBe(0);
  });
});
