import { Suspense } from "react";
import { NavigationScreen } from "@/components/screens/NavigationScreen";

export default function NavigerenPage() {
  return (
    <Suspense fallback={null}>
      <NavigationScreen />
    </Suspense>
  );
}
