import type { WalkRecord } from "@/lib/types";
import { getDb } from "@/lib/storage/db";

/**
 * Repository-interface voor wandelgeschiedenis. De MVP bewaart alles lokaal
 * (IndexedDB) omdat de opdracht dat voor v1 vraagt, maar UI-code importeert
 * altijd deze interface — nooit db.ts of idb rechtstreeks. Zodra er
 * gebruikersaccounts + een backend bijkomen, voeg je een
 * `RestWalksRepository implements WalksRepository` toe die dezelfde
 * methodes tegen een API praat, en wissel je in `getWalksRepository()` de
 * implementatie — de schermen en tests hoeven niet te veranderen.
 */
export interface WalksRepository {
  getAll(): Promise<WalkRecord[]>;
  getById(id: string): Promise<WalkRecord | undefined>;
  save(walk: WalkRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

export class IndexedDbWalksRepository implements WalksRepository {
  async getAll(): Promise<WalkRecord[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex("walks", "by-date");
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getById(id: string): Promise<WalkRecord | undefined> {
    const db = await getDb();
    return db.get("walks", id);
  }

  async save(walk: WalkRecord): Promise<void> {
    const db = await getDb();
    await db.put("walks", walk);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete("walks", id);
  }
}

/** In-memory implementatie, puur voor unit tests en storybook-achtig gebruik zonder IndexedDB. */
export class InMemoryWalksRepository implements WalksRepository {
  private readonly walks = new Map<string, WalkRecord>();

  async getAll(): Promise<WalkRecord[]> {
    return [...this.walks.values()].sort((a, b) => b.date.localeCompare(a.date));
  }
  async getById(id: string): Promise<WalkRecord | undefined> {
    return this.walks.get(id);
  }
  async save(walk: WalkRecord): Promise<void> {
    this.walks.set(walk.id, walk);
  }
  async remove(id: string): Promise<void> {
    this.walks.delete(id);
  }
}

let repository: WalksRepository | null = null;

export function getWalksRepository(): WalksRepository {
  if (!repository) {
    repository = typeof indexedDB !== "undefined" ? new IndexedDbWalksRepository() : new InMemoryWalksRepository();
  }
  return repository;
}

/** Alleen voor tests: injecteer een schone repository. */
export function __setWalksRepositoryForTests(repo: WalksRepository): void {
  repository = repo;
}
