"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceKm, formatDuration } from "@/lib/route-generation/describe";
import { usePlannerStore } from "@/lib/state/planner-store";
import { gpxFileName, walkToGpx } from "@/lib/gpx/export";
import { getWalksRepository } from "@/lib/storage/walks-repository";
import type { WalkRecord } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

export function SummaryScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const walkId = searchParams.get("walkId");
  const resumeFromWalk = usePlannerStore((s) => s.resumeFromWalk);

  const [walk, setWalk] = useState<WalkRecord | null | "not-found">(null);

  useEffect(() => {
    if (!walkId) {
      setWalk("not-found");
      return;
    }
    getWalksRepository()
      .getById(walkId)
      .then((w) => setWalk(w ?? "not-found"))
      .catch(() => setWalk("not-found"));
  }, [walkId]);

  if (walk === "not-found") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-bark-700">Deze wandeling kon niet worden gevonden.</p>
        <button onClick={() => router.push("/")} className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white">
          Naar het zoekscherm
        </button>
      </main>
    );
  }

  if (!walk) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-moss-200 border-t-moss-700" aria-hidden />
      </main>
    );
  }

  const distanceDelta = walk.actualDistanceMeters - walk.plannedDistanceMeters;

  function handleDownloadGpx() {
    if (!walk || walk === "not-found") return;
    const blob = new Blob([walkToGpx(walk)], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = gpxFileName(walk);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleWalkAgain() {
    if (!walk || walk === "not-found") return;
    resumeFromWalk(walk);
    router.push("/voorstel");
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="h-[35vh] min-h-[220px] w-full">
        <MapView routeGeometry={walk.plannedRoute} traveledGeometry={walk.actualTrack} startPoint={walk.start} />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <div>
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              walk.status === "completed" ? "bg-moss-100 text-moss-800" : "bg-alert-soft text-alert"
            }`}
          >
            {walk.status === "completed" ? "Voltooid" : "Voortijdig beëindigd"}
          </span>
          <h1 className="mt-2 text-xl font-bold text-moss-800">
            Wandeling van {new Date(walk.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
          </h1>
          <p className="text-sm text-bark-700">Vanaf {walk.startLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
          <Stat label="Gelopen afstand" value={formatDistanceKm(walk.actualDistanceMeters)} />
          <Stat label="Geplande afstand" value={formatDistanceKm(walk.plannedDistanceMeters)} />
          <Stat label="Totale tijd" value={formatDuration(walk.durationSeconds)} />
          <Stat label="Gem. snelheid" value={`${walk.averageSpeedKmh.toFixed(1)} km/u`} />
        </div>

        {Math.abs(distanceDelta) > 100 && (
          <p className="text-sm text-bark-700">
            {distanceDelta > 0
              ? `Je liep ${formatDistanceKm(distanceDelta)} meer dan gepland (bv. door omlopen bij een afwijking).`
              : `Je liep ${formatDistanceKm(-distanceDelta)} minder dan gepland.`}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleWalkAgain}
            className="tap-target rounded-xl bg-moss-700 px-4 py-3 font-semibold text-white shadow-md"
          >
            🔁 Wandel deze route opnieuw
          </button>
          <button
            onClick={handleDownloadGpx}
            className="tap-target rounded-xl border border-moss-300 px-4 py-3 font-semibold text-moss-700"
          >
            ⬇️ Exporteer als GPX
          </button>
          <button
            onClick={() => router.push("/geschiedenis")}
            className="tap-target rounded-xl border border-moss-300 px-4 py-3 font-semibold text-moss-700"
          >
            📜 Naar mijn wandelingen
          </button>
          <button onClick={() => router.push("/")} className="text-sm font-medium text-moss-700 underline">
            Nieuwe wandeling zoeken
          </button>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-bark-700/70">{label}</dt>
      <dd className="text-lg font-bold text-moss-800">{value}</dd>
    </div>
  );
}
