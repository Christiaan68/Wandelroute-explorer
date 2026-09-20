import { NextResponse } from "next/server";
import { generateRoute } from "@/lib/route-generation/engine";
import { getRoutingProvider, RoutingProviderError } from "@/lib/routing";
import type { DistanceTolerance, LngLat, RouteSearchParams, SurfacePreference } from "@/lib/types";

/**
 * Zonder dit staat Vercel een serverless function maar 10 seconden toe. Deze
 * route kan (bij meerdere pogingen + het parallel ophalen van
 * stoplicht-/drukke-weg-gegevens als "vermijd stoplichten" aan staat) langer
 * duren dan dat — zonder expliciete `maxDuration` zou Vercel de function dan
 * halverwege afbreken (de browser krijgt dan een onduidelijke 504 in plaats
 * van onze eigen, begrijpelijke foutmelding). 30s is ruim voldoende voor het
 * huidige gedrag en werkt op elk Vercel-abonnement (Hobby staat tot 60s toe).
 */
export const maxDuration = 30;

interface GenerateRouteRequestBody {
  params: RouteSearchParams;
  rejectedGeometries?: LngLat[][];
}

function isValidParams(params: unknown): params is RouteSearchParams {
  if (!params || typeof params !== "object") return false;
  const p = params as Record<string, unknown>;
  const start = p.start as Record<string, unknown> | undefined;
  return (
    typeof p.targetDistanceMeters === "number" &&
    p.targetDistanceMeters > 0 &&
    [0.05, 0.1, 0.15].includes(p.tolerance as DistanceTolerance) &&
    !!start &&
    typeof start.lat === "number" &&
    typeof start.lng === "number" &&
    ["paved", "unpaved", "mixed"].includes(p.surfacePreference as SurfacePreference)
  );
}

/**
 * Normaliseert `avoidTrafficLights` naar een strikte boolean. Bewust
 * coulant (geen harde validatiefout) als het veld ontbreekt of geen boolean
 * is: zo blijft een client met een verouderde/gecachte versie van de app
 * (die dit veld nog niet meestuurt) gewoon werken, met de voorkeur simpelweg
 * uit.
 */
function normalizeAvoidTrafficLights(params: RouteSearchParams): RouteSearchParams {
  return { ...params, avoidTrafficLights: params.avoidTrafficLights === true };
}

export async function POST(request: Request) {
  let body: GenerateRouteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag (geen geldige JSON)." }, { status: 400 });
  }

  if (!isValidParams(body.params)) {
    return NextResponse.json(
      { error: "Ongeldige zoekparameters. Controleer afstand, marge, startpunt en ondergrondvoorkeur." },
      { status: 400 },
    );
  }

  // Basale plausibiliteitscontrole zodat een verkeerde invoer niet leidt tot
  // absurd lange routingaanvragen.
  if (body.params.targetDistanceMeters > 60000) {
    return NextResponse.json({ error: "De maximale wandelafstand die deze app ondersteunt is 60 km." }, { status: 400 });
  }

  try {
    const provider = getRoutingProvider();
    const result = await generateRoute({
      provider,
      params: normalizeAvoidTrafficLights(body.params),
      rejectedGeometries: body.rejectedGeometries ?? [],
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RoutingProviderError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Onverwachte fout bij routegeneratie:", err);
    return NextResponse.json(
      { error: "Er ging iets onverwachts mis bij het genereren van een route. Probeer het opnieuw." },
      { status: 500 },
    );
  }
}
