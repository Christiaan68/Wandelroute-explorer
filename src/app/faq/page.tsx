import type { Metadata } from "next";
import Link from "next/link";
import faqItems from "@/content/faq.json";

/**
 * FAQ-inhoud staat bewust los van deze pagina in src/content/faq.json (vraag,
 * antwoord, categorie, volgorde, gepubliceerd) i.p.v. hardcoded in dit
 * component. Zo kan de inhoud aangepast worden zonder de paginacode te
 * hoeven wijzigen.
 *
 * Geen FAQPage-structured data: Google heeft de FAQ-rich-result functie in
 * mei 2026 uitgefaseerd, dus die schema-markup levert geen zoekresultaat-
 * voordeel meer op.
 */
export const metadata: Metadata = {
  title: "Veelgestelde vragen | MijnLoopje",
  description:
    "Antwoorden op veelgestelde vragen over het maken van een wandelroute met MijnLoopje: afstand, startpunt, onverhard of verhard, stoplichten vermijden, gps-navigatie en privacy.",
  alternates: { canonical: "/faq" },
};

interface FaqItem {
  question: string;
  answer: string;
  category: string;
  order: number;
  published: boolean;
}

function groupByCategory(items: FaqItem[]): { category: string; items: FaqItem[] }[] {
  const sorted = [...items].filter((i) => i.published).sort((a, b) => a.order - b.order);
  const groups: { category: string; items: FaqItem[] }[] = [];
  for (const item of sorted) {
    const existing = groups.find((g) => g.category === item.category);
    if (existing) existing.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }
  return groups;
}

export default function FaqPage() {
  const groups = groupByCategory(faqItems as FaqItem[]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 pb-8">
      <header className="safe-top pt-2">
        <h1 className="text-2xl font-bold text-moss-800">Veelgestelde vragen</h1>
        <p className="mt-1 text-sm text-bark-700">
          Alles over het maken van een wandelroute met MijnLoopje: afstand, startpunt, ondergrond, stoplichten
          vermijden, navigatie en privacy.
        </p>
      </header>

      {groups.map((group) => (
        <section
          key={group.category}
          aria-labelledby={`faq-${group.category}`}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100"
        >
          <h2 id={`faq-${group.category}`} className="text-base font-semibold text-moss-800">
            {group.category}
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {group.items.map((item) => (
              <details key={item.question} className="group rounded-lg border border-moss-100 p-3">
                <summary className="cursor-pointer list-none font-medium text-bark-900 marker:content-none">
                  <span className="flex items-center justify-between gap-3">
                    {item.question}
                    <span aria-hidden className="text-moss-600 group-open:rotate-180">
                      ⌄
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-bark-700">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="text-sm text-bark-700">
        Staat je vraag er niet bij?{" "}
        <Link href="/" className="font-semibold text-moss-700 underline">
          Ga naar de routegenerator
        </Link>{" "}
        en probeer het gewoon uit.
      </p>
    </main>
  );
}
