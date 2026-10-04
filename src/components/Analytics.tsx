"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/lib/state/settings-store";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/ga";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Laadt Google Analytics 4 pas nadat de bezoeker daar expliciet toestemming
 * voor heeft gegeven (banner hieronder, of achteraf via Instellingen). Vóór
 * die toestemming wordt er helemaal niets van Google geladen of aangeroepen —
 * geen script, geen dataLayer, geen achtergrondverzoek. Alleen actief als
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is ingesteld (zie src/lib/analytics/ga.ts).
 *
 * `send_page_view: false` in de config: Next.js' App Router ververst de
 * pagina niet bij navigatie tussen schermen, dus zonder dit zou GA4 alleen de
 * allereerste pagina van een bezoek zien. In plaats daarvan sturen we zelf één
 * page_view bij het laden (in de init-script hieronder) en daarna telkens
 * opnieuw bij een routewisseling (via het effect hieronder).
 */
export function Analytics() {
  const pathname = usePathname();
  const consent = useSettingsStore((s) => s.analyticsConsent);
  const setConsent = useSettingsStore((s) => s.setAnalyticsConsent);
  const skipNextPageView = useRef(true);

  useEffect(() => {
    if (consent !== "granted" || !GA_MEASUREMENT_ID) return;
    // De eerste pagina van dit bezoek is al verstuurd door de inline
    // init-script (met de pathname op dat moment) — alleen latere
    // routewisselingen hoeven hier nog een page_view te triggeren.
    if (skipNextPageView.current) {
      skipNextPageView.current = false;
      return;
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", { page_path: pathname, page_location: window.location.href });
    }
  }, [pathname, consent]);

  if (!GA_MEASUREMENT_ID) return null;
  // Geen banner/scripts tijdens actieve navigatie: dezelfde reden als bij
  // BottomNav/CopyrightFooter — daar moet de aandacht bij de kaart blijven.
  if (pathname?.startsWith("/navigeren")) return null;

  return (
    <>
      {consent === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                anonymize_ip: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                send_page_view: false,
              });
              gtag('event', 'page_view', { page_path: '${pathname}', page_location: window.location.href });
            `}
          </Script>
        </>
      )}

      {consent === null && (
        <div
          role="dialog"
          aria-label="Toestemming voor analytics"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-moss-200 bg-white p-4 shadow-lg"
        >
          <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-bark-700">
              Mogen we geanonimiseerd bijhouden hoeveel mensen MijnLoopje gebruiken, via Google Analytics? Dit gebeurt
              pas na je toestemming.{" "}
              <a href="/instellingen" className="underline">
                Meer uitleg in Instellingen
              </a>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setConsent("denied")}
                className="tap-target rounded-lg border border-moss-300 px-3 py-2 text-sm font-semibold text-moss-700"
              >
                Weigeren
              </button>
              <button
                type="button"
                onClick={() => setConsent("granted")}
                className="tap-target rounded-lg bg-moss-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Accepteren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
