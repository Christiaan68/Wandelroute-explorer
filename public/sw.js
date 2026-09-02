/**
 * Minimale service worker voor Wandelroute Explorer.
 *
 * Doel: de app-shell (HTML/CSS/JS/iconen) cachen zodat de app na een eerste
 * bezoek ook installeerbaar is en meteen opstart bij een wankele verbinding.
 * Dit maakt de kaart/routing NIET offline werkend — dat vereist live
 * kaarttegels en een routing-API-call, wat inherent internet vereist. Zie
 * README.md ("Bekende beperkingen") voor de eerlijke uitleg hiervan.
 *
 * Strategie:
 * - App-shell routes (navigaties) en statische same-origin assets: cache-first
 *   met een netwerk-fallback, zodat een tweede bezoek instant laadt.
 * - Alles anders (API-calls, kaarttegels van externe hosts): altijd netwerk,
 *   nooit gecachet — die data moet vers zijn.
 */

const CACHE_NAME = "wandelroute-shell-v1";
const APP_SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApiCall = url.pathname.startsWith("/api/");

  if (!isSameOrigin || isApiCall || event.request.method !== "GET") {
    return; // laat de browser dit gewoon normaal (netwerk) afhandelen
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached || caches.match("/"));
    }),
  );
});
