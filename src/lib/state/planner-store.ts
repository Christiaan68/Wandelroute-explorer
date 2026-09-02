import { create } from "zustand";
import type { LngLat, RouteCandidate, RouteSearchParams, WalkRecord } from "@/lib/types";

export type PlannerStatus = "idle" | "searching" | "proposal" | "no_alternatives" | "error";

interface PlannerState {
  params: RouteSearchParams | null;
  status: PlannerStatus;
  currentCandidate: RouteCandidate | null;
  /** Geometrieën van routes die in deze zoeksessie al zijn getoond/afgewezen (voor duplicate-detectie). */
  rejectedGeometries: LngLat[][];
  errorMessage: string | null;
  attemptsUsed: number;

  startSearch: (params: RouteSearchParams) => void;
  setProposal: (candidate: RouteCandidate) => void;
  setNoAlternatives: (attemptsUsed: number) => void;
  setError: (message: string) => void;
  rejectCurrentAndSearchAgain: () => void;
  acceptCurrent: () => RouteCandidate | null;
  /** Reset alleen de "afgewezen routes"-lijst, bv. als gebruiker expliciet "begin opnieuw met eerder afgewezen routes" kiest. */
  clearRejectedHistory: () => void;
  /** Laad een eerder opgeslagen wandeling als geaccepteerde route, zodat "opnieuw wandelen" direct naar navigatie kan. */
  resumeFromWalk: (walk: WalkRecord) => void;
  reset: () => void;
}

/**
 * Houdt de status van één zoeksessie bij: van invoer op het zoekscherm tot en
 * met het geaccepteerde routevoorstel. Bewust NIET gepersisteerd (geen
 * localStorage/IndexedDB) — dit is vluchtige UI-state voor de duur van één
 * sessie; de geaccepteerde/voltooide wandeling wordt apart weggeschreven via
 * WalksRepository zodra de gebruiker "Deze route wandelen" kiest.
 */
export const usePlannerStore = create<PlannerState>((set, get) => ({
  params: null,
  status: "idle",
  currentCandidate: null,
  rejectedGeometries: [],
  errorMessage: null,
  attemptsUsed: 0,

  startSearch: (params) =>
    set({
      params,
      status: "searching",
      errorMessage: null,
      // Nieuwe zoekopdracht (nieuwe afstand/startpunt/voorkeur) -> begin met een schone lei.
      rejectedGeometries: [],
      currentCandidate: null,
    }),

  setProposal: (candidate) => set({ status: "proposal", currentCandidate: candidate, errorMessage: null }),

  setNoAlternatives: (attemptsUsed) => set({ status: "no_alternatives", currentCandidate: null, attemptsUsed }),

  setError: (message) => set({ status: "error", errorMessage: message }),

  rejectCurrentAndSearchAgain: () => {
    const { currentCandidate, rejectedGeometries } = get();
    set({
      status: "searching",
      rejectedGeometries: currentCandidate ? [...rejectedGeometries, currentCandidate.geometry] : rejectedGeometries,
      currentCandidate: null,
    });
  },

  acceptCurrent: () => get().currentCandidate,

  clearRejectedHistory: () => set({ rejectedGeometries: [] }),

  resumeFromWalk: (walk) =>
    set({
      params: {
        targetDistanceMeters: walk.plannedDistanceMeters,
        tolerance: 0.1,
        start: walk.start,
        surfacePreference: walk.surfacePreference,
        startLabel: walk.startLabel,
      },
      status: "proposal",
      currentCandidate: walk.routeCandidate,
      rejectedGeometries: [],
      errorMessage: null,
    }),

  reset: () =>
    set({
      params: null,
      status: "idle",
      currentCandidate: null,
      rejectedGeometries: [],
      errorMessage: null,
      attemptsUsed: 0,
    }),
}));
