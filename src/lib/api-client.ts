import type { Coordinate, GeocodeResult, LngLat, RouteCandidate, RouteSearchParams } from "@/lib/types";
import type { GenerateRouteResult } from "@/lib/route-generation/engine";

/** Dunne, getypeerde fetch-wrappers rond onze eigen API-routes (server-side proxy naar ORS/Nominatim). */

export async function apiGenerateRoute(
  params: RouteSearchParams,
  rejectedGeometries: LngLat[][],
): Promise<GenerateRouteResult> {
  const res = await fetch("/api/route/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, rejectedGeometries }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? "Route genereren is mislukt.");
  }
  return json as GenerateRouteResult;
}

/**
 * Directe (niet-lus) route terug naar de oorspronkelijk gekozen bestemming.
 * Gebruikt bij het herberekenen na een afwijking tijdens navigatie, zodat je
 * weer naar je eigenlijke doel geleid wordt i.p.v. een compleet nieuwe
 * rondwandeling vanaf je huidige positie te krijgen.
 */
export async function apiGenerateReturnRoute(from: Coordinate, to: Coordinate): Promise<RouteCandidate> {
  const res = await fetch("/api/route/return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? "Route terug naar je bestemming berekenen is mislukt.");
  }
  return (json as { candidate: RouteCandidate }).candidate;
}

export async function apiGeocode(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const json = await res.json().catch(() => ({ results: [] }));
  if (!res.ok) throw new Error(json?.error ?? "Adres zoeken is mislukt.");
  return json.results as GeocodeResult[];
}

export type { RouteCandidate };