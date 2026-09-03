"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRouteSearch } from "@/hooks/useRouteSearch";
import { usePlannerStore } from "@/lib/state/planner-store";
import { useSettingsStore } from "@/lib/state/settings-store";
import { getVoiceGuide } from "@/lib/speech/voice";
import { RouteStatsCard } from "@/components/RouteStatsCard";
import type { DistanceTolerance, SurfacePreference } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

const NEXT_TOLERANCE: Record<DistanceTolerance, DistanceTolerance | null> = { 0.05: 0.1, 0.1: 0.15, 0.15: null };
const NEXT_SURFACE: Record<SurfacePreference, SurfacePreference> = { unpaved: "mixed", mixed: "paved", paved: "mixed" };

export function ProposalScreen() {
  const router = useRouter();
  const { tryAnother, retryWithParams, isLoading } = useRouteSearch();
  const status = usePlannerStore((s) => s.status);
  const candidate = usePlannerStore((s) => s.currentCandidate);
  const params = usePlannerStore((s) => s.params);
  const errorMessage = usePlannerStore((s) => s.errorMessage);
  const clearRejectedHistory = usePlannerStore((s) => s.clearRejectedHistory);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const [accepted, setAccepted] = useState(false);

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
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <div className="rounded-xl border border-alert bg-alert-soft p-4">
          <p className="font-semibold text-bark-900">Geen voldoende verschillende route meer gevonden</p>
          <p className="mt-1 text-sm text-bark-800">
            Binnen de ingestelde afstandsmarge en een redelijk aantal pogingen kon geen route worden gevonden die
            genoeg verschilt van de routes die je al hebt gezien. Dit betekent niet dat er zeker geen enkele route
            meer bestaat — routingdiensten kunnen dat niet garanderen — maar wel dat verder zoeken met deze
            instellingen weinig kans van slagen heeft.
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
            Pas de ondergrondvoorkeur aan (naar &quot;{NEXT_SURFACE[params.surfacePreference]}&quot;)
          </button>
          <button
            onClick={() => {
              clearRejectedHistory();
              retryWithParams(params);
            }}
            className="tap-target rounded-lg border border-moss-300 px-4 py-3 text-left font-semibold text-moss-700"
          >
            Begin opnieuw (ook eerder afgewezen routes mogen weer voorgesteld worden)
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
