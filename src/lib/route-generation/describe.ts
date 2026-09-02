import type { RouteCandidate, RouteSummaryView, SurfacePreference } from "@/lib/types";

export function toRouteSummaryView(candidate: RouteCandidate): RouteSummaryView {
  const total = candidate.surface.pavedMeters + candidate.surface.unpavedMeters + candidate.surface.unknownMeters;
  const pavedFraction = total > 0 ? candidate.surface.pavedMeters / total : 0;
  const unpavedFraction = total > 0 ? candidate.surface.unpavedMeters / total : 0;

  return {
    distanceMeters: candidate.distanceMeters,
    durationSeconds: candidate.durationSeconds,
    pavedFraction,
    unpavedFraction,
    elevation: candidate.elevation,
    description: buildRouteDescription(candidate, pavedFraction, unpavedFraction),
  };
}

function buildRouteDescription(candidate: RouteCandidate, pavedFraction: number, unpavedFraction: number): string {
  const km = Math.round((candidate.distanceMeters / 1000) * 10) / 10;

  let surfacePart: string;
  if (unpavedFraction >= 0.7) surfacePart = "grotendeels over onverharde paden";
  else if (pavedFraction >= 0.7) surfacePart = "grotendeels over verharde paden";
  else if (unpavedFraction + pavedFraction < 0.2) surfacePart = "over paden waarvan de ondergrond niet goed bekend is";
  else surfacePart = "over een mix van verharde en onverharde paden";

  let elevationPart = "";
  if (candidate.elevation && candidate.elevation.ascentMeters > 30) {
    elevationPart = candidate.elevation.ascentMeters > 100 ? ", met behoorlijk wat hoogteverschil" : ", met wat glooiing";
  }

  return `Rondwandeling van ${km.toString().replace(".", ",")} km, ${surfacePart}${elevationPart}.`;
}

export function surfacePreferenceLabel(pref: SurfacePreference): string {
  if (pref === "unpaved") return "voornamelijk onverhard";
  if (pref === "paved") return "voornamelijk verhard";
  return "gemengd";
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} u ${minutes.toString().padStart(2, "0")} min`;
}

export function formatDistanceKm(meters: number): string {
  return `${(Math.round((meters / 1000) * 10) / 10).toString().replace(".", ",")} km`;
}
