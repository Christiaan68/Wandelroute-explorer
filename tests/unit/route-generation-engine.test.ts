import { describe, expect, it, vi } from "vitest";
import { generateRoute } from "@/lib/route-generation/engine";
import type { RoutingProvider } from "@/lib/routing/provider";
import type { LngLat, RouteCandidate } from "@/lib/types";

function makeCandidate(overrides: Partial<RouteCandidate> & { geometry: LngLat[] }): RouteCandidate {
  return {
    id: "test",
    distanceMeters: 5000,
    durationSeconds: 3600,
    instructions: [],
    surface: { pavedMeters: 0, unpavedMeters: overrides.distanceMeters ?? 5000, unknownMeters: 0 },
    elevation: null,
    generationSeed: 0,
    ...overrides,
  };
}

const BASE_PARAMS = {
  targetDistanceMeters: 5000,
  tolerance: 0.1 as const,
  start: { lat: 52.09, lng: 5.12 },
  surfacePreference: "unpaved" as const,
  startLabel: "Test",
};

const LINE_1: LngLat[] = [
  [5.0, 52.0],
  [5.01, 52.0],
  [5.02, 52.0],
];
const LINE_2: LngLat[] = [
  [6.0, 53.0],
  [6.01, 53.0],
  [6.02, 53.0],
];

describe("generateRoute — afstandscontrole", () => {
  it("verwerpt een kandidaat die te ver buiten de marge valt en accepteert de correctie die daarna binnen de marge komt", async () => {
    let calls = 0;
    const provider: RoutingProvider = {
      name: "fake",
      generateRoundTrip: vi.fn(async () => {
        calls++;
        if (calls === 1) {
          // 40% te kort -> ver buiten de 10%-marge.
          return makeCandidate({ geometry: LINE_1, distanceMeters: 3000 });
        }
        return makeCandidate({ geometry: LINE_2, distanceMeters: 5100 });
      }),
    };

    const result = await generateRoute({
      provider,
      params: BASE_PARAMS,
      rejectedGeometries: [],
      maxAttempts: 2,
    });

    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.distanceMeters).toBe(5100);
    expect(result.attemptsUsed).toBe(2);
    expect(result.rejectionLog.length).toBe(1);
  });
});

describe("generateRoute — duplicate-detectie", () => {
  it("geeft no_alternatives als elke kandidaat te veel overlapt met eerder afgewezen routes", async () => {
    const provider: RoutingProvider = {
      name: "fake",
      generateRoundTrip: vi.fn(async () =>
        // Altijd exact dezelfde geometrie -> 100% overlap met de "afgewezen" lijst.
        makeCandidate({ geometry: LINE_1, distanceMeters: 5000 }),
      ),
    };

    const result = await generateRoute({
      provider,
      params: BASE_PARAMS,
      rejectedGeometries: [LINE_1],
      maxAttempts: 3,
    });

    expect(result.candidate).toBeNull();
    expect(result.reason).toBe("no_alternatives");
    expect(result.attemptsUsed).toBe(3);
  });

  it("accepteert een kandidaat die voldoende afwijkt van eerder afgewezen routes", async () => {
    const provider: RoutingProvider = {
      name: "fake",
      generateRoundTrip: vi.fn(async () => makeCandidate({ geometry: LINE_2, distanceMeters: 5000 })),
    };

    const result = await generateRoute({
      provider,
      params: BASE_PARAMS,
      rejectedGeometries: [LINE_1],
      maxAttempts: 3,
    });

    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.geometry).toEqual(LINE_2);
  });
});
