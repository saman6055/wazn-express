/**
 * Simple in-memory TTL cache for expensive query results.
 * Use for: dashboard stats (30s), exchange rates (5min), countries/warehouses lists (1hr).
 */

const store = new Map<string, { value: unknown; expiresAt: number }>();

const DEFAULT_TTL = {
  DASHBOARD_STATS_MS: 30 * 1000,
  EXCHANGE_RATES_MS: 5 * 60 * 1000,
  REFERENCE_LISTS_MS: 60 * 60 * 1000,
};

function isExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry || isExpired(entry.expiresAt)) {
    if (entry) store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const value = await factory();
  cacheSet(key, value, ttlMs);
  return value;
}

export function cacheInvalidate(keys: string[]): void {
  for (const k of keys) store.delete(k);
}

/**
 * Figures that must never be older than the last thing anyone saved.
 *
 * The finance cards add up every payment, box and order there is. Worked out
 * again on each visit, a page waited on several of them in turn. Kept here,
 * the answer is ready, and it is dropped the moment any mutation succeeds
 * (server/_core/trpc.ts), so the next look works it out again from the
 * records. Nothing is stored in the database: the figure is computed exactly
 * as before, only not twice in a row for nothing.
 *
 * The minute cap covers writes that do not come through a mutation (a
 * background job). A figure computed while a save was landing is not kept:
 * the generation it started under is checked before it is stored.
 */
const FRESH_PREFIX = "fresh:";
export const FRESH_TTL_MS = 60 * 1000;
let freshGeneration = 0;

export async function freshGetOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const fullKey = FRESH_PREFIX + key;
  const cached = cacheGet<T>(fullKey);
  if (cached !== undefined) return cached;
  const startedUnder = freshGeneration;
  const value = await factory();
  if (startedUnder === freshGeneration) cacheSet(fullKey, value, FRESH_TTL_MS);
  return value;
}

/** Something was saved: every fresh figure is worked out again on its next look. */
export function dropFreshFigures(): void {
  freshGeneration++;
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(FRESH_PREFIX)) store.delete(k);
  }
}

/** Forget everything — after a restore, nothing remembered from before may answer. */
export function cacheClear(): void {
  freshGeneration++;
  store.clear();
}

export const CACHE_TTL = DEFAULT_TTL;
