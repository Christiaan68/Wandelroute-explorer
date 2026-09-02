import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { WalkRecord } from "@/lib/types";

interface WandelrouteDB extends DBSchema {
  walks: {
    key: string;
    value: WalkRecord;
    indexes: { "by-date": string };
  };
}

const DB_NAME = "wandelroute-explorer";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WandelrouteDB>> | null = null;

/**
 * Opent (of maakt) de lokale IndexedDB-database. Alle opslag-code praat via
 * WalksRepository (zie walks-repository.ts) tegen dit bestand — mocht er
 * later een backend/API bijkomen, dan verandert alleen de implementatie van
 * die interface, niet de rest van de app.
 */
export function getDb(): Promise<IDBPDatabase<WandelrouteDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is niet beschikbaar in deze omgeving."));
  }
  if (!dbPromise) {
    dbPromise = openDB<WandelrouteDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("walks", { keyPath: "id" });
        store.createIndex("by-date", "date");
      },
    });
  }
  return dbPromise;
}

export type { WandelrouteDB };
