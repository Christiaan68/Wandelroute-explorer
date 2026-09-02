import { describe, expect, it } from "vitest";
import { gpxFileName, walkToGpx } from "@/lib/gpx/export";
import type { WalkRecord } from "@/lib/types";

const WALK: WalkRecord = {
  id: "walk-gpx-1",
  date: "2026-06-01T09:00:00.000Z",
  startLabel: "Teststraat 1, Testdorp",
  start: { lat: 52.09, lng: 5.12 },
  plannedRoute: [
    [5.12, 52.09],
    [5.13, 52.1],
  ],
  actualTrack: [
    [5.12, 52.09],
    [5.121, 52.091],
    [5.13, 52.1],
  ],
  plannedDistanceMeters: 5000,
  actualDistanceMeters: 5050,
  durationSeconds: 3600,
  averageSpeedKmh: 5.0,
  surfacePreference: "unpaved",
  status: "completed",
  routeCandidate: {
    id: "candidate-1",
    geometry: [
      [5.12, 52.09],
      [5.13, 52.1],
    ],
    distanceMeters: 5000,
    durationSeconds: 3600,
    instructions: [],
    surface: { pavedMeters: 0, unpavedMeters: 5000, unknownMeters: 0 },
    elevation: null,
    generationSeed: 1,
  },
};

describe("walkToGpx", () => {
  it("produceert geldige GPX met de geplande route en het gelopen traject", () => {
    const gpx = walkToGpx(WALK);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("Geplande route");
    expect(gpx).toContain("Daadwerkelijk gelopen traject");
    // 2 trkpt voor geplande route + 3 voor traject
    const trkptCount = (gpx.match(/<trkpt/g) ?? []).length;
    expect(trkptCount).toBe(5);
    expect(gpx).toContain('lat="52.09"');
  });

  it("laat het traject-blok weg als er geen (of maar 1) gps-punt is geregistreerd", () => {
    const gpx = walkToGpx({ ...WALK, actualTrack: [] });
    expect(gpx).not.toContain("Daadwerkelijk gelopen traject");
  });
});

describe("gpxFileName", () => {
  it("bevat de datum en een deel van het id", () => {
    const name = gpxFileName(WALK);
    expect(name).toBe("wandeling-2026-06-01-walk-gpx.gpx");
  });
});
