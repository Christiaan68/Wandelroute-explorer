"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONTACT_LIMITS } from "@/lib/contact/validate";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // lokveld voor bots
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const startedAtRef = useRef<number>(0);
  // Pas versturen als de pagina volledig geladen is. Daarvoor zou de browser
  // het formulier zelf versturen, buiten onze code om (test 2026-11-22: met
  // naam, e-mail en bericht zichtbaar in het webadres).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
    setReady(true);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorText(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website, startedAt: startedAtRef.current }),
        signal: AbortSignal.timeout(25_000),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorText(json.error ?? "Je bericht kon niet worden verstuurd. Probeer het later opnieuw.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorText("Er ging iets mis met de verbinding. Controleer je internet en probeer het opnieuw.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold text-moss-800">Bedankt voor je bericht</h1>
        <p role="status" className="rounded-xl bg-moss-50 p-4 text-sm text-moss-800">
          Je bericht is verstuurd. Ik reageer zo snel mogelijk op het e-mailadres dat je hebt opgegeven.
        </p>
        <Link href="/" className="tap-target self-start rounded-lg bg-moss-600 px-4 py-2 font-semibold text-white">
          Naar het zoekscherm
        </Link>
      </main>
    );
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-moss-200 bg-white px-3 py-2 text-base text-bark-900 focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-300";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
      <header className="safe-top pt-2">
        <h1 className="text-2xl font-bold text-moss-800">Contact</h1>
        <p className="text-sm text-bark-700">
          Een vraag, een idee of een fout gevonden in Mijnloopje.nl? Laat het me weten. Kijk eventueel eerst bij de{" "}
          <Link href="/faq" className="underline">
            veelgestelde vragen
          </Link>
          .
        </p>
      </header>

      {/* method="post": mocht de browser het formulier ooit zelf versturen, dan
          komen de gegevens nooit in het webadres (en dus niet in logs of de
          browsergeschiedenis) terecht. */}
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-moss-100">
        <label className="block text-sm font-medium text-bark-900">
          Naam
          <input
            type="text"
            name="name"
            required
            maxLength={CONTACT_LIMITS.nameMax}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-medium text-bark-900">
          E-mailadres
          <input
            type="email"
            name="email"
            required
            maxLength={CONTACT_LIMITS.emailMax}
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-medium text-bark-900">
          Vraag of opmerking
          <textarea
            name="message"
            required
            minLength={CONTACT_LIMITS.messageMin}
            maxLength={CONTACT_LIMITS.messageMax}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputClass}
          />
        </label>

        {/* Lokveld: buiten beeld en niet bereikbaar met het toetsenbord. Alleen bots vullen dit in. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <p className="text-xs text-bark-700">
          Je naam, e-mailadres en bericht worden alleen per e-mail naar mij gestuurd, om je vraag te kunnen
          beantwoorden. Ze worden niet op de website opgeslagen. Ik verwijder je bericht nadat het is afgehandeld.
        </p>

        {status === "error" && errorText && (
          <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-bark-900">
            {errorText}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || status === "sending"}
          className="tap-target rounded-xl bg-moss-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {!ready ? "Even geduld…" : status === "sending" ? "Bezig met versturen…" : "Verstuur bericht"}
        </button>
      </form>
    </main>
  );
}
