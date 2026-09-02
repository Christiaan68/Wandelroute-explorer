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

describe("computeRouteProgress — rondwandelingen (start === eindpunt)", () => {
  // Vierkante lus van ~2,4 km, net als een door de routing-provider gegenereerde
  // rondwandeling: geometry[0] === geometry[laatste]. Regressietest voor een bug waarbij
  // de wandeling meteen na vertrek als "aangekomen" werd gemarkeerd, omdat het startpunt
  // en het (fysiek identieke) eindpunt van de lus qua rechte-lijn-afstand even dichtbij
  // konden liggen, en de gevonden "afstand langs de route" dan naar bijna-de-volledige-
  // lengte kon omslaan in plaats van naar 0.
  const LOOP_ROUTE: RouteCandidate = {
    id: "loop-1",
    geometry: [
      [5.0, 52.0],
      [5.009, 52.0],
      [5.009, 52.0055],
      [5.0, 52.0055],
      [5.0, 52.0],
    ],
    distanceMeters: 0,
    durationSeconds: 0,
    instructions: [
      { pointIndex: 0, maneuver: "depart", text: "Vertrek", distanceToNextMeters: 600 },
      { pointIndex: 4, maneuver: "arrive", text: "Aangekomen", distanceToNextMeters: 0 },
    ],
    surface: { pavedMeters: 0, unpavedMeters: 0, unknownMeters: 0 },
    elevation: null,
    generationSeed: 0,
  };
  const START = { lat: 52.0, lng: 5.0 };

  it("markeert een wandeling niet als voltooid vlak na vertrek vanaf het startpunt", () => {
    // Dit is exact het gerapporteerde scenario: eerste gps-fix, precies op het startpunt.
    const progress = computeRouteProgress(LOOP_ROUTE, START);
    expect(progress.hasArrived).toBe(false);
    expect(progress.distanceAlongRouteMeters).toBeLessThan(50);
  });

  it("herkent aankomst wel als de vorige voortgang al bijna de volledige lus was", () => {
    const totalMeters = computeRouteProgress(LOOP_ROUTE, START).totalDistanceMeters;
    // Simuleer dat de vorige meting al bijna rond was (net als NavigationScreen dat per
    // gps-update doorgeeft via previousDistanceAlongRouteMeters).
    const progress = computeRouteProgress(LOOP_ROUTE, START, undefined, totalMeters - 15);
    expect(progress.hasArrived).toBe(true);
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
