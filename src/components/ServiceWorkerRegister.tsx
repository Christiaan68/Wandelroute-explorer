"use client";

import { useEffect } from "react";

/** Registreert de service worker (voor PWA-installatie en offline app-shell). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // voorkomt verwarrende caching tijdens `next dev`

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registratie mislukt:", err);
    });
  }, []);

  return null;
}
