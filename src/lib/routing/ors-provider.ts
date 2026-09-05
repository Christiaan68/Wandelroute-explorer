import type { Coordinate, ElevationInfo, LngLat, RouteCandidate, RouteInstruction, SurfaceBreakdown } from "@/lib/types";
import { polylineLengthMeters } from "@/lib/geo/distance";
import { maneuverFromOrsType, maneuverToDutchText } from "@/lib/routing/instruction-text";
import { RoutingProviderError, type DirectionsRequest, type RoundTripRequest, type RoutingProvider } from "@/lib/routing/provider";

// LET OP: niet "api.openrouteservice.org" gebruiken — dat domein is per
// 27-08-2026 teruggebracht naar 10% van je quotum en wordt op 28-09-2026
// volledig uitgezet. Nieuwe, officiële URL-structuur: api.heigit.org/<service>/<versie>.
// Je API-key werkt op beide domeinen; alleen de basis-URL verandert.
// Bron: https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912
const ORS_BASE_URL = "https://api.heigit.org/openrouteservice";
const PROFILE = "foot-walking";

/**
 * Surface-waarden zoals gedocumenteerd door openrouteservice
 * (GIScience/openrouteservice-docs, tabel "Surface"). We groeperen ze grof in
 * verhard/onverhard omdat de app de gebruiker maar drie voorkeuren biedt.
 * Dit is een bewuste simplificatie: "Metal" (bv. roosters/bruggen) en "Ice"
 * zijn zeldzaam op wandelpaden en tellen mee als "onbekend" i.p.v. hard te
 * classificeren.
 */
const PAVED_SURFACE_IDS = new Set([1, 3, 4, 5, 14]); // Paved, Asphalt, Concrete, Cobblestone, Paving Stones
const UNPAVED_SURFACE_IDS = new Set([2, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18]); // Unpaved, Wood, Gravel-varianten, Dirt, Ground, Sand, Woodchips, Grass(-paver)

interface OrsFeature {
  geometry: { coordinates: number[][] };
  properties: {
    summary: { distance: number; duration: number };
    ascent?: number;
    descent?: number;
    segments: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        type: number;
        instruction: string;
        /** Straatnaam volgens ORS/OpenStreetMap; "-" wanneer de weg geen naam heeft. */
        name: string;
        way_points: [number, number];
      }>;
    }>;
    extras?: {
      surface?: { values: Array<[number, number, number]> };
    };
  };
}

interface OrsResponse {
  features: OrsFeature[];
  error?: { message: string };
}

export class OpenRouteServiceProvider implements RoutingProvider {
  readonly name = "openrouteservice";

  constructor(private readonly apiKey: string) {}

  async generateRoundTrip(request: RoundTripRequest): Promise<RouteCandidate> {
    const body = {
      coordinates: [[request.start.lng, request.start.lat]],
      instructions: true,
      instructions_format: "text",
      elevation: true,
      extra_info: ["surface", "waytype"],
      options: {
        round_trip: {
          length: Math.round(request.targetDistanceMeters),
          // Meer tussenpunten bij langere routes geeft een natuurlijkere lus
          // i.p.v. een simpele driehoek/lijn-heen-en-terug.
          points: request.targetDistanceMeters > 8000 ? 6 : request.targetDistanceMeters > 3000 ? 5 : 4,
          seed: request.seed,
        },
      },
    };

    let res: Response;
    try {
      res = await fetch(`${ORS_BASE_URL}/v2/directions/${PROFILE}/geojson`, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json",
        },
        body: JSON.stringify(body),
        // Route-generatie kan een paar seconden duren; geef ORS de ruimte.
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new RoutingProviderError("Kon geen verbinding maken met de routingdienst (openrouteservice).", err);
    }

    const json = (await res.json().catch(() => null)) as OrsResponse | null;

    if (!res.ok || !json || !json.features?.length) {
      const message = json?.error?.message ?? `HTTP ${res.status}`;
      throw new RoutingProviderError(`Routingdienst kon geen rondwandeling genereren (${message}).`);
    }

    return this.toRouteCandidate(json.features[0]!, request.seed);
  }

