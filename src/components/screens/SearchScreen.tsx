"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGeocode } from "@/lib/api-client";
import { getCurrentPositionOnce } from "@/hooks/useGeolocation";
import { useRouteSearch } from "@/hooks/useRouteSearch";
import { clearActiveWalk, loadActiveWalk, type ActiveWalkSnapshot } from "@/lib/storage/active-walk-journal";
import type { Coordinate, DistanceTolerance, GeocodeResult, SurfacePreference } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const DISTANCE_PRESETS_METERS = [5000, 10000, 15000];
const MIN_DISTANCE_METERS = 500;
const MAX_DISTANCE_METERS = 60000;
type DistanceUnit = "km" | "m";

function formatDistanceForUnit(meters: number, unit: DistanceUnit): string {
  return unit === "km" ? String(roundTo(meters / 1000, 2)) : String(Math.round(meters));
}
const TOLERANCE_OPTIONS: { value: DistanceTolerance; label: string }[] = [
  { value: 0.05, label: "5%" },
  { value: 0.1, label: "10%" },
  { value: 0.15, label: "15%" },
];
const SURFACE_OPTIONS: { value: SurfacePreference; label: string; hint: string }[] = [
  { value: "unpaved", label: "Onverhard", hint: "Voornamelijk paden door bos, veld of langs water" },
  { value: "mixed", label: "Gemengd", hint: "Een mix van verharde en onverharde paden" },
  { value: "paved", label: "Verhard", hint: "Voornamelijk asfalt- en tegelpaden" },
];

