import type { Coordinate, LngLat, RouteCandidate, SurfacePreference } from "@/lib/types";

/**
 * Kleine, goedkope "journaal"-opslag in localStorage die tijdens een actieve
 * wandeling wordt bijgewerkt. Doel: als de app/tab onverwacht sluit (lege
 * batterij, browser crasht, gebruiker sluit per ongeluk het tabblad) terwijl
 * er gewandeld wordt, is er bij het opnieuw openen nog een recent traject
 * beschikbaar in plaats van dat alles verloren gaat. Dit is bewust simpel
 * (localStorage, niet IndexedDB) omdat het maar één record tegelijk hoeft te
 * zijn en heel vaak geschreven wordt.
 */

const STORAGE_KEY = "wandelroute-explorer:active-walk";

export interface ActiveWalkSnapshot {
  startedAt: string; // ISO
  start: Coordinate;
  startLabel: string;
  surfacePreference: SurfacePreference;
  plannedRoute: RouteCandidate;
  actualTrack: LngLat[];
  lastUpdatedAt: string; // ISO
}

export function saveActiveWalk(snapshot: ActiveWalkSnapshot): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage kan vol/uitgeschakeld zijn (bv. privénavigatie) — dan
    // laten we crash-herstel gewoon achterwege i.p.v. de wandeling te breken.
  }
}

export function loadActiveWalk(): ActiveWalkSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveWalkSnapshot;
  } catch {
    return null;
  }
}

export function clearActiveWalk(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // negeren
  }
}
