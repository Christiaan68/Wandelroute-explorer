"use client";

import { usePathname } from "next/navigation";

/**
 * Kleine, site-brede copyright-regel, net boven <BottomNav>. Verborgen tijdens
 * actieve navigatie (net als <BottomNav> zelf) — daar moet de aandacht
 * volledig bij de route en de kaart liggen, niet bij een copyright-regel.
 */
export function CopyrightFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/navigeren")) return null;

  return <p className="py-1 text-center text-[11px] text-bark-700/70">© 2026 I.H.C. ten Haaken</p>;
}
