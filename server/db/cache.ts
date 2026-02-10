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

export const CACHE_TTL = DEFAULT_TTL;
