import type { LngLat, RouteCandidate, WalkRecord } from "@/lib/types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function trackToXml(points: LngLat[]): string {
  return points.map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`).join("\n");
}

/**
 * Bouwt een GPX 1.1-bestand met twee tracks: de geplande route en (indien
 * aanwezig) het daadwerkelijk gelopen GPS-traject. Handmatig XML opbouwen i.p.v.
 * een library gebruiken, want GPX is een simpel, stabiel formaat en dit
 * voorkomt een extra dependency voor iets triviaals.
 */
export function walkToGpx(walk: WalkRecord): string {
  const name = escapeXml(`Wandeling ${new Date(walk.date).toLocaleDateString("nl-NL")} - ${walk.startLabel}`);

  const actualTrack =
    walk.actualTrack.length > 1
      ? `
    <trk>
      <name>Daadwerkelijk gelopen traject</name>
      <trkseg>
${trackToXml(walk.actualTrack)}
      </trkseg>
    </trk>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wandelroute Explorer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${walk.date}</time>
  </metadata>
  <trk>
    <name>Geplande route</name>
    <trkseg>
${trackToXml(walk.plannedRoute)}
    </trkseg>
  </trk>${actualTrack}
</gpx>`;
}

export function gpxFileName(walk: WalkRecord): string {
  const date = walk.date.slice(0, 10);
  return `wandeling-${date}-${walk.id.slice(0, 8)}.gpx`;
}

function slugifyForFileName(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diakrieten (bv. "e-accent" -> "e") weghalen
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "wandelroute";
}

/**
 * Bouwt een GPX-bestand voor een nog niet-gelopen routevoorstel (op het
 * voorstelscherm, vóórdat iemand op "Nu vertrekken" drukt) — in tegenstelling
 * tot `walkToGpx` is er dan nog geen opgeslagen WalkRecord (geen id, geen
 * daadwerkelijk gelopen traject), dus alleen de geplande route wordt
 * geëxporteerd.
 */
export function routeCandidateToGpx(candidate: RouteCandidate, meta: { startLabel: string; date?: Date }): string {
  const date = meta.date ?? new Date();
  const name = escapeXml(`Wandelroute vanaf ${meta.startLabel}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wandelroute Explorer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${date.toISOString()}</time>
  </metadata>
  <trk>
    <name>Geplande route</name>
    <trkseg>
${trackToXml(candidate.geometry)}
    </trkseg>
  </trk>
</gpx>`;
}

export function routeCandidateGpxFileName(startLabel: string, date: Date = new Date()): string {
  const isoDate = date.toISOString().slice(0, 10);
  return `wandelroute-${isoDate}-${slugifyForFileName(startLabel)}.gpx`;
}
