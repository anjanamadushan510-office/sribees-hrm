import { buildSeed } from '../data/seed';
import type { Database } from '../types';

const DB_KEY = 'sribees.hrms.db.v1';
const SESSION_KEY = 'sribees.hrms.session.v1';

let cache: Database | null = null;

function readStorage(): Database | null {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Database;
  } catch {
    return null;
  }
}

function writeStorage(db: Database): void {
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {

    /* storage may be unavailable — the in-memory cache still works */}
}

export function getDb(): Database {
  if (cache) return cache;
  cache = readStorage() ?? buildSeed();
  writeStorage(cache);
  return cache;
}

/** Applies a mutation and persists it. Mirrors a single transactional write. */
export function mutate<T>(fn: (db: Database) => T): T {
  const db = getDb();
  const result = fn(db);
  writeStorage(db);
  return result;
}

export function resetDb(): void {
  cache = buildSeed();
  writeStorage(cache);
}

export function readSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(userId: string | null): void {
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId);else
    window.localStorage.removeItem(SESSION_KEY);
  } catch {

    /* ignore */}
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Simulated network latency so loading states are real, not decorative. */
export function sleep(ms = 260): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}