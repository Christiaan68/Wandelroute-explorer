"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Coordinate, LngLat } from "@/lib/types";

const DEFAULT_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export interface MapViewProps {
  /** Volledige geplande route (grijs/basislijn), of tijdens navigatie de resterende route. */
  routeGeometry?: LngLat[];
  /** Al gelopen deel van de route, apart gestyled. */
  traveledGeometry?: LngLat[];
  startPoint?: Coordinate;
  /** Live gebruikerspositie tijdens navigatie. */
  userPosition?: Coordinate;
  userHeadingDegrees?: number | null;
  className?: string;
  /** Volg automatisch de gebruikerspositie (navigatiemodus) i.p.v. het hele traject te tonen. */
  followUser?: boolean;
  fitPadding?: number;
  /** Als aanwezig: kaart is klikbaar om een startpunt te kiezen. */
  onMapClick?: (coordinate: Coordinate) => void;
}

const SOURCE_ROUTE = "route";
const SOURCE_TRAVELED = "traveled";
const SOURCE_START = "start-point";
const SOURCE_USER = "user-position";

export function MapView({
  routeGeometry,
  traveledGeometry,
  startPoint,
  userPosition,
  userHeadingDegrees,
  className,
  followUser = false,
  fitPadding = 48,
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE_URL,
      center: startPoint ? [startPoint.lng, startPoint.lat] : [5.2913, 52.1326],
      zoom: startPoint ? 14 : 6.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (e) => onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;

    map.on("load", () => {
      loadedRef.current = true;

      map.addSource(SOURCE_ROUTE, { type: "geojson", data: lineFeature([]) });
      map.addLayer({
        id: SOURCE_ROUTE,
        type: "line",
        source: SOURCE_ROUTE,
        paint: { "line-color": "#3a663c", "line-width": 5, "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.addSource(SOURCE_TRAVELED, { type: "geojson", data: lineFeature([]) });
      map.addLayer({
        id: SOURCE_TRAVELED,
        type: "line",
        source: SOURCE_TRAVELED,
        paint: { "line-color": "#8d8f96", "line-width": 5, "line-opacity": 0.85 },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.addSource(SOURCE_START, { type: "geojson", data: pointFeature(null) });
      map.addLayer({
        id: SOURCE_START,
        type: "circle",
        source: SOURCE_START,
        paint: { "circle-radius": 8, "circle-color": "#2f5231", "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
      });

      map.addSource(SOURCE_USER, { type: "geojson", data: pointFeature(null) });
      map.addLayer({
        id: SOURCE_USER,
        type: "circle",
        source: SOURCE_USER,
        paint: { "circle-radius": 9, "circle-color": "#1d4ed8", "circle-stroke-width": 3, "circle-stroke-color": "#fff" },
      });

      applyData();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyData() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    (map.getSource(SOURCE_ROUTE) as maplibregl.GeoJSONSource | undefined)?.setData(lineFeature(routeGeometry ?? []));
    (map.getSource(SOURCE_TRAVELED) as maplibregl.GeoJSONSource | undefined)?.setData(
      lineFeature(traveledGeometry ?? []),
    );
    (map.getSource(SOURCE_START) as maplibregl.GeoJSONSource | undefined)?.setData(
      pointFeature(startPoint ? [startPoint.lng, startPoint.lat] : null),
    );
    (map.getSource(SOURCE_USER) as maplibregl.GeoJSONSource | undefined)?.setData(
      pointFeature(userPosition ? [userPosition.lng, userPosition.lat] : null),
    );

    if (followUser && userPosition) {
      map.easeTo({
        center: [userPosition.lng, userPosition.lat],
        bearing: userHeadingDegrees ?? map.getBearing(),
        zoom: Math.max(map.getZoom(), 17),
        duration: 400,
      });
    } else {
      const all = [...(routeGeometry ?? []), ...(traveledGeometry ?? [])];
      if (all.length > 1) {
        const bounds = all.reduce(
          (b, coord) => b.extend(coord as [number, number]),
          new maplibregl.LngLatBounds(all[0] as [number, number], all[0] as [number, number]),
        );
        map.fitBounds(bounds, { padding: fitPadding, maxZoom: 17, duration: 300 });
      } else if (startPoint) {
        map.easeTo({ center: [startPoint.lng, startPoint.lat], zoom: 14, duration: 300 });
      }
    }
  }

  useEffect(applyData, [
    routeGeometry,
    traveledGeometry,
    startPoint,
    userPosition,
    userHeadingDegrees,
    followUser,
    fitPadding,
  ]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} role="img" aria-label="Kaart met wandelroute" />;
}

function lineFeature(coords: LngLat[]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords.length > 1 ? coords : [] } };
}

function pointFeature(coord: LngLat | null): GeoJSON.Feature<GeoJSON.Point> | GeoJSON.FeatureCollection {
  if (!coord) return { type: "FeatureCollection", features: [] };
  return { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coord } };
}
