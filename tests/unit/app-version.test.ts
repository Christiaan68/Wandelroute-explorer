import { describe, expect, it } from "vitest";
import { decideUpdateAction, isSafeToReload, LOCAL_VERSION } from "@/lib/app-version";

describe("isSafeToReload", () => {
  it("staat herladen toe op gewone schermen", () => {
    for (const p of ["/", "/geschiedenis", "/instellingen", "/faq", "/samenvatting"]) {
      expect(isSafeToReload(p)).toBe(true);
    }
  });
  it("stelt herladen uit tijdens navigatie, routevoorstel en contactformulier", () => {
    for (const p of ["/navigeren", "/voorstel", "/contact", "/navigeren/x"]) {
      expect(isSafeToReload(p)).toBe(false);
    }
  });
  it("is voorzichtig zonder bekend scherm", () => {
    expect(isSafeToReload(null)).toBe(false);
  });
});

describe("decideUpdateAction", () => {
  it("doet niets als de versie gelijk is", () => {
    expect(decideUpdateAction("a", "a", "/", null)).toBe("none");
  });
  it("herlaadt bij een nieuwe versie op een veilig scherm", () => {
    expect(decideUpdateAction("a", "b", "/", null)).toBe("reload");
  });
  it("stelt uit tijdens navigatie", () => {
    expect(decideUpdateAction("a", "b", "/navigeren", null)).toBe("defer");
  });
  it("herlaadt niet nogmaals voor dezelfde versie (geen herlaadlus)", () => {
    expect(decideUpdateAction("a", "b", "/", "b")).toBe("none");
  });
  it("herlaadt wel voor een nog nieuwere versie", () => {
    expect(decideUpdateAction("a", "c", "/", "b")).toBe("reload");
  });
  it("doet niets lokaal, zonder versie of zonder antwoord", () => {
    expect(decideUpdateAction(LOCAL_VERSION, "b", "/", null)).toBe("none");
    expect(decideUpdateAction("", "b", "/", null)).toBe("none");
    expect(decideUpdateAction("a", undefined, "/", null)).toBe("none");
    expect(decideUpdateAction("a", "", "/", null)).toBe("none");
  });
});
