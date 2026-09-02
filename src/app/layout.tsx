import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

// Bewust GEEN next/font/google (Inter e.d.): dat vereist een netwerkverbinding
// naar fonts.googleapis.com tijdens elke `next build`, wat builds onnodig laat
// falen op machines/CI-runners met beperkte uitgaande toegang. We gebruiken in
// plaats daarvan de systeemfont-stack (tailwind.config.ts), die overal werkt,
// sneller laadt en geen extra netwerkverzoek kost.

export const metadata: Metadata = {
  title: "Wandelroute Explorer",
  description: "Vind een rondwandeling op jouw gewenste afstand en laat je onderweg begeleiden met gps-navigatie.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wandelroute Explorer",
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
