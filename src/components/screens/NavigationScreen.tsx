"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InstructionBanner } from "@/components/InstructionBanner";
import { useGeolocation, type GeolocationFix } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { apiGenerateRoute } from "@/lib/api-client";
import {
  averageSpeedKmh,
  computeRouteProgress,
  OffRouteDetector,
  SpeechRepeatGuard,
} from "@/lib/geo/navigation-engine";
import { buildSpokenInstruction } from "@/lib/routing/instruction-text";
import { usePlannerStore } from "@/lib/state/planner-store";
import { useSettingsStore } from "@/lib/state/settings-store";
import { getVoiceGuide } from "@/lib/speech/voice";
import { clearActiveWalk, loadActiveWalk, saveActiveWalk } from "@/lib/storage/active-walk-journal";
import { getWalksRepository } from "@/lib/storage/walks-repository";
import type { Coordinate, LngLat, RouteCandidate, SurfacePreference, WalkRecord } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), { ssr: false });

const MIN_TRACK_POINT_SPACING_METERS = 8;
const JOURNAL_SAVE_INTERVAL_MS = 10000;

interface ActiveWalkContext {
  start: Coordinate;
  startLabel: string;
  surfacePreference: SurfacePreference;
  route: RouteCandidate;
  startedAt: string;
  initialTrack: LngLat[];
}

