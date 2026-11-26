"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { APP_VERSION, decideUpdateAction, isSafeToReload } from "@/lib/app-version";

const RELOAD_KEY = "mijnloopje-herladen-voor-versie";
const MIN_INTERVAL_MS = 15_000;

function readTried(): string | null {
  try {
    return sessionStorage.getItem(RELOAD_KEY);
  } catch {
    return null;
  }
}

function reloadFor(version: string) {
  try {
    sessionStorage.setItem(RELOAD_KEY, version);
  } catch {
    // sessionStorage niet beschikbaar: toch herladen (lusbeveiliging vervalt dan).
  }
  window.location.reload();
}

/**
 * Controleert bij het openen van de app, bij terugkeren naar de app (ook als
 * iOS de app uit het geheugen hervat) en bij schermwissels of er een nieuwere
 * versie live staat. Zo ja: direct herladen, of, tijdens navigatie/een
 * routevoorstel/het contactformulier, zodra de gebruiker naar een ander scherm
 * gaat. Toont zelf niets.
 */
export function AppUpdateChecker() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const pendingVersionRef = useRef<string | null>(null);
  const lastCheckRef = useRef(0);
  const checkingRef = useRef(false);
  const checkRef = useRef<((force: boolean) => Promise<void>) | null>(null);

  pathnameRef.current = pathname;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    async function check(force: boolean) {
      if (checkingRef.current) return;
      const now = Date.now();
      if (!force && now - lastCheckRef.current < MIN_INTERVAL_MS) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      lastCheckRef.current = now;
      checkingRef.current = true;

      // Laat de browser ook meteen naar een nieuwe service worker kijken.
      navigator.serviceWorker
        ?.getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {});

      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const action = decideUpdateAction(APP_VERSION, data.version, pathnameRef.current, readTried());
        if (action === "reload" && data.version) reloadFor(data.version);
        else if (action === "defer" && data.version) pendingVersionRef.current = data.version;
      } catch {
        // Geen verbinding of server tijdelijk onbereikbaar: gewoon doorgaan.
      } finally {
        checkingRef.current = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check(true);
    };
    const onOnline = () => void check(true);

    void check(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    checkRef.current = check;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Bij elke schermwissel: uitgestelde update nu uitvoeren als dat veilig is,
  // anders (beperkt in frequentie) opnieuw controleren.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const pending = pendingVersionRef.current;
    if (pending) {
      if (isSafeToReload(pathname) && readTried() !== pending) reloadFor(pending);
      return;
    }
    void checkRef.current?.(false);
  }, [pathname]);

  return null;
}
