import type { Coordinate, DistanceTolerance, RouteCandidate, SurfacePreference } from "@/lib/types";

/**
 * Adapterlaag voor externe wandelrouting-diensten.
 *
 * Waarom dit bestaat: de opdracht vereist dat we later kunnen wisselen van
 * routingprovider (openrouteservice, GraphHopper, Valhalla, ...) zonder de
 * rest van de app te herschrijven. Alle providerspecifieke request/response-
 * vertaling hoort dus UITSLUITEND thuis in een implementatie van deze
 * interface (zie ors-provider.ts). De rest van de app (route-generatie-
 * engine, UI, opslag) kent alleen RoutingProvider en de domeintypes uit
 * src/lib/types.ts.
 */
export interface RoundTripRequest {
  start: Coordinate;
  /** Gewenste lengte van de lus in meters. */
  targetDistanceMeters: number;
  /** Willekeurige seed: zelfde input + andere seed => andere lus. */
  seed: number;
  /** Grove richtingsvoorkeur in graden (0-360), helpt varatie sturen. */
  bearingDegrees?: number;
  surfacePreference: SurfacePreference;
}

export interface DirectionsRequest {
  from: Coordinate;
  to: Coordinate;
}

export interface RoutingProvider {
  readonly name: string;
  /** Genereer één rondwandeling-kandidaat die dicht bij targetDistanceMeters uitkomt. */
  generateRoundTrip(request: RoundTripRequest): Promise<RouteCandidate>;
  /**
   * Bereken een directe route van punt A naar punt B (geen lus). Gebruikt om
   * tijdens navigatie terug te routeren naar de oorspronkelijk gekozen
   * bestemming, bijvoorbeeld nadat iemand van de route is afgeweken — in
   * tegenstelling tot generateRoundTrip levert dit geen nieuwe, losstaande
   * lus op vanaf de huidige positie.
   */
  generateDirections(request: DirectionsRequest): Promise<RouteCandidate>;
}

export class RoutingProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RoutingProviderError";
  }
}

export function clampToleranceMeters(targetDistanceMeters: number, tolerance: DistanceTolerance): number {
  return targetDistanceMeters * tolerance;
}