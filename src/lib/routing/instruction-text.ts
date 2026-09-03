import type { ManeuverType } from "@/lib/types";

/**
 * ORS geeft instructiestappen terug met een numerieke "type"-code. Deze mapping
 * komt uit de officiële openrouteservice-docs (GIScience/openrouteservice-docs
 * README, tabel "Instructions"). Andere providers (GraphHopper, Valhalls) hebben
 * hun eigen codes — die vertaling hoort thuis in hún adapter, niet hier. Dit
 * bestand kent alleen ons eigen provider-onafhankelijke ManeuverType.
 */
const ORS_MANEUVER_BY_TYPE: Record<number, ManeuverType> = {
  0: "turn-left",
  1: "turn-right",
  2: "turn-sharp-left",
  3: "turn-sharp-right",
  4: "turn-slight-left",
  5: "turn-slight-right",
  6: "continue",
  7: "roundabout",
  8: "roundabout",
  9: "uturn",
  10: "arrive",
  11: "depart",
  12: "turn-slight-left", // "keep left"
  13: "turn-slight-right", // "keep right"
};

export function maneuverFromOrsType(type: number): ManeuverType {
  return ORS_MANEUVER_BY_TYPE[type] ?? "continue";
}

/** Basistekst zonder afstand, bv. voor de statische instructielijst op het voorstelscherm. */
export function maneuverToDutchText(maneuver: ManeuverType): string {
  switch (maneuver) {
    case "depart":
      return "Vertrek";
    case "turn-left":
      return "Sla linksaf";
    case "turn-slight-left":
      return "Houd links aan";
    case "turn-sharp-left":
      return "Sla scherp linksaf";
    case "turn-right":
      return "Sla rechtsaf";
    case "turn-slight-right":
      return "Houd rechts aan";
    case "turn-sharp-right":
      return "Sla scherp rechtsaf";
    case "continue":
      return "Blijf rechtdoor lopen";
    case "uturn":
      return "Keer om";
    case "roundabout":
      return "Neem de rotonde";
    case "arrive":
      return "Je hebt je bestemming bereikt";
    default:
      return "Blijf rechtdoor lopen";
  }
}

/** Ronde afstand naar een leesbare Nederlandse waarde: "over 100 meter", "over 1,2 km". */
export function formatDistanceForSpeech(distanceMeters: number): string {
  if (distanceMeters < 20) return "nu";
  if (distanceMeters < 1000) {
    const rounded = Math.round(distanceMeters / 10) * 10;
    return `over ${rounded} meter`;
  }
  const km = Math.round((distanceMeters / 1000) * 10) / 10;
  return `over ${km.toString().replace(".", ",")} kilometer`;
}

/**
 * Maneuvers waarbij je daadwerkelijk een andere straat/pad in slaat — hier is
 * een eventuele straatnaam nuttig ("...linksaf, de Betsy Westendorpstraat
 * in"). Bij "continue"/"roundabout"/"uturn" laten we de naam weg: bij
 * rechtdoor lopen blijf je vaak (nog) op dezelfde straat, en bij een
 * rotonde/u-bocht zegt de straatnaam minder dan welke afslag je neemt.
 */
const TURN_MANEUVERS = new Set<ManeuverType>([
  "turn-left",
  "turn-slight-left",
  "turn-sharp-left",
  "turn-right",
  "turn-slight-right",
  "turn-sharp-right",
]);

/**
 * Volledige gesproken/getoonde instructie zoals gevraagd in de opdracht: "Over
 * 100 meter linksaf". Als er een straatnaam bekend is voor een afslag, wordt
 * die toegevoegd: "Over 90 meter linksaf, de Betsy Westendorpstraat in".
 */
export function buildSpokenInstruction(maneuver: ManeuverType, distanceMeters: number, streetName?: string): string {
  if (maneuver === "arrive") return "Je hebt je bestemming bereikt";
  if (maneuver === "depart") return "Vertrek en volg de route";

  const distancePart = formatDistanceForSpeech(distanceMeters);
  const actionByManeuver: Partial<Record<ManeuverType, string>> = {
    "turn-left": "linksaf",
    "turn-slight-left": "houd links aan",
    "turn-sharp-left": "scherp linksaf",
    "turn-right": "rechtsaf",
    "turn-slight-right": "houd rechts aan",
    "turn-sharp-right": "scherp rechtsaf",
    continue: "blijf rechtdoor lopen",
    uturn: "keer om",
    roundabout: "neem de rotonde",
  };

  const action = actionByManeuver[maneuver] ?? "blijf rechtdoor lopen";
  const streetSuffix = streetName && TURN_MANEUVERS.has(maneuver) ? `, de ${streetName} in` : "";

  if (distancePart === "nu") {
    return maneuver === "continue" ? "Blijf rechtdoor lopen" : `Sla nu ${action}${streetSuffix}`;
  }
  return `${distancePart[0]!.toUpperCase()}${distancePart.slice(1)} ${action}${streetSuffix}`;
}
