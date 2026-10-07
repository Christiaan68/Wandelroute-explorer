import { describe, expect, it, vi } from "vitest";
import { generateRoute } from "@/lib/route-generation/engine";
import type { RoutingProvider } from "@/lib/routing/provider";
import type { LngLat, RouteCandidate } from "@/lib/types";
import * as trafficAvoidance from "@/lib/geo/traffic-avoidance";
import type { TrafficAvoidanceData } from "@/lib/geo/traffic-avoidance";

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
  avoidTrafficLights: false,
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
      generateDirections: vi.fn(async () => makeCandidate({ geometry: LINE_1 })),
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

describe("generateRoute — routingdienst niet bereikbaar", () => {
  it("stopt vroeg met reason 'provider_unavailable' als de routingdienst herhaaldelijk faalt, i.p.v. alle pogingen af te wachten", async () => {
    const provider: RoutingProvider = {
      name: "fake",
      generateRoundTrip: vi.fn(async () => {
        throw new Error("Kon geen verbinding maken met de routingdienst.");
      }),
      generateDirections: vi.fn(async () => makeCandidate({ geometry: LINE_1 })),
    };

    const result = await generateRoute({
      provider,
      params: BASE_PARAMS,
      rejectedGeometries: [],
      maxAttempts: 10,
    });

    expect(result.candidate).toBeNull();
    expect(result.reason).toBe("provider_unavailable");
    // Fail-fast: stopt na 3 opeenvolgende fouten, niet na alle 10 toegestane pogingen.
    expect(result.attemptsUsed).toBe(3);
    expect(provider.generateRoundTrip).toHaveBeenCalledTimes(3);
  });

  it("blijft bij 'no_alternatives' zolang de fouten van de routingdienst niet 3x op rij voorkomen (afgewisseld met verworpen kandidaten)", async () => {
    let calls = 0;
    const provider: RoutingProvider = {
      name: "fake",
      generateRoundTrip: vi.fn(async () => {
        calls++;
        // Oneven pogingen: een geslaagd antwoord dat alsnog wordt verworpen
        // (100% overlap met een eerder afgewezen route). Even pogingen: een
        // fout — nooit 3x op rij, dus de fail-fast mag niet aanslaan.
        if (calls % 2 === 1) return makeCandidate({ geometry: LINE_1, distanceMeters: 5000 });
        throw new Error("routingdienst gaf een fout");
      }),
      generateDirections: vi.fn(async () => makeCandidate({ geometry: LINE_1 })),
    };

    const result = await generateRoute({
      provider,
      params: BASE_PARAMS,
      rejectedGeometries: [LINE_1],
      maxAttempts: 4,
    });

    expect(result.candidate).toBeNull();
    expect(result.reason).toBe("no_alternatives");
    expect(result.attemptsUsed).toBe(4);
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
      generateDirections: vi.fn(async () => makeCandidate({ geometry: LINE_1 })),
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
      generateDirections: vi.fn(async () => makeCandidate({ geometry: LINE_2 })),
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

describe("generateRoute — heen-en-terug-stukken", () => {
  // Zelfde patroon als tests/unit/out-and-back.test.ts: 100m heen en weer over
  // exact dezelfde lijn, gevolgd door een gewone lus ver daarvandaan.
  const SPUR_GEOMETRY: LngLat[] = [
    [5.0, 52.0],
    [5.001459, 52.0],
    [5.0, 52.0],
    [5.02, 52.02],
    [5.03, 52.0],
    [5.0, 52.0],
  ];
  const CLEAN_GEOMETRY: LngLat[] = [
    [5.0, 52.0],
    [5.02, 52.02],
    [5.03, 52.0],
    [5.0, 52.0],
  ];

  it("verwerpt een kandidaat met een heen-en-terug-zijpad en accepteert de volgende, schone kandidaat", async () => {
    let calls = 0;
    const provider: RoutingProvider = {
      name: "fake",
      generateRoundTrip: vi.fn(async () => {
        calls++;
        return calls === 1
          ? makeCandidate({ geometry: SPUR_GEOMETRY, distanceMeters: 5000 })
          : makeCandidate({ geometry: CLEAN_GEOMETRY, distanceMeters: 5000 });
      }),
      generateDirections: vi.fn(async () => makeCandidate({ geometry: CLEAN_GEOMETRY })),
    };

    const result = await generateRoute({
      provider,
      params: BASE_PARAMS,
      rejectedGeometries: [],
      maxAttempts: 2,
    });

    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.geometry).toEqual(CLEAN_GEOMETRY);
    expect(result.attemptsUsed).toBe(2);
    expect(result.rejectionLog.length).toBe(1);
    expect(result.rejectionLog[0]).toMatch(/heen-en-terug/);
  });
});

describe("generateRoute — vermijd stoplichten en drukke oversteekplaatsen", () => {
  const EMPTY_DATA: TrafficAvoidanceData = { trafficLightPoints: [], busyRoadWays: [], dataComplete: true };

  function providerWithTwoDistinctCandidates(): RoutingProvider {
    let calls = 0;
    return {
      name: "fake",
      generateRoundTrip: vi.fn(async () => {
        calls++;
        // LINE_1 eerst (iets korter, dus normaal gesproken de beste afstandsmatch),
        // daarna LINE_2 (net iets verder van de gevraagde afstand af).
        return calls === 1
          ? makeCandidate({ geometry: LINE_1, distanceMeters: 4950, durationSeconds: 3600 })
          : makeCandidate({ geometry: LINE_2, distanceMeters: 5080, durationSeconds: 3700 });
      }),
      generateDirections: vi.fn(async () => makeCandidate({ geometry: LINE_1 })),
    };
  }

  it("kiest bij een vermijdbare route de kandidaat met minder stoplichten/oversteken, ook als die iets minder goed bij de afstand past", async () => {
    const fetchSpy = vi.spyOn(trafficAvoidance, "fetchTrafficAvoidanceData").mockResolvedValue(EMPTY_DATA);
    vi.spyOn(trafficAvoidance, "scoreRouteForTrafficAvoidance").mockImplementation((geometry) => {
      const isLine1 = geometry === LINE_1;
      return {
        trafficLightCount: isLine1 ? 3 : 0,
        majorRoadCrossingCount: isLine1 ? 2 : 0,
        dataComplete: true,
      };
    });

    const result = await generateRoute({
      provider: providerWithTwoDistinctCandidates(),
      params: { ...BASE_PARAMS, avoidTrafficLights: true },
      rejectedGeometries: [],
      maxAttempts: 2,
    });

    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.geometry).toEqual(LINE_2);
    expect(result.candidate!.trafficAvoidance).toEqual({
      requested: true,
      trafficLightCount: 0,
      majorRoadCrossingCount: 0,
      dataComplete: true,
      extraDistanceMeters: 130, // 5080 - 4950
      extraDurationSeconds: 100, // 3700 - 3600
    });

    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("kiest bij een onvermijdbare kruising alsnog de minst-slechte optie en rapporteert eerlijk hoeveel er overblijven", async () => {
    vi.spyOn(trafficAvoidance, "fetchTrafficAvoidanceData").mockResolvedValue(EMPTY_DATA);
    vi.spyOn(trafficAvoidance, "scoreRouteForTrafficAvoidance").mockImplementation((geometry) => {
      const isLine1 = geometry === LINE_1;
      // Geen van beide kandidaten is vrij van oversteken — LINE_1 heeft er wel minder.
      return {
        trafficLightCount: isLine1 ? 1 : 2,
        majorRoadCrossingCount: isLine1 ? 0 : 1,
        dataComplete: true,
      };
    });

    const result = await generateRoute({
      provider: providerWithTwoDistinctCandidates(),
      params: { ...BASE_PARAMS, avoidTrafficLights: true },
      rejectedGeometries: [],
      maxAttempts: 2,
    });

    expect(result.candidate).not.toBeNull();
    // LINE_1 wint ondanks dat LINE_2 normaliter de betere afstandsmatch heeft.
    expect(result.candidate!.geometry).toEqual(LINE_1);
    expect(result.candidate!.trafficAvoidance?.requested).toBe(true);
    expect(result.candidate!.trafficAvoidance?.trafficLightCount).toBe(1);
    expect(result.candidate!.trafficAvoidance?.majorRoadCrossingCount).toBe(0);
    expect(result.candidate!.trafficAvoidance?.dataComplete).toBe(true);

    vi.restoreAllMocks();
  });

  it("valt terug op de gewone afstandsscore en meldt onvolledige data als de OSM-gegevens niet opgehaald konden worden", async () => {
    vi.spyOn(trafficAvoidance, "fetchTrafficAvoidanceData").mockResolvedValue({
      trafficLightPoints: [],
      busyRoadWays: [],
      dataComplete: false,
    });
    vi.spyOn(trafficAvoidance, "scoreRouteForTrafficAvoidance").mockReturnValue({
      trafficLightCount: 0,
      majorRoadCrossingCount: 0,
      dataComplete: false,
    });

    const result = await generateRoute({
      provider: providerWithTwoDistinctCandidates(),
      params: { ...BASE_PARAMS, avoidTrafficLights: true },
      rejectedGeometries: [],
      maxAttempts: 2,
    });

    expect(result.candidate).not.toBeNull();
    // Zonder betrouwbare data verandert de keuze niet t.o.v. de gewone score (beste afstandsmatch: LINE_1).
    expect(result.candidate!.geometry).toEqual(LINE_1);
    expect(result.candidate!.trafficAvoidance).toEqual({
      requested: true,
      trafficLightCount: 0,
      majorRoadCrossingCount: 0,
      dataComplete: false,
      extraDistanceMeters: 0,
      extraDurationSeconds: 0,
    });

    vi.restoreAllMocks();
  });

  it("roept de OSM-databron niet aan als de voorkeur uit staat", async () => {
    const fetchSpy = vi.spyOn(trafficAvoidance, "fetchTrafficAvoidanceData");

    const result = await generateRoute({
      provider: providerWithTwoDistinctCandidates(),
      params: { ...BASE_PARAMS, avoidTrafficLights: false },
      rejectedGeometries: [],
      maxAttempts: 2,
    });

    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.trafficAvoidance).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
