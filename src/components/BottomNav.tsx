"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Zoeken", icon: "🧭" },
  { href: "/geschiedenis", label: "Mijn wandelingen", icon: "📜" },
  { href: "/instellingen", label: "Instellingen", icon: "⚙️" },
];

/** Verborgen tijdens actieve navigatie: daar moet de aandacht volledig bij de route liggen. */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/navigeren")) return null;

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="safe-bottom sticky bottom-0 z-20 border-t border-moss-200 bg-white/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl justify-around">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`tap-target flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                  active ? "text-moss-700" : "text-bark-700/70"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
