"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Kleine, site-brede footerregel, net boven <BottomNav>. Verborgen tijdens
 * actieve navigatie (net als <BottomNav> zelf) — daar moet de aandacht
 * volledig bij de route en de kaart liggen, niet bij een footerregel.
 */
export function CopyrightFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/navigeren")) return null;

  return (
    <p className="py-1 text-center text-[11px] text-bark-700/70">
      <Link href="/faq" className="underline">
        Veelgestelde vragen
      </Link>{" "}
      · © 2026 I.H.C. ten Haaken
    </p>
  );
}
