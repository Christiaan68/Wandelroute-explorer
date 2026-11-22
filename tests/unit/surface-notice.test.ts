import { describe, expect, it } from "vitest";
import { describeSurfaceMismatch } from "@/components/RouteStatsCard";
import { toRouteSummaryView } from "@/lib/route-generation/describe";
import type { RouteCandidate } from "@/lib/types";

function candidate(paved: number, unpaved: number, unknown: number): RouteCandidate {
  return {
    id: "t",
    geometry: [],
    distanceMeters: 5300,
    durationSeconds: 3800,
    instructions: [],
    surface: { pavedMeters: paved, unpavedMeters: unpaved, unknownMeters: unknown },
    elevation: null,
    generationSeed: 0,
  };
}

describe("ondergrond: melding en omschrijving", () => {
  it("meldt het als 'onverhard' gekozen is maar de route vooral verhard is (situatie Utrecht Centraal)", () => {
    const text = describeSurfaceMismatch("unpaved", 0.61, 0.05);
    expect(text).toMatch(/Je koos voor onverhard/);
    expect(text).toMatch(/5% onverhard/);
  });

  it("geeft geen melding als de voorkeur gehaald is of 'gemengd' gekozen is", () => {
    expect(describeSurfaceMismatch("unpaved", 0.15, 0.54)).toBeNull();
    expect(describeSurfaceMismatch("mixed", 0.9, 0.05)).toBeNull();
    expect(describeSurfaceMismatch("paved", 0.75, 0.2)).toBeNull();
  });

  it("noemt een route met 61% verhard, 5% onverhard en 34% onbekend 'voornamelijk verhard' en niet 'mix'", () => {
    const view = toRouteSummaryView(candidate(3233, 265, 1802));
    expect(view.description).toMatch(/voornamelijk over verharde paden/);
  });
});
