import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationScreen } from "@/components/screens/NavigationScreen";

// Onderdeel van de app-flow (live navigatiescherm tijdens een wandeling).
// Noindex, geen disallow (zie toelichting in geschiedenis/page.tsx).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function NavigerenPage() {
  return (
    <Suspense fallback={null}>
      <NavigationScreen />
    </Suspense>
  );
}
