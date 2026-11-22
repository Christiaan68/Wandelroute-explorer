/**
 * Beveiligingsheaders voor alle pagina's (toegevoegd n.a.v. de test van
 * 2026-11-22; alleen HSTS stond er al, via Vercel).
 *
 * Content-Security-Policy: bepaalt van welke servers de browser scripts,
 * kaarttegels enz. mag laden. Toegestaan zijn alleen de diensten die de app
 * echt gebruikt:
 *  - Google Analytics (alleen na toestemming geladen): googletagmanager.com
 *    en *.google-analytics.com, volgens Google's eigen CSP-advies voor GA4.
 *  - Kaarttegels: tile.openstreetmap.org (standaard) en tiles.openfreemap.org
 *    (de terugvaloptie via NEXT_PUBLIC_MAP_PROVIDER=openfreemap).
 *  - MapLibre gebruikt web workers vanuit een blob:-adres.
 * Routeplanner, adreszoeker en Overpass worden via onze eigen server
 * aangeroepen ('self') en hoeven hier dus niet bij.
 * 'unsafe-inline' voor scripts is nodig voor de inline scripts die Next.js en
 * de GA-initialisatie gebruiken; nonces vereisen dat elke pagina dynamisch
 * wordt opgebouwd, wat de site trager maakt.
 *
 * LET OP bij een nieuwe externe dienst (bv. een andere kaartbron of een
 * widget): die moet hier worden toegevoegd, anders blokkeert de browser hem.
 * Een blokkade is te zien in de browserconsole als "Refused to ... because it
 * violates the following Content Security Policy directive".
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' ALLEEN bij lokaal ontwikkelen (npm run dev): de
  // ontwikkelmodus van Next.js gebruikt eval voor het live herladen; zonder
  // deze uitzondering werkt de site lokaal niet. De live site krijgt hem niet.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://tiles.openfreemap.org https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self' data: https://tiles.openfreemap.org",
  "connect-src 'self' https://tile.openstreetmap.org https://tiles.openfreemap.org https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), screen-wake-lock=(self), camera=(), microphone=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint draait apart via `npm run lint`; blokkeer production build niet op stijlkwesties.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        // Het oude Vercel-adres stuurt door naar het eigen domein, zodat er
        // geen tweede kopie van de site (met eigen opslag en eigen
        // analytics-keuze) bereikbaar blijft. Alleen dit exacte adres:
        // preview-deployments van Vercel (andere *.vercel.app-adressen)
        // blijven gewoon werken.
        source: "/:path*",
        has: [{ type: "host", value: "wandelroute-explorer.vercel.app" }],
        destination: "https://www.mijnloopje.nl/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
