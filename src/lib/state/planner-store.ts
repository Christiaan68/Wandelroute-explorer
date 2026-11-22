import { create } from "zustand";
import type { LngLat, RouteCandidate, RouteSearchParams, WalkRecord } from "@/lib/types";
import type { NoRouteReason, RejectionCounts } from "@/lib/route-generation/engine";

/**
 * "no_alternatives" en "provider_unavailable" zijn beide "geen route
 * gevonden"-uitkomsten, maar met een verschillende, eigen oorzaak (zie
 * NoRouteReason in route-generation/engine.ts) — de UI (ProposalScreen) toont
 * er daarom ook bewust twee verschillende schermen/meldingen voor, zodat
 * iemand niet blijft "hangen" in adviezen (afstandsmarge/ondergrond aanpassen)
 * die bij een niet-bereikbare routingdienst toch niet zouden helpen.
 */
export type PlannerStatus = "idle" | "searching" | "proposal" | "no_alternatives" | "provider_unavailable" | "error";

interface PlannerState {
  params: RouteSearchParams | null;
  status: PlannerStatus;
  currentCandidate: RouteCandidate | null;
  /** Geometrieën van routes die in deze zoeksessie al zijn getoond/afgewezen (voor duplicate-detectie). */
  rejectedGeometries: LngLat[][];
  errorMessage: string | null;
  attemptsUsed: number;
  /** Waarom de laatste zoekpoging geen route opleverde (per reden geteld), voor een eerlijke melding. */
  lastRejectionCounts: RejectionCounts | null;
  /** De route die vóór "Andere route zoeken" werd getoond, zodat je daarnaar terug kunt als er geen andere is. */
  previousCandidate: RouteCandidate | null;

  startSearch: (params: RouteSearchParams) => void;
  setProposal: (candidate: RouteCandidate) => void;
  setNoAlternatives: (attemptsUsed: number, reason: NoRouteReason, counts?: RejectionCounts) => void;
  setError: (message: string) => void;
  rejectCurrentAndSearchAgain: () => void;
  /** Terug naar de route die vóór de laatste "Andere route zoeken" werd getoond. */
  restorePreviousCandidate: () => void;
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
  lastRejectionCounts: null,
  previousCandidate: null,

  startSearch: (params) =>
    set({
      params,
      status: "searching",
      errorMessage: null,
      // Nieuwe zoekopdracht (nieuwe afstand/startpunt/voorkeur) -> begin met een schone lei.
      rejectedGeometries: [],
      currentCandidate: null,
      previousCandidate: null,
      lastRejectionCounts: null,
    }),

  setProposal: (candidate) => set({ status: "proposal", currentCandidate: candidate, errorMessage: null }),

  setNoAlternatives: (attemptsUsed, reason, counts) =>
    set({
      status: reason === "provider_unavailable" ? "provider_unavailable" : "no_alternatives",
      currentCandidate: null,
      attemptsUsed,
      lastRejectionCounts: counts ?? null,
    }),

  setError: (message) => set({ status: "error", errorMessage: message }),

  rejectCurrentAndSearchAgain: () => {
    const { currentCandidate, rejectedGeometries } = get();
    set({
      status: "searching",
      rejectedGeometries: currentCandidate ? [...rejectedGeometries, currentCandidate.geometry] : rejectedGeometries,
      currentCandidate: null,
      previousCandidate: currentCandidate ?? get().previousCandidate,
    });
  },

  restorePreviousCandidate: () => {
    const { previousCandidate, rejectedGeometries } = get();
    if (!previousCandidate) return;
    set({
      status: "proposal",
      currentCandidate: previousCandidate,
      // De teruggezette route staat weer "op het scherm" en hoort dus niet meer bij de afgewezen routes.
      rejectedGeometries: rejectedGeometries.filter((g) => g !== previousCandidate.geometry),
      previousCandidate: null,
      errorMessage: null,
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
        // Eerder opgeslagen wandelingen kennen deze voorkeur nog niet (bestond nog niet toen ze werden opgeslagen).
        avoidTrafficLights: walk.routeCandidate.trafficAvoidance?.requested ?? false,
      },
      status: "proposal",
      currentCandidate: walk.routeCandidate,
      rejectedGeometries: [],
      previousCandidate: null,
      lastRejectionCounts: null,
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
      lastRejectionCounts: null,
      previousCandidate: null,
    }),
}));
