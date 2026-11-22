/**
 * Measurement ID voor Google Analytics 4 (bv. "G-XXXXXXXXXX"), ingesteld via
 * de environment variable NEXT_PUBLIC_GA_MEASUREMENT_ID (zie .env.example).
 * Zonder deze waarde laadt src/components/Analytics.tsx helemaal niets van
 * Google, ook niet na toestemming — zo blijft analytics volledig uit tijdens
 * lokaal ontwikkelen tenzij je er zelf voor kiest een ID in te vullen.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Zet Google Analytics in deze paginasessie uit en verwijdert de GA-cookies.
 * Nodig bij het INTREKKEN van toestemming (of bij "Verwijder alle lokale
 * gegevens"): het eenmaal geladen gtag.js-script blijft tot de volgende
 * paginaverversing in het geheugen staan en zou anders nog wachtende
 * meetverzoeken versturen; de `_ga`-cookies bleven bovendien gewoon staan
 * (vastgesteld in de test van 2026-11-22).
 *
 * `window['ga-disable-<ID>'] = true` is Google's eigen, gedocumenteerde
 * uitschakelknop voor gtag.js; de consent-update is een extra vangnet.
 */
export function disableAnalytics(): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", { analytics_storage: "denied" });
  }
  deleteAnalyticsCookies();
}

/** Heft een eerdere `disableAnalytics()` op, als iemand later (zonder herladen) toch weer toestemming geeft. */
export function enableAnalytics(): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", { analytics_storage: "granted" });
  }
}

/**
 * Verwijdert alle cookies van Google Analytics (`_ga`, `_ga_<id>`, `_gid`).
 * GA zet ze standaard op het hoogste domein (bv. `.mijnloopje.nl`), dus we
 * proberen elk domeinniveau van de huidige hostnaam — een cookie verwijderen
 * lukt alleen met exact hetzelfde domein als waarmee hij is gezet.
 */
export function deleteAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]!.trim())
    .filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid" || n === "_gat");
  if (names.length === 0) return;

  const parts = window.location.hostname.split(".");
  const domains: (string | null)[] = [null];
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    domains.push(d, `.${d}`);
  }

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}
