"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRouteSearch } from "@/hooks/useRouteSearch";
import { usePlannerStore } from "@/lib/state/planner-store";
import { useSettingsStore } from "@/lib/state/settings-store";
import { getVoiceGuide } from "@/lib/speech/voice";
import { routeCandidateGpxFileName, routeCandidateToGpx } from "@/lib/gpx/export";
import { RouteStatsCard } from "@/components/RouteStatsCard";
import type { DistanceTolerance, SurfacePreference } from "@/lib/types";
import type { RejectionCounts } from "@/lib/route-generation/engine";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

const NEXT_TOLERANCE: Record<DistanceTolerance, DistanceTolerance | null> = { 0.05: 0.1, 0.1: 0.15, 0.15: null };
const NEXT_SURFACE: Record<SurfacePreference, SurfacePreference> = { unpaved: "mixed", mixed: "paved", paved: "mixed" };
const SURFACE_LABEL: Record<SurfacePreference, string> = { unpaved: "onverhard", mixed: "gemengd", paved: "verhard" };

/**
 * Uitleg bij "geen route gevonden" op basis van de ECHTE afwijzingsredenen
 * (zie RejectionCounts in route-generation/engine.ts), i.p.v. altijd te
 * suggereren dat de routes "te weinig verschillen" — ook als het de eerste
 * zoekopdracht was of de afstand het probleem was.
 */
function describeNoRoute(counts: RejectionCounts | null, hasSeenRoutes: boolean): string {
  const base = hasSeenRoutes
    ? "Er is geen andere passende route gevonden."
    : "Er is geen passende route gevonden.";
  if (!counts) return `${base} Probeer een andere instelling of een ander startpunt.`;

  const reasons: string[] = [];
  if (counts.outsideDistanceMargin > 0) reasons.push("waren te lang of te kort voor de gekozen afstandsmarge");
  if (counts.tooSimilar > 0) reasons.push("leken te veel op routes die je al hebt gezien");
  if (counts.outAndBack > 0) reasons.push("gingen voor een te groot deel over hetzelfde pad heen en terug");
  if (reasons.length === 0) return `${base} Probeer een andere instelling of een ander startpunt.`;

  const reasonText =
    reasons.length === 1 ? reasons[0] : `${reasons.slice(0, -1).join(", ")} of ${reasons[reasons.length - 1]}`;
  return `${base} De routes die zijn geprobeerd ${reasonText}. Dat betekent niet dat er zeker geen route bestaat, wel dat het met deze instellingen lastig is.`;
}

