import { describe, expect, it } from "vitest";
import { IndexedDbWalksRepository } from "@/lib/storage/walks-repository";
import type { WalkRecord } from "@/lib/types";

function buildWalk(id: string, overrides: Partial<WalkRecord> = {}): WalkRecord {
  return {
    id,
    date: new Date("2026-06-01T09:00:00.000Z").toISOString(),
    startLabel: "Teststraat 1",
    start: { lat: 52.09, lng: 5.12 },
    plannedRoute: [
      [5.12, 52.09],
      [5.13, 52.1],
    ],
    actualTrack: [
      [5.12, 52.09],
      [5.125, 52.095],
    ],
    plannedDistanceMeters: 5000,
    actualDistanceMeters: 5100,
    durationSeconds: 3600,
    averageSpeedKmh: 5.1,
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
    ...overrides,
  };
}

describe("IndexedDbWalksRepository (fake-indexeddb)", () => {
  it("slaat een wandeling op en haalt hem terug op via getById en getAll", async () => {
    const repo = new IndexedDbWalksRepository();
    const walk = buildWalk("walk-repo-test-1");

    await repo.save(walk);

    const byId = await repo.getById("walk-repo-test-1");
    expect(byId).toEqual(walk);

    const all = await repo.getAll();
    expect(all.some((w) => w.id === "walk-repo-test-1")).toBe(true);
  });

  it("sorteert getAll van nieuw naar oud op datum", async () => {
    const repo = new IndexedDbWalksRepository();
    const older = buildWalk("walk-repo-test-older", { date: new Date("2020-01-01").toISOString() });
    const newer = buildWalk("walk-repo-test-newer", { date: new Date("2030-01-01").toISOString() });
    await repo.save(older);
    await repo.save(newer);

    const all = await repo.getAll();
    const idxOlder = all.findIndex((w) => w.id === "walk-repo-test-older");
    const idxNewer = all.findIndex((w) => w.id === "walk-repo-test-newer");
    expect(idxNewer).toBeLessThan(idxOlder);
  });

  it("verwijdert een wandeling", async () => {
    const repo = new IndexedDbWalksRepository();
    const walk = buildWalk("walk-repo-test-remove");
    await repo.save(walk);
    expect(await repo.getById("walk-repo-test-remove")).toBeDefined();

    await repo.remove("walk-repo-test-remove");
    expect(await repo.getById("walk-repo-test-remove")).toBeUndefined();
  });
});
