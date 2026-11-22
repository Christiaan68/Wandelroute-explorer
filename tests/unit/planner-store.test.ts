import { beforeEach, describe, expect, it } from "vitest";
import { usePlannerStore } from "@/lib/state/planner-store";
import type { LngLat, RouteCandidate } from "@/lib/types";

function candidate(id: string, geometry: LngLat[]): RouteCandidate {
  return {
    id,
    geometry,
    distanceMeters: 5000,
    durationSeconds: 3600,
    instructions: [],
    surface: { pavedMeters: 0, unpavedMeters: 5000, unknownMeters: 0 },
    elevation: null,
    generationSeed: 0,
  };
}

const PARAMS = {
  targetDistanceMeters: 5000,
  tolerance: 0.1 as const,
  start: { lat: 52.09, lng: 5.12 },
  surfacePreference: "unpaved" as const,
  startLabel: "Test",
  avoidTrafficLights: false,
};

describe("planner-store — terug naar de vorige route", () => {
  beforeEach(() => usePlannerStore.getState().reset());

  it("zet na een mislukte 'andere route' de vorige route terug en haalt die uit de afgewezen lijst", () => {
    const store = usePlannerStore.getState();
    const first = candidate("eerste", [
      [5.0, 52.0],
      [5.01, 52.0],
    ]);
    store.startSearch(PARAMS);
    store.setProposal(first);
    store.rejectCurrentAndSearchAgain();
    store.setNoAlternatives(10, "no_alternatives", { outsideDistanceMargin: 3, tooSimilar: 0, outAndBack: 7, providerError: 0 });

    let state = usePlannerStore.getState();
    expect(state.status).toBe("no_alternatives");
    expect(state.previousCandidate?.id).toBe("eerste");
    expect(state.rejectedGeometries).toHaveLength(1);
    expect(state.lastRejectionCounts?.outAndBack).toBe(7);

    state.restorePreviousCandidate();
    state = usePlannerStore.getState();
    expect(state.status).toBe("proposal");
    expect(state.currentCandidate?.id).toBe("eerste");
    expect(state.rejectedGeometries).toHaveLength(0);
    expect(state.previousCandidate).toBeNull();
  });

  it("vergeet de vorige route bij een nieuwe zoekopdracht", () => {
    const store = usePlannerStore.getState();
    store.startSearch(PARAMS);
    store.setProposal(candidate("eerste", [[5, 52]]));
    store.rejectCurrentAndSearchAgain();
    store.startSearch({ ...PARAMS, targetDistanceMeters: 8000 });
    expect(usePlannerStore.getState().previousCandidate).toBeNull();
  });
});
