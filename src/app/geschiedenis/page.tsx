import type { Metadata } from "next";
import { HistoryScreen } from "@/components/screens/HistoryScreen";

// Persoonlijke gegevens (opgeslagen wandelingen van de gebruiker), niet
// bedoeld om via een zoekmachine gevonden te worden. Noindex, geen disallow:
// zo kan Google de pagina wel crawlen en de noindex-instructie zien (een
// disallow in robots.txt zou dat juist verbergen). Dit is geen
// beveiligingsmaatregel — de pagina blijft gewoon bereikbaar.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function GeschiedenisPage() {
  return <HistoryScreen />;
}
