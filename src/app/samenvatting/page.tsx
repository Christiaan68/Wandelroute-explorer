import type { Metadata } from "next";
import { Suspense } from "react";
import { SummaryScreen } from "@/components/screens/SummaryScreen";

// Onderdeel van de app-flow (samenvatting na een gelopen wandeling).
// Noindex, geen disallow (zie toelichting in geschiedenis/page.tsx).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function SamenvattingPage() {
  return (
    <Suspense fallback={null}>
      <SummaryScreen />
    </Suspense>
  );
}
