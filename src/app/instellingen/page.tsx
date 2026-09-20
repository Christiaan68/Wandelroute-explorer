import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

// Instellingenpagina van de gebruiker, niet bedoeld om via een zoekmachine
// gevonden te worden. Noindex, geen disallow (zie toelichting in
// geschiedenis/page.tsx) — noindex is hier geen beveiligingsmaatregel.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function InstellingenPage() {
  return <SettingsScreen />;
}