export function SearchScreen() {
  const router = useRouter();
  const { search, isLoading } = useRouteSearch();

  // Canonieke waarde is altijd in meters; distanceUnit bepaalt alleen hoe het invoerveld
  // wordt getoond/ingevuld, zodat je zonder omrekenen ook een exacte waarde als 3750 m kunt intypen.
  const [distanceMeters, setDistanceMeters] = useState(5000);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  // Aparte tekst-state voor het invoerveld: zo kan het veld leeggemaakt/overtypt
  // worden zonder dat elke toetsaanslag meteen wordt "teruggezet" naar de vorige
  // geldige waarde. Voorheen werd de waarde van het veld rechtstreeks uit
  // distanceMeters herberekend; zodra je alles weghaalde werd parseFloat("") de
  // ongeldige waarde NaN, de state werd dan niet bijgewerkt, en React zette het
  // veld dus meteen terug naar het oude cijfer — het leek dan of je de "5" niet
  // kon weghalen.
  const [distanceInputText, setDistanceInputText] = useState(() => formatDistanceForUnit(5000, "km"));
  const [tolerance, setTolerance] = useState<DistanceTolerance>(0.1);
  const [surfacePreference, setSurfacePreference] = useState<SurfacePreference>("unpaved");

  const [startCoordinate, setStartCoordinate] = useState<Coordinate | null>(null);
  const [startLabel, setStartLabel] = useState<string>("");
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [interrupted, setInterrupted] = useState<ActiveWalkSnapshot | null>(null);
  useEffect(() => {
    setInterrupted(loadActiveWalk());
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleAddressChange(value: string) {
    setAddressQuery(value);
    setStartCoordinate(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setSuggestions(await apiGeocode(value));
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }

  async function handleUseCurrentLocation() {
    setFormError(null);
    setLocating(true);
    try {
      const coord = await getCurrentPositionOnce();
      setStartCoordinate(coord);
      setStartLabel("Huidige locatie");
      setAddressQuery("");
      setSuggestions([]);
      setShowMapPicker(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  function handlePickSuggestion(result: GeocodeResult) {
    setStartCoordinate(result.coordinate);
    setStartLabel(result.label);
    setAddressQuery(result.label);
    setSuggestions([]);
  }

  function handleMapClick(coord: Coordinate) {
    setStartCoordinate(coord);
    setStartLabel(`Gekozen locatie (${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)})`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!startCoordinate) {
      setFormError("Kies eerst een startpunt: gebruik je huidige locatie, zoek een adres of kies een punt op de kaart.");
      return;
    }
    if (!distanceMeters || distanceMeters < MIN_DISTANCE_METERS || distanceMeters > MAX_DISTANCE_METERS) {
      setFormError(
        `Kies een wandelafstand tussen ${MIN_DISTANCE_METERS} m en ${MAX_DISTANCE_METERS / 1000} km.`,
      );
      return;
    }

    await search({
      targetDistanceMeters: distanceMeters,
      tolerance,
      start: startCoordinate,
      surfacePreference,
      startLabel: startLabel || "Gekozen startpunt",
    });
    router.push("/voorstel");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 pb-8">
      <header className="safe-top pt-2">
        <h1 className="text-2xl font-bold text-moss-800">Wandelroute Explorer</h1>
        <p className="mt-1 text-sm text-bark-700">Vind een rondwandeling op de afstand die jij kiest.</p>
      </header>

      {interrupted && (
        <div className="rounded-xl border border-alert bg-alert-soft p-4 text-sm text-bark-900">
          <p className="font-semibold">Je hebt een onderbroken wandeling</p>
          <p className="mt-1">
            Gestart op {new Date(interrupted.startedAt).toLocaleString("nl-NL")} vanaf {interrupted.startLabel}. Wil je
            deze afronden of verwijderen?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/navigeren?resume=1")}
              className="tap-target rounded-lg bg-moss-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Verder wandelen
            </button>
            <button
              type="button"
              onClick={() => {
                clearActiveWalk();
                setInterrupted(null);
              }}
              className="tap-target rounded-lg border border-bark-700/30 px-3 py-2 text-sm font-semibold text-bark-800"
            >
              Verwijderen
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section aria-labelledby="afstand-label" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
          <h2 id="afstand-label" className="text-base font-semibold text-moss-800">
            Gewenste afstand
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              min={distanceUnit === "km" ? MIN_DISTANCE_METERS / 1000 : MIN_DISTANCE_METERS}
              max={distanceUnit === "km" ? MAX_DISTANCE_METERS / 1000 : MAX_DISTANCE_METERS}
              step={distanceUnit === "km" ? 0.1 : 50}
              value={distanceInputText}
              onChange={(e) => {
                const raw = e.target.value;
                // Altijd de ruwe tekst tonen (ook leeg of half getypt), anders
                // "springt" het veld terug naar de vorige waarde en kan je een
                // cijfer niet weghalen om iets nieuws te typen.
                setDistanceInputText(raw);
                const value = parseFloat(raw);
                if (Number.isNaN(value)) return;
                setDistanceMeters(distanceUnit === "km" ? value * 1000 : value);
              }}
              onBlur={() => {
                // Veld leeg of ongeldig achtergelaten bij het verlaten van het veld?
                // Terugzetten naar de laatst geldige waarde.
                setDistanceInputText(formatDistanceForUnit(distanceMeters, distanceUnit));
              }}
              aria-label={`Gewenste afstand in ${distanceUnit === "km" ? "kilometers" : "meters"}`}
              className="tap-target w-28 rounded-lg border border-moss-200 px-3 py-2 text-lg font-semibold"
            />
            <div className="flex overflow-hidden rounded-lg border border-moss-200" role="group" aria-label="Eenheid">
              {(["km", "m"] as DistanceUnit[]).map((unit) => (
                <button
                  type="button"
                  key={unit}
                  onClick={() => {
                    setDistanceUnit(unit);
                    setDistanceInputText(formatDistanceForUnit(distanceMeters, unit));
                  }}
                  aria-pressed={distanceUnit === unit}
                  className={`tap-target px-3 py-2 text-sm font-semibold ${
                    distanceUnit === unit ? "bg-moss-600 text-white" : "bg-white text-moss-700"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {DISTANCE_PRESETS_METERS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setDistanceMeters(preset);
                    setDistanceInputText(formatDistanceForUnit(preset, distanceUnit));
                  }}
                  className={`tap-target rounded-lg px-3 py-2 text-sm font-medium ${
                    distanceMeters === preset ? "bg-moss-600 text-white" : "bg-moss-50 text-moss-700"
                  }`}
                >
                  {preset / 1000} km
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-bark-700/70">
            Bijvoorbeeld 3750 m: kies &quot;m&quot; als eenheid en typ 3750 in.
          </p>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-bark-700">Toegestane afwijking</legend>
            <div className="mt-2 flex gap-2">
              {TOLERANCE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setTolerance(opt.value)}
                  aria-pressed={tolerance === opt.value}
                  className={`tap-target flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    tolerance === opt.value ? "bg-moss-600 text-white" : "bg-moss-50 text-moss-700"
                  }`}
                >
                  Max. {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="startpunt-label" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
          <h2 id="startpunt-label" className="text-base font-semibold text-moss-800">
            Startpunt
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="tap-target rounded-lg bg-moss-600 px-4 py-3 text-left font-semibold text-white disabled:opacity-60"
            >
              {locating ? "Locatie bepalen…" : "📍 Gebruik mijn huidige locatie"}
            </button>

            <div className="relative">
              <label htmlFor="address" className="text-sm font-medium text-bark-700">
                Of zoek een adres/plaats
              </label>
              <input
                id="address"
                type="text"
                value={addressQuery}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Bijv. Dorpsstraat 1, Amersfoort"
                className="tap-target mt-1 w-full rounded-lg border border-moss-200 px-3 py-2"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-moss-200 bg-white shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.label}>
                      <button
                        type="button"
                        onClick={() => handlePickSuggestion(s)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-moss-50"
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMapPicker((v) => !v)}
              className="tap-target self-start rounded-lg border border-moss-300 px-3 py-2 text-sm font-medium text-moss-700"
            >
              {showMapPicker ? "Verberg kaart" : "🗺️ Kies een punt op de kaart"}
            </button>

            {showMapPicker && (
              <div className="h-64 overflow-hidden rounded-lg bg-moss-100 ring-1 ring-moss-200">
                <MapView startPoint={startCoordinate ?? undefined} onMapClick={handleMapClick} />
              </div>
            )}

            {startCoordinate && (
              <p className="rounded-lg bg-moss-50 px-3 py-2 text-sm text-moss-800">
                Startpunt: <strong>{startLabel}</strong>
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="ondergrond-label" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
          <h2 id="ondergrond-label" className="text-base font-semibold text-moss-800">
            Voorkeur ondergrond
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {SURFACE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  surfacePreference === opt.value ? "border-moss-500 bg-moss-50" : "border-moss-100"
                }`}
              >
                <input
                  type="radio"
                  name="surface"
                  value={opt.value}
                  checked={surfacePreference === opt.value}
                  onChange={() => setSurfacePreference(opt.value)}
                  className="mt-1 h-5 w-5"
                />
                <span>
                  <span className="block font-medium text-bark-900">{opt.label}</span>
                  <span className="block text-sm text-bark-700">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {formError && (
          <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm font-medium text-alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="tap-target rounded-xl bg-moss-700 px-4 py-4 text-lg font-bold text-white shadow-md disabled:opacity-60"
        >
          {isLoading ? "Route zoeken…" : "Zoek een wandelroute"}
        </button>
      </form>
    </main>
  );
}
