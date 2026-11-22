/**
 * Controle van een ingevuld contactformulier, op de SERVER (zie
 * src/app/api/contact/route.ts). De browser controleert ook, maar die
 * controle is te omzeilen; deze niet.
 *
 * Bewust een losse, pure functie zodat hij zonder server of mail getest kan
 * worden (tests/unit/contact-validate.test.ts).
 */

export const CONTACT_LIMITS = {
  nameMax: 100,
  emailMax: 254,
  messageMin: 10,
  messageMax: 5000,
  /** Een mens doet er langer over om een bericht te typen; bots vullen in een fractie van een seconde in. */
  minFillMs: 3000,
} as const;

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type ContactValidation =
  | { ok: true; value: ContactInput }
  /** "spam": stil weigeren (bot vermoed). "invalid": begrijpelijke foutmelding tonen. */
  | { ok: false; kind: "spam" | "invalid"; error: string };

// Eenvoudige, strikte e-mailcontrole: één @, geen spaties, een punt in het
// domein. Geen poging om de volledige e-mail-RFC na te bouwen.
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
// Regeleinden en andere stuurtekens horen niet in een naam of e-mailadres.
// Dit voorkomt ook dat iemand extra mailheaders probeert in te voegen.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function validateContact(raw: unknown, nowMs: number = Date.now()): ContactValidation {
  if (!raw || typeof raw !== "object") return { ok: false, kind: "invalid", error: "Ongeldige aanvraag." };
  const body = raw as Record<string, unknown>;

  // Lokveld: onzichtbaar voor mensen, bots vullen het wel in.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return { ok: false, kind: "spam", error: "Geweigerd." };
  }
  // Te snel ingevuld (of geen starttijd meegestuurd).
  const startedAt = typeof body.startedAt === "number" ? body.startedAt : NaN;
  if (!Number.isFinite(startedAt) || nowMs - startedAt < CONTACT_LIMITS.minFillMs) {
    return { ok: false, kind: "spam", error: "Geweigerd." };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length === 0) return { ok: false, kind: "invalid", error: "Vul je naam in." };
  if (name.length > CONTACT_LIMITS.nameMax || CONTROL_CHARS.test(name)) {
    return { ok: false, kind: "invalid", error: "Je naam is te lang of bevat ongeldige tekens." };
  }
  if (email.length === 0) return { ok: false, kind: "invalid", error: "Vul je e-mailadres in." };
  if (email.length > CONTACT_LIMITS.emailMax || CONTROL_CHARS.test(email) || !EMAIL_PATTERN.test(email)) {
    return { ok: false, kind: "invalid", error: "Vul een geldig e-mailadres in." };
  }
  if (message.length < CONTACT_LIMITS.messageMin) {
    return { ok: false, kind: "invalid", error: `Je bericht moet minstens ${CONTACT_LIMITS.messageMin} tekens lang zijn.` };
  }
  if (message.length > CONTACT_LIMITS.messageMax) {
    return { ok: false, kind: "invalid", error: `Je bericht mag maximaal ${CONTACT_LIMITS.messageMax} tekens lang zijn.` };
  }

  return { ok: true, value: { name, email, message } };
}
