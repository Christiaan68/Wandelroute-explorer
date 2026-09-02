import type { LngLat, WalkRecord } from "@/lib/types";

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
