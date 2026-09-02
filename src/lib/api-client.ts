import type { GeocodeResult, LngLat, RouteCandidate, RouteSearchParams } from "@/lib/types";
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

export async function apiGeocode(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const json = await res.json().catch(() => ({ results: [] }));
  if (!res.ok) throw new Error(json?.error ?? "Adres zoeken is mislukt.");
  return json.results as GeocodeResult[];
}

export type { RouteCandidate };
