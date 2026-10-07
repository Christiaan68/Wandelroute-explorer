import type { StyleSpecification } from "maplibre-gl";

/**
 * Kaartbron voor de app, te kiezen via de environment variable
 * NEXT_PUBLIC_MAP_PROVIDER:
 *
 *  - "osm" (standaard): de standaardkaart van openstreetmap.org (losse
 *    raster-tegels). Toont kleine onverharde paden en stoplichten/kruispunt-
 *    symbolen — iets wat de OpenMapTiles-vectorkaart van OpenFreeMap niet kan,
 *    omdat stoplichten daar niet in de brondata zitten.
 *  - "openfreemap": de vorige kaart (vector-tegels van OpenFreeMap, stijl
 *    "Liberty" of de stijl uit NEXT_PUBLIC_MAP_STYLE_URL).
 *
 * TERUGDRAAIEN: zet NEXT_PUBLIC_MAP_PROVIDER=openfreemap (lokaal in
 * .env.local en/of in Vercel) en deploy opnieuw — er is geen codewijziging
 * nodig.
 *
 * Gebruiksbeleid van de OSM-tegelserver (https://operations.osmfoundation.org/policies/tiles/):
 * bedoeld voor licht, interactief gebruik; geen garantie op beschikbaarheid;
 * bij te veel verkeer kan toegang zonder waarschuwing worden geblokkeerd. De
 * bronvermelding moet duidelijk zichtbaar zijn (niet verstopt achter een
 * knopje) — zie `usesCompactAttribution` hieronder. De browser stuurt zelf een
 * correcte Referer mee (geen restrictieve Referrer-Policy ingesteld).
 */
export type MapProvider = "osm" | "openfreemap";

export const OPENFREEMAP_DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Hoogste zoomniveau waarvoor de OSM-standaardkaart tegels levert. */
export const OSM_MAX_ZOOM = 19;

/**
 * Let op: "||" i.p.v. "??" bij het lezen van de env var, en onbekende/lege
 * waarden vallen terug op "osm". Vercel vult een lege waarde in voor variabelen
 * uit .env.example (zie ook de toelichting bij MapView.tsx).
 */
export function resolveMapProvider(raw: string | undefined): MapProvider {
  return raw?.trim().toLowerCase() === "openfreemap" ? "openfreemap" : "osm";
}

export function resolveOpenFreeMapStyleUrl(raw: string | undefined): string {
  return raw?.trim() || OPENFREEMAP_DEFAULT_STYLE_URL;
}

export function buildOsmRasterStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [OSM_TILE_URL],
        tileSize: 256,
        maxzoom: OSM_MAX_ZOOM,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>',
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

export interface MapConfig {
  provider: MapProvider;
  style: string | StyleSpecification;
  /** Hoogste zoomniveau van de kaart (alleen bij OSM beperkt: daarboven bestaan geen tegels). */
  maxZoom?: number;
  /** OSM eist een duidelijk zichtbare bronvermelding, dus bij OSM NIET inklappen. */
  usesCompactAttribution: boolean;
}

export function getMapConfig(env: { provider?: string; styleUrl?: string } = {
  provider: process.env.NEXT_PUBLIC_MAP_PROVIDER,
  styleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
}): MapConfig {
  const provider = resolveMapProvider(env.provider);
  if (provider === "openfreemap") {
    return { provider, style: resolveOpenFreeMapStyleUrl(env.styleUrl), usesCompactAttribution: true };
  }
  return { provider, style: buildOsmRasterStyle(), maxZoom: OSM_MAX_ZOOM, usesCompactAttribution: false };
}
