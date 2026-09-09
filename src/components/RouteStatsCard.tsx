import type { RouteCandidate } from "@/lib/types";
import { formatDistanceKm, formatDuration, toRouteSummaryView } from "@/lib/route-generation/describe";

interface TrafficAvoidanceNotice {
  tone: "success" | "warning" | "info";
  text: string;
}

/**
 * Bouwt de gebruikerstekst voor de voorkeur "vermijd stoplichten en drukke
 * oversteekplaatsen", in drie mogelijke situaties (zie ook
 * src/lib/geo/traffic-avoidance.ts): volledig vermeden, niet volledig
 * vermeden (met de meerkosten in afstand/tijd), of onvolledige kaartgegevens
 * — nooit een garantie geven die de onderliggende data niet waarmaakt.
 */
function describeTrafficAvoidance(candidate: RouteCandidate): TrafficAvoidanceNotice | null {
  const summary = candidate.trafficAvoidance;
  if (!summary || !summary.requested) return null;

  if (!summary.dataComplete) {
    return {
      tone: "warning",
      text: "De kaartgegevens over stoplichten en drukke wegen konden niet volledig worden opgehaald voor dit gebied. Deze route is gekozen op basis van je andere voorkeuren; we kunnen niet garanderen dat stoplichten of grote oversteken zijn vermeden.",
    };
  }

  if (summary.trafficLightCount === 0 && summary.majorRoadCrossingCount === 0) {
    return {
      tone: "success",
      text: "Deze route vermijdt stoplichten en gelijkvloerse oversteken van grote wegen, voor zover de kaartgegevens dat konden bepalen.",
    };
  }

  const parts: string[] = [];
  if (summary.trafficLightCount > 0) {
    parts.push(`${summary.trafficLightCount} stoplicht${summary.trafficLightCount === 1 ? "" : "en"}`);
  }
  if (summary.majorRoadCrossingCount > 0) {
    parts.push(
      `${summary.majorRoadCrossingCount} gelijkvloerse oversteek${summary.majorRoadCrossingCount === 1 ? "" : "en"} van een grote weg`,
    );
  }

  const extraParts: string[] = [];
  if (summary.extraDistanceMeters > 0) extraParts.push(`+${formatDistanceKm(summary.extraDistanceMeters)}`);
  if (summary.extraDurationSeconds > 0) extraParts.push(`+${formatDuration(summary.extraDurationSeconds)}`);
  const extraText = extraParts.length > 0 ? ` Dit kost ongeveer ${extraParts.join(", ")} extra t.o.v. de beste route zonder deze voorkeur.` : "";

  return {
    tone: "warning",
    text: `Volledig vermijden was hier niet mogelijk: deze route bevat naar schatting ${parts.join(" en ")}.${extraText}`,
  };
}

export function RouteStatsCard({ candidate }: { candidate: RouteCandidate }) {
  const view = toRouteSummaryView(candidate);
  const pavedPct = Math.round(view.pavedFraction * 100);
  const unpavedPct = Math.round(view.unpavedFraction * 100);
  const unknownPct = Math.max(0, 100 - pavedPct - unpavedPct);
  const trafficNotice = describeTrafficAvoidance(candidate);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
      <p className="text-sm text-bark-700">{view.description}</p>

      {trafficNotice && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${
            trafficNotice.tone === "success" ? "bg-moss-50 text-moss-800" : "bg-alert-soft text-bark-900"
          }`}
        >
          {trafficNotice.tone === "success" ? "🟢 " : "⚠️ "}
          {trafficNotice.text}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-bark-700/70">Afstand</dt>
          <dd className="text-xl font-bold text-moss-800">{formatDistanceKm(view.distanceMeters)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-bark-700/70">Geschatte tijd</dt>
          <dd className="text-xl font-bold text-moss-800">{formatDuration(view.durationSeconds)}</dd>
        </div>
        {view.elevation && (
          <div className="col-span-2 flex gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-bark-700/70">Stijgen</dt>
              <dd className="font-semibold text-bark-900">↗ {Math.round(view.elevation.ascentMeters)} m</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-bark-700/70">Dalen</dt>
              <dd className="font-semibold text-bark-900">↘ {Math.round(view.elevation.descentMeters)} m</dd>
            </div>
          </div>
        )}
      </dl>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-bark-700/70">Ondergrond</p>
        <div className="mt-1 flex h-3 w-full overflow-hidden rounded-full bg-moss-100" role="img" aria-label={`${unpavedPct}% onverhard, ${pavedPct}% verhard`}>
          {unpavedPct > 0 && <div style={{ width: `${unpavedPct}%` }} className="h-full bg-trail-unpaved" />}
          {pavedPct > 0 && <div style={{ width: `${pavedPct}%` }} className="h-full bg-trail-paved" />}
        </div>
        <div className="mt-1 flex justify-between text-xs text-bark-700">
          <span>🟤 Onverhard {unpavedPct}%</span>
          <span>⬜ Verhard {pavedPct}%</span>
          {unknownPct > 0 && <span>Onbekend {unknownPct}%</span>}
        </div>
      </div>
    </div>
  );
}
