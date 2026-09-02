import { Suspense } from "react";
import { SummaryScreen } from "@/components/screens/SummaryScreen";

export default function SamenvattingPage() {
  return (
    <Suspense fallback={null}>
      <SummaryScreen />
    </Suspense>
  );
}
