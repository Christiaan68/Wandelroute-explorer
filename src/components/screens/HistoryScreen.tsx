"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceKm, formatDuration } from "@/lib/route-generation/describe";
import { usePlannerStore } from "@/lib/state/planner-store";
import { getWalksRepository } from "@/lib/storage/walks-repository";
import type { WalkRecord } from "@/lib/types";

export function HistoryScreen() {
  const router = useRouter();
  const resumeFromWalk = usePlannerStore((s) => s.resumeFromWalk);
  const [walks, setWalks] = useState<WalkRecord[] | null>(null);

  async function refresh() {
    setWalks(await getWalksRepository().getAll());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Deze wandeling verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    await getWalksRepository().remove(id);
    await refresh();
  }

  function handleWalkAgain(walk: WalkRecord) {
    resumeFromWalk(walk);
    router.push("/voorstel");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
      <header className="safe-top pt-2">
        <h1 className="text-2xl font-bold text-moss-800">Mijn wandelingen</h1>
        <p className="text-sm text-bark-700">Je eerdere wandelingen, lokaal opgeslagen op dit toestel.</p>
      </header>

      {walks === null && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-moss-200 border-t-moss-700" aria-hidden />
        </div>
      )}

      {walks?.length === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-bark-700 shadow-sm ring-1 ring-moss-100">
          Je hebt nog geen wandelingen voltooid. Zoek een route om te beginnen.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {walks?.map((walk) => (
          <li key={walk.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    walk.status === "completed" ? "bg-moss-100 text-moss-800" : "bg-alert-soft text-alert"
                  }`}
                >
                  {walk.status === "completed" ? "Voltooid" : "Voortijdig beëindigd"}
                </span>
                <p className="mt-1 font-semibold text-bark-900">
                  {new Date(walk.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p className="text-sm text-bark-700">
                  {formatDistanceKm(walk.actualDistanceMeters)} · {formatDuration(walk.durationSeconds)} · vanaf{" "}
                  {walk.startLabel}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/samenvatting?walkId=${encodeURIComponent(walk.id)}`)}
                className="tap-target rounded-lg bg-moss-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Bekijk op kaart
              </button>
              <button
                onClick={() => handleWalkAgain(walk)}
                className="tap-target rounded-lg border border-moss-300 px-3 py-2 text-sm font-semibold text-moss-700"
              >
                Opnieuw wandelen
              </button>
              <button
                onClick={() => handleDelete(walk.id)}
                className="tap-target rounded-lg border border-alert/40 px-3 py-2 text-sm font-semibold text-alert"
              >
                Verwijderen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
