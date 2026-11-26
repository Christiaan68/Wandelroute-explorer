import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-version";

// Altijd vers berekenen en nooit cachen: de app vraagt hiermee na welke
// versie op dit moment live staat (zie src/components/AppUpdateChecker.tsx).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
