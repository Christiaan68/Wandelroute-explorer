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
  /**
   * Voorkeur "vermijd stoplichten en drukke oversteekplaatsen". Als deze aan
   * staat, kiest de routegeneratie-engine (zie route-generation/engine.ts)
   * binnen de kandidaten-pool bewust de route met de minste geschatte
   * stoplichten/gelijkvloerse grote-weg-oversteken, ook als die net iets
   * minder goed bij de gevraagde afstand of ondergrondvoorkeur past.
   */
  avoidTrafficLights: boolean;
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
  /**
   * Straatnaam waar je na deze afslag op terechtkomt, indien bekend bij de
   * routingdienst (bv. OpenStreetMap-data). `undefined` voor naamloze paden
   * (bospaden, onbenoemde trage wegen e.d.) — dat komt vaak voor bij
   * rondwandelingen door natuurgebied.
   */
  streetName?: string;
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

/**
 * Resultaat van de voorkeur "vermijd stoplichten en drukke oversteekplaatsen"
 * voor één specifieke route. Wordt alleen meegegeven als de voorkeur
 * daadwerkelijk was aangevraagd (`requested: true`).
 */
export interface TrafficAvoidanceSummary {
  /** True zodra de gebruiker de voorkeur had aangezet toen deze route werd berekend. */
  requested: boolean;
  /** Geschat aantal stoplichten (kruispunt of oversteekplaats) dat de route passeert. */
  trafficLightCount: number;
  /** Geschat aantal keer dat de route gelijkvloers een drukke/grote weg oversteekt. */
  majorRoadCrossingCount: number;
  /**
   * False als de onderliggende OpenStreetMap-gegevens niet (volledig) konden
   * worden opgehaald. In dat geval zijn de tellingen hierboven niet
   * betrouwbaar en mag de UI nooit beweren dat de route gegarandeerd vrij is
   * van stoplichten/grote oversteken.
   */
  dataComplete: boolean;
  /** Extra afstand (meters, altijd >= 0) t.o.v. de route die zonder deze voorkeur was gekozen. */
  extraDistanceMeters: number;
  /** Extra geschatte looptijd (seconden, altijd >= 0) t.o.v. de route die zonder deze voorkeur was gekozen. */
  extraDurationSeconds: number;
  /**
   * Alleen relevant bij het herberekenen van een directe route (geen
   * rondwandeling-kandidatenpool om uit te kiezen): true als er
   * daadwerkelijk vrijwaringszones op de routeberekening zijn toegepast,
   * false als openrouteservice daarmee geen route kon vinden en is
   * teruggevallen op de gewone, niet-aangepaste route.
   */
  avoidanceApplied?: boolean;
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
  /** Alleen aanwezig als de voorkeur "vermijd stoplichten en drukke oversteekplaatsen" was aangevraagd. */
  trafficAvoidance?: TrafficAvoidanceSummary;
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
