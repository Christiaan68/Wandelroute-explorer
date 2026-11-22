import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { validateContact } from "@/lib/contact/validate";

/**
 * Contactformulier: stuurt een ingevuld bericht als e-mail naar de eigen
 * mailbox, via de SMTP-server van mijn.host (de mailbox contact@mijnloopje.nl).
 * Bewust GEEN externe maildienst zoals Resend: Christiaan wil deze site
 * gescheiden houden van zijn andere sites.
 *
 * Beveiliging (zie ook de toelichting in de chat van 2026-11-22):
 *  - Nooit een kopie naar het ingevulde adres: anders kan iedereen via dit
 *    formulier mail naar willekeurige mensen laten versturen (open relay).
 *    Het ingevulde adres staat alleen in "Beantwoorden aan".
 *  - Alleen platte tekst, geen HTML: ingevulde tekst kan in de mail dus
 *    nooit als code of link-opmaak worden uitgevoerd.
 *  - Controle op de server (src/lib/contact/validate.ts), lokveld en
 *    minimale invultijd tegen bots, controle van de herkomst (Origin).
 *  - Limiet per IP-adres: de echte limiet staat in de Vercel Firewall (een
 *    regel op POST /api/contact). De teller hieronder is alleen een extra
 *    rem binnen één serverinstantie; Vercel draait soms meerdere instanties
 *    die elkaars teller niet zien.
 *  - Het SMTP-wachtwoord staat alleen in een environment variable in Vercel,
 *    nooit in de code. Zonder die variabelen geeft dit endpoint een nette
 *    "tijdelijk niet beschikbaar" (503) in plaats van een crash.
 *
 * Er wordt niets opgeslagen: het bericht bestaat alleen als e-mail.
 */

export const maxDuration = 20;

const ALLOWED_ORIGINS = new Set(["https://www.mijnloopje.nl", "https://mijnloopje.nl"]);

// Extra rem per serverinstantie: max. 5 berichten per IP per 10 minuten.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recentByIp = new Map<string, number[]>();

function tooManyRequests(ip: string, now: number): boolean {
  const recent = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  recentByIp.set(ip, recent);
  if (recentByIp.size > 5000) recentByIp.clear(); // geheugen begrenzen
  return recent.length > MAX_PER_WINDOW;
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Lokaal ontwikkelen en Vercel-previewadressen van dit project.
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.VERCEL_ENV === "preview" && origin.endsWith(".vercel.app");
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: "Geweigerd." }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "onbekend";
  if (tooManyRequests(ip, Date.now())) {
    return NextResponse.json(
      { error: "Je hebt net al een paar berichten gestuurd. Probeer het over tien minuten opnieuw." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const result = validateContact(body);
  if (!result.ok) {
    // Bij een vermoedelijke bot geven we bewust een gewoon "gelukt" terug:
    // zo leert een bot niet welk detail hem verraadt.
    if (result.kind === "spam") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // .trim(): een spatie of regeleinde dat per ongeluk mee is geplakt in
  // Vercel geeft anders een onduidelijke "535 Incorrect authentication data".
  const env = (key: string) => process.env[key]?.trim() || undefined;
  const SMTP_HOST = env("SMTP_HOST");
  const SMTP_PORT = env("SMTP_PORT");
  const SMTP_USER = env("SMTP_USER");
  const SMTP_PASS = env("SMTP_PASS");
  const CONTACT_TO = env("CONTACT_TO");
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("Contactformulier: SMTP-instellingen ontbreken (SMTP_HOST/SMTP_USER/SMTP_PASS).");
    return NextResponse.json(
      { error: "Het contactformulier is tijdelijk niet beschikbaar. Probeer het later opnieuw." },
      { status: 503 },
    );
  }

  const port = Number(SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = direct TLS; 587 = STARTTLS (hieronder verplicht)
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  const { name, email, message } = result.value;
  try {
    await transporter.sendMail({
      from: { name: "Mijnloopje.nl contactformulier", address: SMTP_USER },
      to: CONTACT_TO || SMTP_USER,
      replyTo: { name, address: email },
      subject: `Contactformulier Mijnloopje.nl: ${name.slice(0, 60)}`,
      text: `Naam: ${name}\nE-mail: ${email}\n\n${message}\n\n— Verstuurd via het contactformulier op www.mijnloopje.nl`,
    });
  } catch (err) {
    // Geen persoonsgegevens loggen, alleen de technische oorzaak.
    console.error("Contactformulier: verzenden mislukt:", (err as Error).message);
    return NextResponse.json(
      { error: "Je bericht kon niet worden verstuurd. Probeer het later opnieuw." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
