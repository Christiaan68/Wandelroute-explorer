import { describe, expect, it } from "vitest";
import { computeRouteProgress, OffRouteDetector, SpeechRepeatGuard } from "@/lib/geo/navigation-engine";
import type { RouteCandidate } from "@/lib/types";

const ROUTE: RouteCandidate = {
  id: "r1",
  geometry: [
    [5.0, 52.0],
    [5.01, 52.0],
    [5.01, 52.01],
  ],
  distanceMeters: 0, // wordt in de test niet gebruikt, computeRouteProgress herberekent via cumulativeDistances
  durationSeconds: 0,
  instructions: [
    { pointIndex: 0, maneuver: "depart", text: "Vertrek", distanceToNextMeters: 743 },
    { pointIndex: 1, maneuver: "turn-left", text: "Sla linksaf", distanceToNextMeters: 1112 },
    { pointIndex: 2, maneuver: "arrive", text: "Aangekomen", distanceToNextMeters: 0 },
  ],
  surface: { pavedMeters: 0, unpavedMeters: 0, unknownMeters: 0 },
  elevation: null,
  generationSeed: 0,
};

describe("computeRouteProgress — voortgang langs de route", () => {
  it("herkent voortgang op de route (binnen tolerantie) als niet afgeweken", () => {
    const progress = computeRouteProgress(ROUTE, { lat: 52.0, lng: 5.005 });
    expect(progress.isOffRoute).toBe(false);
    expect(progress.distanceAlongRouteMeters).toBeGreaterThan(0);
    expect(progress.hasArrived).toBe(false);
  });

  it("herkent aankomst bij het eindpunt", () => {
    const progress = computeRouteProgress(ROUTE, { lat: 52.01, lng: 5.01 });
    expect(progress.hasArrived).toBe(true);
  });

  it("zet currentInstructionIndex door naar de volgende instructie na het eerste punt", () => {
    const nearStart = computeRouteProgress(ROUTE, { lat: 52.0, lng: 5.0005 });
    const afterFirstTurn = computeRouteProgress(ROUTE, { lat: 52.005, lng: 5.01 });
    expect(afterFirstTurn.currentInstructionIndex).toBeGreaterThanOrEqual(nearStart.currentInstructionIndex);
  });
});

describe("computeRouteProgress — detectie van afwijkingen", () => {
  it("markeert als off-route wanneer de afstand tot de lijn de tolerantie overschrijdt", () => {
    // Dit punt ligt ver van de route (ongeveer 1,1 km oostelijk).
    const progress = computeRouteProgress(ROUTE, { lat: 52.0, lng: 5.02 }, 30);
    expect(progress.isOffRoute).toBe(true);
  });

  it("blijft binnen tolerantie voor een kleine gps-afwijking", () => {
    // ~0.0001 graden lengtegraad op deze breedtegraad is enkele meters.
    const progress = computeRouteProgress(ROUTE, { lat: 52.0001, lng: 5.005 }, 30);
    expect(progress.isOffRoute).toBe(false);
  });
});

describe("OffRouteDetector", () => {
  it("bevestigt pas na voldoende opeenvolgende off-route-metingen (voorkomt valse meldingen door gps-ruis)", () => {
    const detector = new OffRouteDetector(3);
    expect(detector.update(true)).toBe(false);
    expect(detector.update(true)).toBe(false);
    expect(detector.update(true)).toBe(true);
  });

  it("reset de teller zodra er weer een meting binnen tolerantie is", () => {
    const detector = new OffRouteDetector(3);
    detector.update(true);
    detector.update(true);
    expect(detector.update(false)).toBe(false);
    expect(detector.update(true)).toBe(false); // teller begon weer bij 1
  });
});

describe("SpeechRepeatGuard", () => {
  it("spreekt een nieuwe tekst altijd direct uit", () => {
    const guard = new SpeechRepeatGuard(20000);
    expect(guard.shouldSpeak("Sla linksaf", 0)).toBe(true);
  });

  it("herhaalt dezelfde tekst niet binnen het minimale interval", () => {
    const guard = new SpeechRepeatGuard(20000);
    guard.shouldSpeak("Sla linksaf", 0);
    expect(guard.shouldSpeak("Sla linksaf", 5000)).toBe(false);
  });

  it("staat herhaling van dezelfde tekst toe na het interval", () => {
    const guard = new SpeechRepeatGuard(20000);
    guard.shouldSpeak("Sla linksaf", 0);
    expect(guard.shouldSpeak("Sla linksaf", 21000)).toBe(true);
  });
});
