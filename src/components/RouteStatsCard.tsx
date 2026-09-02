import type { RouteCandidate } from "@/lib/types";
import { formatDistanceKm, formatDuration, toRouteSummaryView } from "@/lib/route-generation/describe";

export function RouteStatsCard({ candidate }: { candidate: RouteCandidate }) {
  const view = toRouteSummaryView(candidate);
  const pavedPct = Math.round(view.pavedFraction * 100);
  const unpavedPct = Math.round(view.unpavedFraction * 100);
  const unknownPct = Math.max(0, 100 - pavedPct - unpavedPct);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
      <p className="text-sm text-bark-700">{view.description}</p>

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
