"use client";

import { useEffect } from "react";

/** Registreert de service worker (voor PWA-installatie en offline app-shell). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // voorkomt verwarrende caching tijdens `next dev`

    // updateViaCache "none": sw.js zelf nooit uit de browsercache halen, zodat
    // een nieuwe service worker na een deployment meteen gevonden wordt.
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((err) => {
      console.warn("Service worker registratie mislukt:", err);
    });
  }, []);

  return null;
}
