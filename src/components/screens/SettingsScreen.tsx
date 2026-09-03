"use client";

import { useState } from "react";
import { useSettingsStore } from "@/lib/state/settings-store";
import { getWalksRepository } from "@/lib/storage/walks-repository";
import { clearActiveWalk } from "@/lib/storage/active-walk-journal";

export function SettingsScreen() {
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const keepAwake = useSettingsStore((s) => s.keepScreenAwakeDuringWalk);
  const setKeepAwake = useSettingsStore((s) => s.setKeepScreenAwakeDuringWalk);
  const [cleared, setCleared] = useState(false);

  async function handleClearAllData() {
    if (!window.confirm("Alle lokaal opgeslagen wandelingen en instellingen verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      return;
    }
    const walks = await getWalksRepository().getAll();
    await Promise.all(walks.map((w) => getWalksRepository().remove(w.id)));
    clearActiveWalk();
    window.localStorage.removeItem("wandelroute-explorer:settings");
    setCleared(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4">
      <header className="safe-top pt-2">
        <h1 className="text-2xl font-bold text-moss-800">Instellingen &amp; privacy</h1>
      </header>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
        <h2 className="text-base font-semibold text-moss-800">Navigatie</h2>
        <label className="mt-3 flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium text-bark-900">Gesproken instructies</span>
            <span className="block text-sm text-bark-700">Afslag-instructies ook hardop laten voorlezen.</span>
          </span>
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(e) => setVoiceEnabled(e.target.checked)}
            className="h-6 w-6"
            aria-label="Gesproken instructies aan of uit"
          />
        </label>
        <label className="mt-4 flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium text-bark-900">Scherm aan houden tijdens wandeling</span>
            <span className="block text-sm text-bark-700">Voorkomt dat het scherm uitgaat tijdens navigatie.</span>
          </span>
          <input
            type="checkbox"
            checked={keepAwake}
            onChange={(e) => setKeepAwake(e.target.checked)}
            className="h-6 w-6"
            aria-label="Scherm aan houden tijdens wandeling"
          />
        </label>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
        <h2 className="text-base font-semibold text-moss-800">Privacy &amp; locatiegegevens</h2>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm text-bark-700">
          <li>Je locatie wordt alleen gebruikt om je positie op de kaart te tonen en afslag-instructies te geven.</li>
          <li>Locatiegegevens en je wandelgeschiedenis worden alleen lokaal op dit toestel opgeslagen (in je browser) en niet naar externe servers verstuurd of daar bewaard, behalve de routeaanvraag zelf die nodig is om een route te berekenen.</li>
          <li>Gps-toestemming wordt pas gevraagd op het moment dat je op &quot;Nu vertrekken&quot; drukt.</li>
          <li>Je kunt alle lokaal opgeslagen gegevens hieronder in één keer verwijderen.</li>
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
        <h2 className="text-base font-semibold text-moss-800">Belangrijk om te weten</h2>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm text-bark-700">
          <li>Je bent zelf verantwoordelijk voor de veiligheid en toegankelijkheid van de wegen en paden die je loopt.</li>
          <li>Kaartgegevens, ondergrondinformatie en route-instructies zijn afkomstig van OpenStreetMap en een routingdienst en kunnen onvolledig, onnauwkeurig of verouderd zijn.</li>
          <li>Gps-signaal en internetverbinding kunnen tijdens het wandelen wegvallen; eenmaal geladen routegegevens blijven zoveel mogelijk beschikbaar, maar het herberekenen van een nieuwe route vereist internetverbinding.</li>
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
        <h2 className="text-base font-semibold text-moss-800">Gegevensbeheer</h2>
        <button
          onClick={handleClearAllData}
          className="tap-target mt-3 rounded-lg border border-alert/40 px-4 py-2 font-semibold text-alert"
        >
          Verwijder alle lokale gegevens
        </button>
        {cleared && <p className="mt-2 text-sm text-moss-700">Alle lokale gegevens zijn verwijderd.</p>}
      </section>

      <footer className="pb-4 pt-2 text-center text-xs text-bark-700/70">© 2026 I.H.C. ten Haaken</footer>
    </main>
  );
}
