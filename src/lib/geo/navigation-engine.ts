import type { Coordinate, LngLat, RouteCandidate } from "@/lib/types";
import { closestPointOnLine, cumulativeDistances, lngLatToCoord } from "@/lib/geo/distance";

/** GPS is onnauwkeurig (vooral tussen gebouwen/bomen); dit is de praktische marge
 *  voordat we concluderen dat iemand echt van de route is afgeweken. */
export const OFF_ROUTE_TOLERANCE_METERS = 30;
/** Binnen deze afstand van het eindpunt beschouwen we de wandeling als voltooid. */
export const ARRIVAL_THRESHOLD_METERS = 20;
/**
 * Maximale plausibele verschuiving (in meters "afstand langs de route") tussen twee
 * opeenvolgende gps-metingen. Voorkomt dat bij een rondwandeling (start == eindpunt) een
 * meting vlakbij het startpunt per ongeluk aan het SLUITENDE stuk van de lus wordt
 * toegewezen (die twee liggen fysiek vlak bij elkaar, maar liggen "langs de route" gemeten
 * bijna een hele routelengte uit elkaar) — zonder dit venster kan dat een valse
 * aankomstmelding geven vlak na vertrek. Ruim voldoende voor normale wandelsnelheid tussen
 * gps-updates, met marge voor tijdelijk gps-signaalverlies.
 */
export const DEFAULT_MAX_PROGRESS_JUMP_METERS = 200;

export interface RouteProgress {
  distanceAlongRouteMeters: number;
  totalDistanceMeters: number;
  distanceToLineMeters: number;
  isOffRoute: boolean;
  currentInstructionIndex: number;
  distanceToNextInstructionMeters: number;
  traveled: LngLat[];
  remaining: LngLat[];
  hasArrived: boolean;
}

/**
 * Bereken de voortgang van `currentPosition` langs `route`. Puur en zonder
 * side-effects zodat dit los van GPS/React te testen is (zie
 * tests/unit/navigation-engine.test.ts).
 */
export function computeRouteProgress(
  route: RouteCandidate,
  currentPosition: Coordinate,
  offRouteToleranceMeters: number = OFF_ROUTE_TOLERANCE_METERS,
  /**
   * Afstand langs de route (meters) waar de vorige meting eindigde. Standaard 0, wat
   * overeenkomt met "net vertrokken" — precies het geval waarin de dubbelzinnigheid tussen
   * start en eindpunt van een lus anders zou kunnen misgaan. Bij een nieuwe/herberekende
   * route hoort dit ook weer op 0 te staan (zie NavigationScreen, dat dit per route-id bijhoudt).
   */
  previousDistanceAlongRouteMeters: number = 0,
  maxProgressJumpMeters: number = DEFAULT_MAX_PROGRESS_JUMP_METERS,
): RouteProgress {
  const geometry = route.geometry;
  const closest = closestPointOnLine(currentPosition, geometry, {
    anchorMeters: previousDistanceAlongRouteMeters,
    maxJumpMeters: maxProgressJumpMeters,
  });
  const cumDist = cumulativeDistances(geometry);
  const totalDistanceMeters = cumDist[cumDist.length - 1] ?? route.distanceMeters;

  const instructionDistances = route.instructions.map((instr) => cumDist[instr.pointIndex] ?? 0);
  let currentInstructionIndex = instructionDistances.findIndex((d) => d > closest.distanceAlongLineMeters + 1e-6);
  if (currentInstructionIndex === -1) currentInstructionIndex = Math.max(0, route.instructions.length - 1);

  const nextInstructionDistance = instructionDistances[currentInstructionIndex] ?? totalDistanceMeters;
  const distanceToNextInstructionMeters = Math.max(0, nextInstructionDistance - closest.distanceAlongLineMeters);

  const traveled = [...geometry.slice(0, closest.segmentIndex + 1), toLngLat(closest.point)];
  const remaining = [toLngLat(closest.point), ...geometry.slice(closest.segmentIndex + 1)];

  const hasArrived = totalDistanceMeters - closest.distanceAlongLineMeters <= ARRIVAL_THRESHOLD_METERS;

  return {
    distanceAlongRouteMeters: closest.distanceAlongLineMeters,
    totalDistanceMeters,
    distanceToLineMeters: closest.distanceToLineMeters,
    isOffRoute: closest.distanceToLineMeters > offRouteToleranceMeters,
    currentInstructionIndex,
    distanceToNextInstructionMeters,
    traveled,
    remaining,
    hasArrived,
  };
}

function toLngLat(c: Coordinate): LngLat {
  return [c.lng, c.lat];
}

/**
 * Voorkomt dat één enkele slechte GPS-fix meteen een "je wijkt af"-melding
 * triggert: pas na `consecutiveRequired` opeenvolgende metingen buiten de
 * tolerantie wordt off-route bevestigd. Zodra er weer één meting binnen de
 * tolerantie valt, reset de teller (voorkomt schommelend gedrag rond de rand).
 */
export class OffRouteDetector {
  private consecutiveOffRoute = 0;
  private confirmed = false;

  constructor(private readonly consecutiveRequired: number = 3) {}

  /** Geef de nieuwe off-route-status (isOffRouteNow) door; retourneert of de afwijking bevestigd is. */
  update(isOffRouteNow: boolean): boolean {
    if (isOffRouteNow) {
      this.consecutiveOffRoute++;
      if (this.consecutiveOffRoute >= this.consecutiveRequired) {
        this.confirmed = true;
      }
    } else {
      this.consecutiveOffRoute = 0;
      this.confirmed = false;
    }
    return this.confirmed;
  }

  reset(): void {
    this.consecutiveOffRoute = 0;
    this.confirmed = false;
  }
}

/**
 * Voorkomt dat dezelfde gesproken instructie te vaak wordt herhaald: onthoudt
 * de laatst gesproken tekst en een minimale tijd/afstand tussen herhalingen
 * van *dezelfde* instructie. Een nieuwe/andere instructie mag altijd direct.
 */
export class SpeechRepeatGuard {
  private lastSpokenText: string | null = null;
  private lastSpokenAtMs = 0;

  constructor(private readonly minRepeatIntervalMs: number = 20000) {}

  shouldSpeak(text: string, nowMs: number = Date.now()): boolean {
    if (text !== this.lastSpokenText) {
      this.lastSpokenText = text;
      this.lastSpokenAtMs = nowMs;
      return true;
    }
    if (nowMs - this.lastSpokenAtMs >= this.minRepeatIntervalMs) {
      this.lastSpokenAtMs = nowMs;
      return true;
    }
    return false;
  }

  reset(): void {
    this.lastSpokenText = null;
    this.lastSpokenAtMs = 0;
  }
}

export function averageSpeedKmh(distanceMeters: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return (distanceMeters / durationSeconds) * 3.6;
}

export { lngLatToCoord };
