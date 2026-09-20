import type { Metadata } from "next";
import { SearchScreen } from "@/components/screens/SearchScreen";

export const metadata: Metadata = {
  title: "Wandelroute maken op jouw afstand | MijnLoopje",
  description:
    "Laat MijnLoopje automatisch een wandelroute of rondwandeling voor je maken vanaf je eigen startpunt, op de afstand die jij kiest. Kies onverhard, gemengd of verhard en vermijd desgewenst stoplichten en drukke oversteekplaatsen.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <SearchScreen />;
}
