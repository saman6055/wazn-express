/**
 * Three small helpers for data entry, each too small for a file of its own.
 */

/**
 * "Same again, different tracking": a copy of the last entry with the named
 * fields emptied — text to "", a list to [], anything else to undefined.
 * Nothing else is touched, and the original is left as it was.
 */
export function duplicateEntry<T extends Record<string, unknown>>(values: T, clear: readonly (keyof T)[]): T {
  const copy: Record<string, unknown> = { ...values };
  for (const key of clear) {
    const current = values[key];
    copy[key as string] = typeof current === "string" ? "" : Array.isArray(current) ? [] : undefined;
  }
  return copy as T;
}

/**
 * One press, one save. On a slow line the save button was pressed again
 * while the first request was still on its way, and the entry was saved
 * twice. While `run` is working, another call is ignored (it resolves to
 * undefined); the lock opens when the work ends, whether it succeeded or not.
 */
export function createShield() {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run<T>(work: () => Promise<T> | T): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await work();
      } finally {
        busy = false;
      }
    },
  };
}

/** Click-to-filter: the rows whose fields equal every chosen value. */
export function matchesFilters<T>(
  row: T,
  filters: Readonly<Record<string, string>>,
  read: (row: T, field: string) => unknown,
): boolean {
  return Object.entries(filters).every(([field, value]) => String(read(row, field) ?? "") === value);
}

/** Choosing the value already chosen clears that filter; anything else sets it. */
export function toggleFilter(filters: Readonly<Record<string, string>>, field: string, value: string): Record<string, string> {
  const next = { ...filters };
  if (next[field] === value) delete next[field];
  else next[field] = value;
  return next;
}
