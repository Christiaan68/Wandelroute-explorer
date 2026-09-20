import type { Metadata } from "next";
import { ProposalScreen } from "@/components/screens/ProposalScreen";

// Onderdeel van de app-flow (routevoorstel n.a.v. een actieve zoekopdracht),
// zonder actieve staat leeg/zinloos voor een zoekresultaat. Noindex, geen
// disallow (zie toelichting in geschiedenis/page.tsx).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function VoorstelPage() {
  return <ProposalScreen />;
}
