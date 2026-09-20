import type { Coordinate, GeocodeResult, LngLat, RouteCandidate, RouteSearchParams } from "@/lib/types";
import type { GenerateRouteResult } from "@/lib/route-generation/engine";

/** Dunne, getypeerde fetch-wrappers rond onze eigen API-routes (server-side proxy naar ORS/Nominatim). */

/**
 * Bewust ruim boven `maxDuration` van de betreffende API-routes (zie
 * src/app/api/route/generate/route.ts en .../return/route.ts, beide op de
 * server begrensd op resp. 30s/45s) — zo krijgt de server altijd de kans om
 * zelf netjes met een duidelijke JSON-foutmelding te stoppen vóórdat de
 * browser het zelf opgeeft. Zonder een eigen limiet hier kon "Route
 * zoeken…" in theorie onbeperkt lang blijven hangen als de verbinding
 * halverwege wegviel, zonder ooit een foutmelding te tonen.
 */
const ROUTE_REQUEST_TIMEOUT_MS = 40000;

function friendlyFetchErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return `De aanvraag duurde te lang (meer dan ${Math.round(ROUTE_REQUEST_TIMEOUT_MS / 1000)} seconden). Controleer je internetverbinding en probeer het opnieuw.`;
  }
  return fallback;
}

export async function apiGenerateRoute(
  params: RouteSearchParams,
  rejectedGeometries: LngLat[][],
): Promise<GenerateRouteResult> {
  let res: Response;
  try {
    res = await fetch("/api/route/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params, rejectedGeometries }),
      signal: AbortSignal.timeout(ROUTE_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(friendlyFetchErrorMessage(err, "Geen verbinding met de server kunnen maken. Controleer je internetverbinding en probeer het opnieuw."));
  }

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
export async function apiGenerateReturnRoute(
  from: Coordinate,
  to: Coordinate,
  avoidTrafficLights: boolean = false,
): Promise<RouteCandidate> {
  let res: Response;
  try {
    res = await fetch("/api/route/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, avoidTrafficLights }),
      signal: AbortSignal.timeout(ROUTE_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(friendlyFetchErrorMessage(err, "Geen verbinding met de server kunnen maken. Controleer je internetverbinding en probeer het opnieuw."));
  }

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
