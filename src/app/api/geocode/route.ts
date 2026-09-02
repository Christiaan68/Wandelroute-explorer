import { NextResponse } from "next/server";
import type { GeocodeResult } from "@/lib/types";

/**
 * Server-side proxy naar Nominatim (OpenStreetMap). We proxyen dit i.p.v.
 * rechtstreeks vanuit de browser te callen omdat:
 * 1. Nominatim's gebruiksbeleid een geldige, herkenbare User-Agent/contact
 *    vereist (https://operations.osmfoundation.org/policies/nominatim/) —
 *    dat zetten we hier server-side vast i.p.v. dat elke client dat doet.
 * 2. Zo kunnen we later eenvoudig een cache of alternatieve geocoder inpluggen
 *    zonder de UI aan te passen.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] satisfies GeocodeResult[] });
  }

  const contactEmail = process.env.NOMINATIM_CONTACT_EMAIL ?? "contact@example.com";
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  // Focus op Nederland/België, waar deze app primair voor bedoeld is, zonder
  // andere landen hard uit te sluiten.
  url.searchParams.set("countrycodes", "nl,be,de");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": `WandelrouteExplorer/0.1 (${contactEmail})`,
        "Accept-Language": "nl",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ results: [], error: "Adreszoekdienst is momenteel niet bereikbaar." }, { status: 502 });
    }

    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    const results: GeocodeResult[] = data.map((item) => ({
      label: item.display_name,
      coordinate: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { results: [], error: "Kon geen verbinding maken met de adreszoekdienst." },
      { status: 502 },
    );
  }
}