export function NavigationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isResume = searchParams.get("resume") === "1";

  const params = usePlannerStore((s) => s.params);
  const candidate = usePlannerStore((s) => s.currentCandidate);
  const plannerReset = usePlannerStore((s) => s.reset);

  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const keepAwake = useSettingsStore((s) => s.keepScreenAwakeDuringWalk);

  const [context, setContext] = useState<ActiveWalkContext | null | "not-found">(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [track, setTrack] = useState<LngLat[]>([]);
  const [currentFix, setCurrentFix] = useState<GeolocationFix | null>(null);
  const [offRouteWarning, setOffRouteWarning] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [finished, setFinished] = useState(false);

  const offRouteDetector = useRef(new OffRouteDetector(3));
  const speechGuard = useRef(new SpeechRepeatGuard(20000));
  const announcedRef = useRef<Set<string>>(new Set());
  const lastJournalSaveRef = useRef(0);
  const startedAtMsRef = useRef<number>(Date.now());

  useWakeLock(keepAwake && !finished);

  // Bepaal welke route/context we navigeren: hervatten vanaf journaal, of net geaccepteerd vanuit de store.
  useEffect(() => {
    if (isResume) {
      const snapshot = loadActiveWalk();
      if (!snapshot) {
        setContext("not-found");
        return;
      }
      startedAtMsRef.current = new Date(snapshot.startedAt).getTime();
      setContext({
        start: snapshot.start,
        startLabel: snapshot.startLabel,
        surfacePreference: snapshot.surfacePreference,
        route: snapshot.plannedRoute,
        startedAt: snapshot.startedAt,
        initialTrack: snapshot.actualTrack,
      });
      setTrack(snapshot.actualTrack);
      return;
    }

    if (candidate && params) {
      const startedAt = new Date().toISOString();
      startedAtMsRef.current = Date.now();
      setContext({
        start: params.start,
        startLabel: params.startLabel,
        surfacePreference: params.surfacePreference,
        route: candidate,
        startedAt,
        initialTrack: [],
      });
      return;
    }

    setContext("not-found");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResume]);

  const activeRoute = context && context !== "not-found" ? context.route : null;

  const finishWalk = useCallback(
    async (status: "completed" | "aborted") => {
      if (!context || context === "not-found" || finished) return;
      setFinished(true);
      getVoiceGuide().cancel();

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtMsRef.current) / 1000));
      const distanceMeters =
        track.length > 1
          ? track.reduce((sum, _p, i) => (i === 0 ? 0 : sum + haversineForTrack(track[i - 1]!, track[i]!)), 0)
          : 0;

      const record: WalkRecord = {
        id: `walk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: context.startedAt,
        startLabel: context.startLabel,
        start: context.start,
        plannedRoute: context.route.geometry,
        actualTrack: track,
        plannedDistanceMeters: context.route.distanceMeters,
        actualDistanceMeters: distanceMeters,
        durationSeconds,
        averageSpeedKmh: averageSpeedKmh(distanceMeters, durationSeconds),
        surfacePreference: context.surfacePreference,
        status,
        routeCandidate: context.route,
      };

      try {
        await getWalksRepository().save(record);
      } catch (err) {
        console.error("Kon wandeling niet opslaan:", err);
      }
      clearActiveWalk();
      plannerReset();
      router.push(`/samenvatting?walkId=${encodeURIComponent(record.id)}`);
    },
    [context, finished, track, plannerReset, router],
  );

  const handlePosition = useCallback(
    (fix: GeolocationFix) => {
      if (!activeRoute || finished) return;
      setCurrentFix(fix);

      setTrack((prev) => {
        const last = prev[prev.length - 1];
        if (last && haversineForTrack(last, [fix.coordinate.lng, fix.coordinate.lat]) < MIN_TRACK_POINT_SPACING_METERS) {
          return prev;
        }
        return [...prev, [fix.coordinate.lng, fix.coordinate.lat]];
      });
    },
    [activeRoute, finished],
  );

  const { error: geoError, permissionDenied } = useGeolocation({ enabled: locationEnabled, onPosition: handlePosition });

  const progress = useMemo(() => {
    if (!activeRoute || !currentFix) return null;
    return computeRouteProgress(activeRoute, currentFix.coordinate);
  }, [activeRoute, currentFix]);

  // Off-route detectie + spraak + journaal-opslag, telkens als er nieuwe voortgang is.
  useEffect(() => {
    if (!progress || !activeRoute || finished) return;

    const confirmedOffRoute = offRouteDetector.current.update(progress.isOffRoute);
    setOffRouteWarning(confirmedOffRoute);

    if (progress.hasArrived) {
      void finishWalk("completed");
      return;
    }

    if (!confirmedOffRoute) {
      const instruction = activeRoute.instructions[progress.currentInstructionIndex];
      if (instruction) {
        const thresholds = [150, 50, 20];
        const crossed = thresholds.find((t) => progress.distanceToNextInstructionMeters <= t);
        if (crossed !== undefined) {
          const key = `${progress.currentInstructionIndex}-${crossed}`;
          if (!announcedRef.current.has(key)) {
            announcedRef.current.add(key);
            const text = buildSpokenInstruction(instruction.maneuver, progress.distanceToNextInstructionMeters);
            if (voiceEnabled && speechGuard.current.shouldSpeak(text)) {
              getVoiceGuide().speak(text);
            }
          }
        }
      }
    }

    const now = Date.now();
    if (context && context !== "not-found" && now - lastJournalSaveRef.current > JOURNAL_SAVE_INTERVAL_MS) {
      lastJournalSaveRef.current = now;
      saveActiveWalk({
        startedAt: context.startedAt,
        start: context.start,
        startLabel: context.startLabel,
        surfacePreference: context.surfacePreference,
        plannedRoute: context.route,
        actualTrack: track,
        lastUpdatedAt: new Date().toISOString(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  useEffect(() => {
    getVoiceGuide().setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  async function handleRecalculate() {
    if (!context || context === "not-found" || !currentFix || !progress) return;
    setRecalculating(true);
    try {
      const remainingMeters = Math.max(300, progress.totalDistanceMeters - progress.distanceAlongRouteMeters);
      const result = await apiGenerateRoute(
        {
          start: currentFix.coordinate,
          targetDistanceMeters: remainingMeters,
          tolerance: 0.15,
          surfacePreference: context.surfacePreference,
          startLabel: "Huidige locatie",
        },
        [],
      );
      if (result.candidate) {
        setContext({ ...context, route: result.candidate, start: currentFix.coordinate });
        offRouteDetector.current.reset();
        announcedRef.current.clear();
        setOffRouteWarning(false);
      }
    } catch (err) {
      console.error("Herberekenen mislukt:", err);
    } finally {
      setRecalculating(false);
    }
  }

  function handleReturnToRoute() {
    setOffRouteWarning(false);
    offRouteDetector.current.reset();
  }

  if (context === "not-found") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-bark-700">Geen actieve wandeling gevonden.</p>
        <button onClick={() => router.push("/")} className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white">
          Naar het zoekscherm
        </button>
      </main>
    );
  }

  if (!context || !activeRoute) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-moss-200 border-t-moss-700" aria-hidden />
      </main>
    );
  }

  if (!locationEnabled) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-2xl" aria-hidden>
          📍
        </p>
        <h1 className="text-xl font-bold text-moss-800">Locatietoegang nodig</h1>
        <p className="max-w-sm text-sm text-bark-700">
          Wandelroute Explorer gebruikt je live locatie alleen op dit toestel om je tijdens het wandelen te volgen en
          afslag-instructies te geven. Je locatie wordt niet verstuurd of extern opgeslagen.
        </p>
        <button
          onClick={() => setLocationEnabled(true)}
          className="tap-target rounded-xl bg-moss-700 px-6 py-4 text-lg font-bold text-white shadow-md"
        >
          Geef locatietoegang en start
        </button>
      </main>
    );
  }

  if (geoError && !currentFix) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-semibold text-alert">{geoError}</p>
        {!permissionDenied && (
          <button onClick={() => setLocationEnabled(false)} className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white">
            Probeer opnieuw
          </button>
        )}
      </main>
    );
  }

  const currentInstruction = progress ? activeRoute.instructions[progress.currentInstructionIndex] : undefined;
  const distanceText = progress
    ? buildSpokenInstruction(currentInstruction?.maneuver ?? "continue", progress.distanceToNextInstructionMeters)
    : "Gps-signaal zoeken…";

  return (
    <main className="flex flex-1 flex-col">
      <InstructionBanner
        maneuver={currentInstruction?.maneuver ?? "continue"}
        distanceText={distanceText}
        offRoute={offRouteWarning}
      />

      <div className="relative flex-1">
        <MapView
          routeGeometry={progress?.remaining ?? activeRoute.geometry}
          traveledGeometry={progress?.traveled}
          userPosition={currentFix?.coordinate}
          userHeadingDegrees={currentFix?.headingDegrees}
          followUser
          className="absolute inset-0"
        />

        {offRouteWarning && (
          <div className="absolute inset-x-0 bottom-24 mx-4 rounded-xl bg-white p-4 shadow-lg ring-1 ring-alert">
            <p className="font-semibold text-bark-900">Je wijkt af van de route</p>
            <p className="mt-1 text-sm text-bark-700">Wat wil je doen?</p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={handleReturnToRoute}
                className="tap-target rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white"
              >
                Ik loop terug naar de route
              </button>
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="tap-target rounded-lg border border-moss-400 px-4 py-2 font-semibold text-moss-700 disabled:opacity-60"
              >
                {recalculating ? "Nieuwe route berekenen…" : "Bereken nieuwe route naar het vervolg"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="safe-bottom flex items-center justify-between gap-3 border-t border-moss-200 bg-white p-3">
        <button
          onClick={() => useSettingsStore.getState().setVoiceEnabled(!voiceEnabled)}
          aria-pressed={voiceEnabled}
          className="tap-target rounded-lg px-3 py-2 text-sm font-medium text-bark-800"
        >
          {voiceEnabled ? "🔊 Spraak aan" : "🔇 Spraak uit"}
        </button>
        <button
          onClick={() => {
            if (window.confirm("Wandeling voortijdig beëindigen? Je voortgang tot nu toe wordt opgeslagen.")) {
              void finishWalk("aborted");
            }
          }}
          className="tap-target rounded-lg bg-alert px-4 py-2 font-semibold text-white"
        >
          Beëindig wandeling
        </button>
      </div>
    </main>
  );
}

function haversineForTrack(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
