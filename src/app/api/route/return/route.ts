import { NextResponse } from "next/server";
import { getRoutingProvider, RoutingProviderError } from "@/lib/routing";
import type { Coordinate } from "@/lib/types";

/**
 * Berekent een directe route (geen lus) van `from` naar `to`. Gebruikt tijdens
 * navigatie om terug te routeren naar de oorspronkelijk gekozen bestemming
 * nadat iemand van de route is afgeweken — in tegenstelling tot
 * /api/route/generate levert dit geen nieuwe, losstaande rondwandeling op
 * vanaf de huidige positie.
 */

/**
 * Zie dezelfde uitleg in /api/route/generate/route.ts. Deze route kan bij
 * "vermijd stoplichten" tot 3 ORS-aanroepen NA elkaar doen (niet parallel),
 * dus met wat extra marge op 45s gezet.
 */
export const maxDuration = 45;
interface ReturnRouteRequestBody {
  from: Coordinate;
  to: Coordinate;
  avoidTrafficLights?: boolean;
}

function isValidCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.lat === "number" && typeof c.lng === "number";
}

export async function POST(request: Request) {
  let body: ReturnRouteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag (geen geldige JSON)." }, { status: 400 });
  }

  if (!isValidCoordinate(body.from) || !isValidCoordinate(body.to)) {
    return NextResponse.json({ error: "Ongeldige aanvraag: 'from' en 'to' moeten geldige coördinaten zijn." }, { status: 400 });
  }

  try {
    const provider = getRoutingProvider();
    const candidate = await provider.generateDirections({
      from: body.from,
      to: body.to,
      avoidTrafficLights: body.avoidTrafficLights === true,
    });
    return NextResponse.json({ candidate });
  } catch (err) {
    if (err instanceof RoutingProviderError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("Onverwachte fout bij het berekenen van een terugroute:", err);
    return NextResponse.json(
      { error: "Er ging iets onverwachts mis bij het berekenen van een route terug naar je bestemming." },
      { status: 500 },
    );
  }
}
