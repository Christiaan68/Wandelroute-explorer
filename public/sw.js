/**
 * Minimale service worker voor Wandelroute Explorer.
 *
 * Doel: de app-shell (HTML/CSS/JS/iconen) cachen zodat de app na een eerste
 * bezoek ook installeerbaar is en meteen opstart bij een wankele verbinding.
 * Dit maakt de kaart/routing NIET offline werkend — dat vereist live
 * kaarttegels en een routing-API-call, wat inherent internet vereist. Zie
 * README.md ("Bekende beperkingen") voor de eerlijke uitleg hiervan.
 *
 * Strategie (LET OP: aangepast na een productiebug, zie hieronder):
 * - Bestanden onder /_next/static/... hebben een content-hash in hun
 *   bestandsnaam (Next.js regelt dit). Dezelfde naam = gegarandeerd dezelfde
 *   inhoud, voor altijd. Die mogen dus veilig "cache-first" voor de lange
 *   termijn — een nieuwe build krijgt automatisch een nieuwe bestandsnaam.
 * - ALLES ANDERS (met name de HTML-pagina zelf "/", manifest, RSC-responses)
 *   heeft GEEN content-hash: de url blijft hetzelfde, maar de inhoud kan
 *   wijzigen bij elke nieuwe deployment. Dat moet dus altijd EERST het
 *   netwerk proberen ("network-first"), met de cache alleen als fallback
 *   wanneer er geen internetverbinding is.
 *
 * Waarom dit expliciet zo is opgeschreven: de vorige versie deed
 * cache-first voor ALLES, inclusief "/". Resultaat: zodra iemand de site
 * één keer bezocht had, bleef zijn/haar browser voor altijd de eerste
 * gecachete versie van de HTML (en daarmee ook de daarin genoemde,
 * inmiddels niet meer bestaande JS-bestandsnamen) tonen — ook na nieuwe
 * deployments, ook na een browser-refresh, omdat de service worker het
 * netwerk simpelweg nooit meer raadpleegde. Dit veroorzaakte een
 * hardnekkige "de kaart blijft leeg"-bug die pas verdween na het handmatig
 * wissen van site-data. Network-first voor niet-gehashte bestanden
 * voorkomt dat dit weer gebeurt.
 */

const CACHE_NAME = "wandelroute-shell-v2";
const APP_SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

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

  if (isImmutableAsset(url)) {
    // Cache-first: veilig, want de bestandsnaam verandert zodra de inhoud
    // verandert (content-hash).
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        });
      }),
    );
    return;
  }

  // Network-first: altijd eerst een verse versie proberen, zodat een nieuwe
  // deployment direct zichtbaar is. Alleen bij het ontbreken van een
  // netwerkverbinding valt dit terug op de laatst gecachete versie.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});
