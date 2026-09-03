import { describe, expect, it } from "vitest";
import { buildSpokenInstruction } from "@/lib/routing/instruction-text";

describe("buildSpokenInstruction — straatnaam bij afslaan", () => {
  it("voegt de straatnaam toe bij een afslag wanneer bekend", () => {
    const text = buildSpokenInstruction("turn-left", 90, "Betsy Westendorpstraat");
    expect(text).toBe("Over 90 meter linksaf, de Betsy Westendorpstraat in");
  });

  it("laat de straatnaam weg wanneer onbekend (bv. onbenoemd bospad)", () => {
    const text = buildSpokenInstruction("turn-left", 90, undefined);
    expect(text).toBe("Over 90 meter linksaf");
  });

  it("voegt geen straatnaam toe bij 'blijf rechtdoor lopen', ook niet als er wel een naam bekend is", () => {
    const text = buildSpokenInstruction("continue", 200, "Betsy Westendorpstraat");
    expect(text).toBe("Over 200 meter blijf rechtdoor lopen");
  });

  it("werkt ook in de 'sla nu af'-variant (afstand < 20m)", () => {
    const text = buildSpokenInstruction("turn-right", 10, "Kerkstraat");
    expect(text).toBe("Sla nu rechtsaf, de Kerkstraat in");
  });
});
