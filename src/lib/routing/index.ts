import { OpenRouteServiceProvider } from "@/lib/routing/ors-provider";
import { RoutingProviderError, type RoutingProvider } from "@/lib/routing/provider";

let cached: RoutingProvider | null = null;

/**
 * Factory: kiest de routingadapter op basis van ROUTING_PROVIDER. Voeg hier een
 * `case` toe zodra er een tweede adapter bestaat (bv. GraphHopper) — de rest
 * van de app hoeft dan niet te veranderen, want alles praat tegen de
 * RoutingProvider-interface uit provider.ts.
 */
export function getRoutingProvider(): RoutingProvider {
  if (cached) return cached;

  const providerName = process.env.ROUTING_PROVIDER ?? "ors";

  switch (providerName) {
    case "ors": {
      const apiKey = process.env.ORS_API_KEY;
      if (!apiKey || apiKey === "your_openrouteservice_api_key_here") {
        throw new RoutingProviderError(
          "ORS_API_KEY ontbreekt. Vul een geldige openrouteservice API-key in .env.local in (zie .env.example).",
        );
      }
      cached = new OpenRouteServiceProvider(apiKey);
      return cached;
    }
    default:
      throw new RoutingProviderError(
        `Onbekende ROUTING_PROVIDER "${providerName}". Alleen "ors" is op dit moment geïmplementeerd.`,
      );
  }
}

export * from "@/lib/routing/provider";
