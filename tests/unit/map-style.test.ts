import { describe, expect, it } from "vitest";
import {
  getMapConfig,
  OPENFREEMAP_DEFAULT_STYLE_URL,
  OSM_MAX_ZOOM,
  resolveMapProvider,
  resolveOpenFreeMapStyleUrl,
} from "@/lib/map/map-style";

describe("resolveMapProvider", () => {
  it("kiest standaard (niet ingesteld of lege string zoals Vercel die kan invullen) de OSM-standaardkaart", () => {
    expect(resolveMapProvider(undefined)).toBe("osm");
    expect(resolveMapProvider("")).toBe("osm");
    expect(resolveMapProvider("   ")).toBe("osm");
  });

  it("kiest OpenFreeMap alleen bij de waarde 'openfreemap' (hoofdletters/spaties maken niet uit)", () => {
    expect(resolveMapProvider("openfreemap")).toBe("openfreemap");
    expect(resolveMapProvider("  OpenFreeMap ")).toBe("openfreemap");
  });

  it("valt bij een onbekende waarde terug op OSM", () => {
    expect(resolveMapProvider("google")).toBe("osm");
  });
});

describe("resolveOpenFreeMapStyleUrl", () => {
  it("gebruikt de standaard Liberty-stijl bij een lege of ontbrekende waarde", () => {
    expect(resolveOpenFreeMapStyleUrl(undefined)).toBe(OPENFREEMAP_DEFAULT_STYLE_URL);
    expect(resolveOpenFreeMapStyleUrl("")).toBe(OPENFREEMAP_DEFAULT_STYLE_URL);
  });

  it("gebruikt een zelf opgegeven stijl-URL", () => {
    expect(resolveOpenFreeMapStyleUrl("https://tiles.openfreemap.org/styles/bright")).toBe(
      "https://tiles.openfreemap.org/styles/bright",
    );
  });
});

describe("getMapConfig", () => {
  it("geeft voor OSM een rasterstijl met zichtbare (niet-compacte) bronvermelding en maximale zoom 19", () => {
    const config = getMapConfig({ provider: undefined, styleUrl: "https://tiles.openfreemap.org/styles/bright" });
    expect(config.provider).toBe("osm");
    expect(config.usesCompactAttribution).toBe(false);
    expect(config.maxZoom).toBe(OSM_MAX_ZOOM);
    expect(typeof config.style).toBe("object");
    const style = config.style as { sources: Record<string, { tiles: string[]; attribution: string }> };
    expect(style.sources.osm!.tiles[0]).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(style.sources.osm!.attribution).toContain("OpenStreetMap");
  });

  it("geeft voor 'openfreemap' de oude vectorstijl-URL (terugdraaien zonder codewijziging)", () => {
    const config = getMapConfig({ provider: "openfreemap", styleUrl: "" });
    expect(config.provider).toBe("openfreemap");
    expect(config.style).toBe(OPENFREEMAP_DEFAULT_STYLE_URL);
    expect(config.usesCompactAttribution).toBe(true);
    expect(config.maxZoom).toBeUndefined();
  });
});
