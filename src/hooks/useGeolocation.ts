"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinate } from "@/lib/types";

export interface GeolocationFix {
  coordinate: Coordinate;
  accuracyMeters: number;
  headingDegrees: number | null;
  speedMps: number | null;
  timestamp: number;
}

interface UseGeolocationOptions {
  /** Zet pas op true zodra de gebruiker daadwerkelijk om locatie vraagt (bv. bij "Nu vertrekken"). */
  enabled: boolean;
  onPosition?: (fix: GeolocationFix) => void;
}

interface UseGeolocationResult {
  fix: GeolocationFix | null;
  error: string | null;
  permissionDenied: boolean;
}

/**
 * Volgt de live GPS-positie via watchPosition. Vraagt toestemming pas aan
 * wanneer `enabled` true wordt (zie project-instructie: "vraag gps-toestemming
 * pas wanneer deze nodig is").
 */
export function useGeolocation({ enabled, onPosition }: UseGeolocationOptions): UseGeolocationResult {
  const [fix, setFix] = useState<GeolocationFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Deze browser ondersteunt geen locatiebepaling.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next: GeolocationFix = {
          coordinate: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracyMeters: position.coords.accuracy,
          // Sommige toestellen/browsers geven bij stilstaan of langzaam lopen
          // NaN terug in plaats van null (bekende eigenaardigheid van de
          // gps-API). NaN zou verderop de kaart-camera laten vastlopen, dus
          // behandel het hier expliciet als "geen richting bekend".
          headingDegrees: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speedMps: position.coords.speed,
          timestamp: position.timestamp,
        };
        setFix(next);
        setError(null);
        onPositionRef.current?.(next);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError("Locatietoegang is geweigerd. Zet locatie aan in je browser-/systeeminstellingen om te navigeren.");
        } else if (err.code === err.TIMEOUT) {
          setError("Kon nog geen gps-signaal vinden. Zorg voor vrij zicht op de hemel.");
        } else {
          setError("Kon de locatie niet bepalen (gps-signaal tijdelijk kwijt).");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return { fix, error, permissionDenied };
}

/** Eenmalige locatie-opvraging, bv. voor "gebruik huidige locatie" op het zoekscherm. */
export function getCurrentPositionOnce(): Promise<Coordinate> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Deze browser ondersteunt geen locatiebepaling."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("Locatietoegang geweigerd."));
        else reject(new Error("Kon de huidige locatie niet bepalen."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export function useNoop() {
  return useCallback(() => {}, []);
}
