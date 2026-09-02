/**
 * Centrale domeintypes voor Wandelroute Explorer.
 * Deze types zijn bewust provider-agnostisch: ze bevatten geen ORS- of
 * GraphHopper-specifieke velden, zodat src/lib/routing vrij van adapter
 * kan wisselen zonder de rest van de app te raken.
 */

export type LngLat = [lng: number, lat: number];

export interface Coordinate {
  lng: number;
  lat: number;
}

/** Voorkeur voor het type ondergrond van de wandeling. */
export type SurfacePreference = "paved" | "unpaved" | "mixed";

/** Toegestane afwijking t.o.v. de gewenste afstand. */
export type DistanceTolerance = 0.05 | 0.1 | 0.15;

export interface RouteSearchParams {
  /** Gewenste afstand in meters. */
  targetDistanceMeters: number;
  tolerance: DistanceTolerance;
  start: Coordinate;
  surfacePreference: SurfacePreference;
  /** Vrije tekst zoals ingevoerd/geselecteerd door de gebruiker (adres of "Huidige locatie"). */
  startLabel: string;
}

export type ManeuverType =
  | "depart"
  | "turn-left"
  | "turn-slight-left"
  | "turn-sharp-left"
  | "turn-right"
  | "turn-slight-right"
  | "turn-sharp-right"
  | "continue"
  | "uturn"
  | "roundabout"
  | "arrive";

export interface RouteInstruction {
  /** Index in RouteCandidate.geometry waar deze instructie van toepassing is. */
  pointIndex: number;
  maneuver: ManeuverType;
  /** Kant-en-klare Nederlandse tekst, bv. "Sla linksaf". */
  text: string;
  /** Afstand in meters vanaf dit punt tot de volgende instructie. */
  distanceToNextMeters: number;
}

export interface SurfaceBreakdown {
  pavedMeters: number;
  unpavedMeters: number;
  unknownMeters: number;
}

export interface ElevationInfo {
  ascentMeters: number;
  descentMeters: number;
}

/** Eén door de routing-adapter voorgestelde rondwandeling. */
export interface RouteCandidate {
  id: string;
  geometry: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
  instructions: RouteInstruction[];
  surface: SurfaceBreakdown;
  elevation: ElevationInfo | null;
  /** Interne seed/parameters die tot deze route leidden (voor debugging/telemetrie). */
  generationSeed: number;
}

/** Metadata die de UI toont naast de kaart. */
export interface RouteSummaryView {
  distanceMeters: number;
  durationSeconds: number;
  pavedFraction: number; // 0..1
  unpavedFraction: number; // 0..1
  elevation: ElevationInfo | null;
  description: string;
}

export type WalkStatus = "completed" | "aborted";

export interface WalkRecord {
  id: string;
  date: string; // ISO 8601
  startLabel: string;
  start: Coordinate;
  plannedRoute: LngLat[];
  actualTrack: LngLat[];
  plannedDistanceMeters: number;
  actualDistanceMeters: number;
  durationSeconds: number;
  averageSpeedKmh: number;
  surfacePreference: SurfacePreference;
  status: WalkStatus;
  /** Bewaar het volledige routevoorstel zodat "opnieuw wandelen" exact dezelfde route kan hervatten. */
  routeCandidate: RouteCandidate;
}

export interface GeocodeResult {
  label: string;
  coordinate: Coordinate;
}
