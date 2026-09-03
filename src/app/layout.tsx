import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

// Bewust GEEN next/font/google (Inter e.d.): dat vereist een netwerkverbinding
// naar fonts.googleapis.com tijdens elke `next build`, wat builds onnodig laat
// falen op machines/CI-runners met beperkte uitgaande toegang. We gebruiken in
// plaats daarvan de systeemfont-stack (tailwind.config.ts), die overal werkt,
// sneller laadt en geen extra netwerkverzoek kost.

const SITE_URL = "https://mijnloopje.nl";
const SITE_TITLE = "Wandelroute Explorer";
const SITE_DESCRIPTION =
  "Vind een rondwandeling op jouw gewenste afstand en laat je onderweg begeleiden met gps-navigatie.";
// Naam die iOS Safari voorstelt (en die je nog kunt aanpassen) bij "Zet op
// beginscherm" — dit is wat er onder het app-icoon op het beginscherm komt te
// staan. Los van SITE_TITLE gehouden zodat de paginatitel/linkvoorbeelden
// (browsertab, WhatsApp e.d.) gewoon "Wandelroute Explorer" blijven tonen.
const HOME_SCREEN_TITLE = "Mijnloopje";

export const metadata: Metadata = {
  // Absolute basis-URL voor relatieve afbeeldingen in metadata (bv. og:image).
  // Vast op het eigen domein zodat linkvoorbeelden (WhatsApp, iMessage, etc.)
  // altijd naar dezelfde, werkende afbeelding wijzen, ongeacht via welk domein
  // (mijnloopje.nl of het vercel.app-adres) de link gedeeld wordt.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: HOME_SCREEN_TITLE,
  },
  // Expliciete Open Graph-tags: zonder deze valt een linkvoorbeeld terug op
  // wat de chat-app zelf uit de pagina raadt (soms niets, soms alleen tekst
  // zonder afbeelding). Met deze tags krijgt elke gedeelde link altijd
  // dezelfde volledige preview (titel, omschrijving en afbeelding).
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: SITE_TITLE,
      },
    ],
    locale: "nl_NL",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#3a663c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="flex min-h-dvh flex-col font-sans">
        <ServiceWorkerRegister />
        <div className="flex flex-1 flex-col">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
