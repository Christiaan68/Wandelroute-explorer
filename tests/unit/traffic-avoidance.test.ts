import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAvoidancePolygons,
  fetchTrafficAvoidanceData,
  scoreRouteForTrafficAvoidance,
  type TrafficAvoidanceData,
} from "@/lib/geo/traffic-avoidance";
import type { LngLat } from "@/lib/types";

// Rechte, korte "route" van west naar oost langs de evenaar op lat 52 —
// handig omdat afstanden hier eenvoudig te redeneren zijn.
const ROUTE: LngLat[] = [
  [5.0, 52.0],
  [5.01, 52.0],
  [5.02, 52.0],
];

describe("scoreRouteForTrafficAvoidance", () => {
  it("telt een stoplicht mee als het dicht bij de route ligt, en niet als het ver weg ligt", () => {
    const data: TrafficAvoidanceData = {
      trafficLightPoints: [
        [5.01, 52.0], // exact op de route -> telt mee
        [5.01, 52.05], // ~5,5 km weg -> telt niet mee
      ],
      busyRoadWays: [],
      dataComplete: true,
    };

    const score = scoreRouteForTrafficAvoidance(ROUTE, data);
    expect(score.trafficLightCount).toBe(1);
    expect(score.majorRoadCrossingCount).toBe(0);
    expect(score.dataComplete).toBe(true);
  });

  it("telt een gelijkvloerse kruising met een drukke weg die de route daadwerkelijk snijdt", () => {
    // Let op: bewust NIET bij lng 5.01 (dat is een routepunt/vertex van ROUTE
    // zelf) — een kruising exact op een vertex is een grensgeval voor de
    // strikte "properly intersect"-test en zou vals-negatief kunnen scoren.
    // Bij lng 5.015 ligt de kruising overduidelijk MIDDEN in een segment.
    const crossingWay: LngLat[] = [
      [5.015, 51.99],
      [5.015, 52.01],
    ]; // loodrecht door de route heen bij lng 5.015
    const parallelWay: LngLat[] = [
      [5.0, 52.02],
      [5.02, 52.02],
    ]; // loopt parallel aan de route, kruist 'm niet

    const data: TrafficAvoidanceData = {
      trafficLightPoints: [],
      busyRoadWays: [crossingWay, parallelWay],
      dataComplete: true,
    };

    const score = scoreRouteForTrafficAvoidance(ROUTE, data);
    expect(score.majorRoadCrossingCount).toBe(1);
  });

  it("geeft dataComplete: false door als de onderliggende data onvolledig was", () => {
    const data: TrafficAvoidanceData = { trafficLightPoints: [], busyRoadWays: [], dataComplete: false };
    const score = scoreRouteForTrafficAvoidance(ROUTE, data);
    expect(score.dataComplete).toBe(false);
    expect(score.trafficLightCount).toBe(0);
    expect(score.majorRoadCrossingCount).toBe(0);
  });
});

describe("buildAvoidancePolygons", () => {
  const from = { lat: 52.0, lng: 5.0 };
  const to = { lat: 52.0, lng: 5.02 };

  it("bouwt een vrijwaringszone rond een stoplicht dat dicht bij de rechte lijn ligt, en negeert een ver weg gelegen stoplicht", () => {
    const data: TrafficAvoidanceData = {
      trafficLightPoints: [
        [5.01, 52.0], // op de lijn
        [5.01, 53.0], // ~110 km weg
      ],
      busyRoadWays: [],
      dataComplete: true,
    };

    const polygons = buildAvoidancePolygons(from, to, data);
    expect(polygons.length).toBe(1);
    // Elke polygoon is een gesloten ring: eerste en laatste punt vallen (nagenoeg) samen.
    const ring = polygons[0]!;
    expect(ring[0]![0]).toBeCloseTo(ring[ring.length - 1]![0], 6);
    expect(ring[0]![1]).toBeCloseTo(ring[ring.length - 1]![1], 6);
  });

  it("bouwt een vrijwaringszone rond het snijpunt van een drukke weg met de rechte lijn", () => {
    const crossingWay: LngLat[] = [
      [5.01, 51.99],
      [5.01, 52.01],
    ];
    const data: TrafficAvoidanceData = { trafficLightPoints: [], busyRoadWays: [crossingWay], dataComplete: true };

    const polygons = buildAvoidancePolygons(from, to, data);
    expect(polygons.length).toBe(1);
  });

  it("beperkt het aantal zones tot maxPolygons, met voorrang voor de dichtstbijzijnde", () => {
    const manyLights: LngLat[] = Array.from({ length: 20 }, (_, i) => [5.001 + i * 0.0005, 52.0] as LngLat);
    const data: TrafficAvoidanceData = { trafficLightPoints: manyLights, busyRoadWays: [], dataComplete: true };

    const polygons = buildAvoidancePolygons(from, to, data, { maxPolygons: 5 });
    expect(polygons.length).toBe(5);
  });

  it("geeft geen zones terug als er niets relevants in de buurt van de route ligt", () => {
    const data: TrafficAvoidanceData = {
      trafficLightPoints: [[5.01, 53.0]],
      busyRoadWays: [],
      dataComplete: true,
    };
    expect(buildAvoidancePolygons(from, to, data)).toEqual([]);
  });
});

describe("fetchTrafficAvoidanceData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zet Overpass-knopen/wegen om naar stoplicht-punten en wegen-geometrieën", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        elements: [
          { type: "node", id: 1, lat: 52.0, lon: 5.01 },
          {
            type: "way",
            id: 2,
            geometry: [
              { lat: 51.99, lon: 5.01 },
              { lat: 52.01, lon: 5.01 },
            ],
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchTrafficAvoidanceData({ lat: 52.0, lng: 5.0 }, 1000);
    expect(data.dataComplete).toBe(true);
    expect(data.trafficLightPoints).toEqual([[5.01, 52.0]]);
    expect(data.busyRoadWays).toEqual([
      [
        [5.01, 51.99],
        [5.01, 52.01],
      ],
    ]);
  });

  it("geeft dataComplete: false terug bij een niet-ok HTTP-status (bv. overbelaste Overpass-server)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => null })),
    );

    const data = await fetchTrafficAvoidanceData({ lat: 52.0, lng: 5.0 }, 1000);
    expect(data.dataComplete).toBe(false);
    expect(data.trafficLightPoints).toEqual([]);
    expect(data.busyRoadWays).toEqual([]);
  });

  it("geeft dataComplete: false terug bij een netwerkfout/timeout, in plaats van te doen alsof er geen stoplichten zijn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error");
      }),
    );

    const data = await fetchTrafficAvoidanceData({ lat: 52.0, lng: 5.0 }, 1000);
    expect(data.dataComplete).toBe(false);
  });
});
