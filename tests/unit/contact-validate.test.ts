import { describe, expect, it } from "vitest";
import { validateContact } from "@/lib/contact/validate";

const NOW = 1_800_000_000_000;
const ok = { name: "Jan Jansen", email: "jan@example.nl", message: "Leuke app, één vraag over de kaart.", website: "", startedAt: NOW - 20_000 };

describe("contactformulier: controle op de server", () => {
  it("accepteert een normaal ingevuld bericht en haalt spaties weg", () => {
    const r = validateContact({ ...ok, name: "  Jan Jansen " }, NOW);
    expect(r).toEqual({ ok: true, value: { name: "Jan Jansen", email: "jan@example.nl", message: ok.message } });
  });

  it("herkent een bot aan het ingevulde lokveld of aan te snel invullen", () => {
    expect(validateContact({ ...ok, website: "http://spam.example" }, NOW)).toMatchObject({ ok: false, kind: "spam" });
    expect(validateContact({ ...ok, startedAt: NOW - 500 }, NOW)).toMatchObject({ ok: false, kind: "spam" });
    expect(validateContact({ ...ok, startedAt: undefined }, NOW)).toMatchObject({ ok: false, kind: "spam" });
  });

  it("vereist naam, geldig e-mailadres en een bericht van redelijke lengte", () => {
    expect(validateContact({ ...ok, name: " " }, NOW)).toMatchObject({ ok: false, kind: "invalid" });
    expect(validateContact({ ...ok, email: "geen-adres" }, NOW)).toMatchObject({ ok: false, kind: "invalid" });
    expect(validateContact({ ...ok, message: "kort" }, NOW)).toMatchObject({ ok: false, kind: "invalid" });
    expect(validateContact({ ...ok, message: "x".repeat(5001) }, NOW)).toMatchObject({ ok: false, kind: "invalid" });
  });

  it("weigert regeleinden in naam of e-mail (geen extra mailheaders mogelijk)", () => {
    expect(validateContact({ ...ok, name: "Jan\r\nBcc: slachtoffer@example.nl" }, NOW)).toMatchObject({ ok: false, kind: "invalid" });
    expect(validateContact({ ...ok, email: "jan@example.nl\nBcc: x@example.nl" }, NOW)).toMatchObject({ ok: false, kind: "invalid" });
  });

  it("weigert onzin-invoer", () => {
    expect(validateContact(null, NOW)).toMatchObject({ ok: false });
    expect(validateContact("tekst", NOW)).toMatchObject({ ok: false });
  });
});
