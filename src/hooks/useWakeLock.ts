"use client";

import { useEffect, useRef } from "react";

/**
 * Houdt het scherm aan tijdens actieve navigatie via de Screen Wake Lock API.
 * Niet overal ondersteund (o.a. sommige iOS-versies) — faalt dan stil; de
 * gebruiker kan het scherm zelf aan houden, dit is puur een comfort-feature.
 */
export function useWakeLock(enabled: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const requestLock = async () => {
      try {
        const lock = await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
        } else {
          lockRef.current = lock;
        }
      } catch {
        // Genegeerd: wake lock is een verbetering, geen vereiste.
      }
    };

    void requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && enabled && !lockRef.current) {
        void requestLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [enabled]);
}