export function ProposalScreen() {
  const router = useRouter();
  const { tryAnother, retryWithParams, isLoading } = useRouteSearch();
  const status = usePlannerStore((s) => s.status);
  const candidate = usePlannerStore((s) => s.currentCandidate);
  const params = usePlannerStore((s) => s.params);
  const errorMessage = usePlannerStore((s) => s.errorMessage);
  const clearRejectedHistory = usePlannerStore((s) => s.clearRejectedHistory);
  const rejectedGeometries = usePlannerStore((s) => s.rejectedGeometries);
  const lastRejectionCounts = usePlannerStore((s) => s.lastRejectionCounts);
  const previousCandidate = usePlannerStore((s) => s.previousCandidate);
  const restorePreviousCandidate = usePlannerStore((s) => s.restorePreviousCandidate);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const [accepted, setAccepted] = useState(false);

  function handleDownloadGpx() {
    if (!candidate || !params) return;
    const blob = new Blob([routeCandidateToGpx(candidate, { startLabel: params.startLabel })], {
      type: "application/gpx+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = routeCandidateGpxFileName(params.startLabel);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!params) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-bark-700">Er is nog geen zoekopdracht gestart.</p>
        <button
          onClick={() => router.push("/")}
          className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white"
        >
          Naar het zoekscherm
        </button>
      </main>
    );
  }

  if (status === "searching" || isLoading) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-moss-200 border-t-moss-700" aria-hidden />
        <p className="font-medium text-bark-800">Een passende rondwandeling zoeken…</p>
        <p className="text-sm text-bark-700">Dit kan enkele seconden duren.</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-semibold text-alert">Route zoeken is niet gelukt</p>
        <p className="text-sm text-bark-700">{errorMessage}</p>
        <button
          onClick={() => retryWithParams(params)}
          className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white"
        >
          Probeer opnieuw
        </button>
        <button onClick={() => router.push("/")} className="text-sm font-medium text-moss-700 underline">
          Terug naar zoekscherm
        </button>
      </main>
    );
  }

  if (status === "no_alternatives") {
    const nextTolerance = NEXT_TOLERANCE[params.tolerance];
    const hasSeenRoutes = rejectedGeometries.length > 0;
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <div className="rounded-xl border border-alert bg-alert-soft p-4">
          <p className="font-semibold text-bark-900">
            {hasSeenRoutes ? "Geen andere route gevonden" : "Geen passende route gevonden"}
          </p>
          <p className="mt-1 text-sm text-bark-800">{describeNoRoute(lastRejectionCounts, hasSeenRoutes)}</p>
        </div>

        <div className="flex flex-col gap-3">
          {previousCandidate && (
            <button
              onClick={() => restorePreviousCandidate()}
              className="tap-target rounded-lg bg-moss-700 px-4 py-3 text-left font-semibold text-white"
            >
              ↩️ Terug naar de vorige route
            </button>
          )}
          {nextTolerance && (
            <button
              onClick={() => retryWithParams({ ...params, tolerance: nextTolerance })}
              className="tap-target rounded-lg bg-moss-600 px-4 py-3 text-left font-semibold text-white"
            >
              Vergroot de afstandsmarge naar {Math.round(nextTolerance * 100)}%
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
          >
            Kies een ander startpunt
          </button>
          <button
            onClick={() => retryWithParams({ ...params, surfacePreference: NEXT_SURFACE[params.surfacePreference] })}
            className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
          >
            Probeer ondergrond &quot;{SURFACE_LABEL[NEXT_SURFACE[params.surfacePreference]]}&quot;
          </button>
          {hasSeenRoutes && (
            <button
              onClick={() => {
                clearRejectedHistory();
                retryWithParams(params);
              }}
              className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
            >
              Begin opnieuw (ook eerder afgewezen routes mogen weer voorgesteld worden)
            </button>
          )}
          {!hasSeenRoutes && (
            <button
              onClick={() => retryWithParams(params)}
              className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
            >
              Nog een keer proberen
            </button>
          )}
        </div>
      </main>
    );
  }

  if (status === "provider_unavailable") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <div className="rounded-xl border border-alert bg-alert-soft p-4">
          <p className="font-semibold text-bark-900">De routeplanner reageert niet</p>
          <p className="mt-1 text-sm text-bark-800">
            Er kon geen contact worden gemaakt met de routingdienst die de wandelroutes berekent. Dit ligt niet aan je
            zoekopdracht (afstand, startpunt of voorkeuren) — waarschijnlijk is de dienst tijdelijk overbelast of niet
            bereikbaar. Probeer het over een paar minuten opnieuw.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => retryWithParams(params)}
            className="tap-target rounded-lg bg-moss-600 px-4 py-3 text-left font-semibold text-white"
          >
            Probeer opnieuw
          </button>
          <button
            onClick={() => router.push("/")}
            className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
          >
            Terug naar zoekscherm
          </button>
        </div>
      </main>
    );
  }

  if (!candidate) return null;

  return (
    <main className="flex flex-1 flex-col">
      <div className="h-[45vh] min-h-[280px] w-full bg-moss-100">
        <MapView routeGeometry={candidate.geometry} startPoint={params.start} />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <RouteStatsCard candidate={candidate} />

        <button
          type="button"
          onClick={handleDownloadGpx}
          className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
        >
          ⬇️ Exporteer deze route als GPX
        </button>

        {!accepted ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setAccepted(true)}
              className="tap-target rounded-xl bg-moss-700 px-4 py-4 text-lg font-bold text-white shadow-md"
            >
              ✅ Deze route wandelen
            </button>
            <button
              onClick={() => tryAnother()}
              className="tap-target rounded-xl border border-moss-300 px-4 py-3 font-semibold text-moss-700"
            >
              🔄 Andere route zoeken
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg bg-moss-50 px-3 py-2 text-sm text-moss-800">Deze route is geselecteerd.</p>
            <button
              onClick={() => {
                // Sommige browsers (met name Safari/iOS) spelen gesproken tekst
                // alleen af als de allereerste speak()-aanroep synchroon binnen
                // een echte tik/klik gebeurt. Latere, automatische aanroepen
                // (bij gps-updates op het navigatiescherm) werken daarna vanzelf
                // mee — mits dit hier al één keer is gebeurd. Zonder deze regel
                // blijft spraaknavigatie op sommige telefoons stil, ook al staat
                // de instelling gewoon aan.
                if (voiceEnabled) {
                  getVoiceGuide().setEnabled(true);
                  getVoiceGuide().speak("Spraaknavigatie gestart.");
                }
                router.push("/navigeren");
              }}
              className="tap-target rounded-xl bg-moss-700 px-4 py-4 text-lg font-bold text-white shadow-md"
            >
              🚶 Nu vertrekken
            </button>
            <button onClick={() => setAccepted(false)} className="text-sm font-medium text-moss-700 underline">
              Toch een andere route kiezen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