  /**
   * Directe (niet-lus) route tussen twee punten. Gebruikt om tijdens navigatie
   * terug te routeren naar de oorspronkelijk gekozen bestemming na een
   * afwijking — geen `round_trip`-optie, dus geen nieuwe losstaande lus.
   */
  async generateDirections(request: DirectionsRequest): Promise<RouteCandidate> {
    const body = {
      coordinates: [
        [request.from.lng, request.from.lat],
        [request.to.lng, request.to.lat],
      ],
      instructions: true,
      instructions_format: "text",
      elevation: true,
      extra_info: ["surface", "waytype"],
    };

    let res: Response;
    try {
      res = await fetch(`${ORS_BASE_URL}/v2/directions/${PROFILE}/geojson`, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new RoutingProviderError("Kon geen verbinding maken met de routingdienst (openrouteservice).", err);
    }

    const json = (await res.json().catch(() => null)) as OrsResponse | null;

    if (!res.ok || !json || !json.features?.length) {
      const message = json?.error?.message ?? `HTTP ${res.status}`;
      throw new RoutingProviderError(`Routingdienst kon geen route terug naar de bestemming vinden (${message}).`);
    }

    return this.toRouteCandidate(json.features[0]!, 0, "ors-return");
  }

  private toRouteCandidate(feature: OrsFeature, seed: number, idPrefix: string = "ors"): RouteCandidate {
    const rawCoords = feature.geometry.coordinates;
    const geometry: LngLat[] = rawCoords.map((c) => [c[0]!, c[1]!]);

    const distanceMeters = feature.properties.summary?.distance ?? polylineLengthMeters(geometry);
    const durationSeconds = feature.properties.summary?.duration ?? estimateWalkingDurationSeconds(distanceMeters);

    const instructions = this.extractInstructions(feature);
    const surface = this.extractSurface(feature, distanceMeters);
    const elevation = this.extractElevation(feature, rawCoords);

    return {
      id: `${idPrefix}-${seed}-${Date.now()}`,
      geometry,
      distanceMeters,
      durationSeconds,
      instructions,
      surface,
      elevation,
      generationSeed: seed,
    };
  }

  private extractInstructions(feature: OrsFeature): RouteInstruction[] {
    const instructions: RouteInstruction[] = [];
    for (const segment of feature.properties.segments ?? []) {
      for (const step of segment.steps ?? []) {
        const maneuver = maneuverFromOrsType(step.type);
        // ORS geeft "-" terug wanneer de weg/het pad geen naam heeft (komt vaak
        // voor bij onbenoemde bospaden e.d.) — dat behandelen we als "onbekend".
        const streetName = step.name && step.name !== "-" ? step.name : undefined;
        instructions.push({
          pointIndex: step.way_points[0],
          maneuver,
          text: maneuverToDutchText(maneuver),
          distanceToNextMeters: step.distance,
          streetName,
        });
      }
    }
    return instructions;
  }

  private extractSurface(feature: OrsFeature, totalDistanceMeters: number): SurfaceBreakdown {
    const values = feature.properties.extras?.surface?.values;
    if (!values || values.length === 0) {
      // Geen surface-data beschikbaar voor dit gebied/deze weg -> alles "onbekend"
      // i.p.v. te doen alsof het verhard of onverhard is.
      return { pavedMeters: 0, unpavedMeters: 0, unknownMeters: totalDistanceMeters };
    }

    const geometry = feature.geometry.coordinates.map((c): LngLat => [c[0]!, c[1]!]);
    let paved = 0;
    let unpaved = 0;
    let unknown = 0;

    for (const [startIdx, endIdx, valueId] of values) {
      const segment = geometry.slice(startIdx, endIdx + 1);
      const segLength = polylineLengthMeters(segment);
      if (PAVED_SURFACE_IDS.has(valueId)) paved += segLength;
      else if (UNPAVED_SURFACE_IDS.has(valueId)) unpaved += segLength;
      else unknown += segLength;
    }

    return { pavedMeters: paved, unpavedMeters: unpaved, unknownMeters: unknown };
  }

  private extractElevation(feature: OrsFeature, rawCoords: number[][]): ElevationInfo | null {
    // Voorkeur: door ORS berekende ascent/descent (som over de hele route).
    if (typeof feature.properties.ascent === "number" && typeof feature.properties.descent === "number") {
      return { ascentMeters: feature.properties.ascent, descentMeters: feature.properties.descent };
    }

    // Fallback: zelf berekenen uit de hoogte (3e coördinaat) als elevation:true
    // wel geometrie-hoogtes teruggaf maar geen samengevatte ascent/descent.
    const hasElevation = rawCoords.length > 0 && rawCoords[0]!.length >= 3;
    if (!hasElevation) return null;

    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < rawCoords.length; i++) {
      const diff = rawCoords[i]![2]! - rawCoords[i - 1]![2]!;
      if (diff > 0) ascent += diff;
      else descent += -diff;
    }
    return { ascentMeters: Math.round(ascent), descentMeters: Math.round(descent) };
  }
}

function estimateWalkingDurationSeconds(distanceMeters: number): number {
  const WALKING_SPEED_MPS = 1.35; // ~4,9 km/u, gangbaar gemiddelde voor wandelen
  return distanceMeters / WALKING_SPEED_MPS;
}

export function assertOrsCoordinateIsUsable(_coord: Coordinate): void {
  // Placeholder voor toekomstige validatie (bv. binnen dekkingsgebied van de provider).
}