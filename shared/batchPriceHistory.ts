/**
 * Which money fields of a batch changed, old value → new value.
 *
 * The owner's rule (Sep 2026): every edit to what a shipment costs us or
 * what a kilo sells for must leave the previous number on the record — a
 * small history under the cost box — because these five numbers are where
 * the company's profit lives, and an overwritten figure used to be simply
 * gone.
 *
 * One pure rule, used by the server when a batch is updated and by the
 * guard tests. `undefined` in the patch means the field was not touched
 * (the form never sent it); `null` or "" means it was deliberately
 * cleared. Values are compared as numbers so "9.1" → "9.10" is not a
 * change, and normalized to two decimals — the same shape the decimal
 * columns store.
 */

export const PRICE_HISTORY_FIELDS = [
  "costPerKg",
  "costPerCbm",
  "shippingCost",
  "pricePerKg",
  "pricePerCbm",
] as const;

export type PriceHistoryField = (typeof PRICE_HISTORY_FIELDS)[number];

export interface PriceFieldChange {
  field: PriceHistoryField;
  /** Two-decimal string, or null when the field was empty. */
  oldValue: string | null;
  newValue: string | null;
}

/** "9.1" → "9.10", "" / null / garbage → null. */
export function normalizePriceValue(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

export function diffPriceFields(
  before: Partial<Record<PriceHistoryField, string | number | null>>,
  patch: Partial<Record<PriceHistoryField, string | number | null | undefined>>,
): PriceFieldChange[] {
  const changes: PriceFieldChange[] = [];
  for (const field of PRICE_HISTORY_FIELDS) {
    if (!(field in patch) || patch[field] === undefined) continue;
    const oldValue = normalizePriceValue(before[field]);
    const newValue = normalizePriceValue(patch[field]);
    if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
  }
  return changes;
}

/**
 * A batch that has reached the customer is settled. Its weights were
 * final at delivery, its cost was derived and invoiced from them — an
 * edit after that would change history that money already moved on.
 * Corrections go through the post-delivery adjustment flow, or by
 * moving the status back on purpose.
 */
export function isBatchEditLocked(status: string | null | undefined): boolean {
  return status === "delivered" || status === "closed";
}

/**
 * The main admin may still correct a delivered batch, whenever he wants
 * (owner, 2026-10-04). Moving the status back to edit it was the only way,
 * and that told every customer in it "your goods have arrived" again and
 * showed their parcels as "in customs". His edit leaves the status alone.
 */
export function mayEditLockedBatch(role: string | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * What stays fixed even for him: the selling side. The customers were
 * charged from it at delivery, and changing it on the batch would not change
 * a single charge — the batch would show one price and the accounts another.
 * A customer's price is corrected with the per-customer adjustment, which
 * posts the difference.
 */
export interface SellingSide {
  pricePerKg?: string | number | null;
  pricePerCbm?: string | number | null;
  useTieredPricing?: boolean | null;
}

const sameAmount = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  const x = a === null || a === undefined || a === "" ? 0 : Number(a);
  const y = b === null || b === undefined || b === "" ? 0 : Number(b);
  return Math.abs(x - y) < 0.005;
};

/** True when this save would change what the customers were charged from. */
export function sellingSideChanged(
  next: SellingSide & { pricingTiers?: unknown; customerPricing?: unknown },
  stored: SellingSide,
): boolean {
  if (next.pricingTiers !== undefined || next.customerPricing !== undefined) return true;
  if (next.pricePerKg !== undefined && !sameAmount(next.pricePerKg, stored.pricePerKg)) return true;
  if (next.pricePerCbm !== undefined && !sameAmount(next.pricePerCbm, stored.pricePerCbm)) return true;
  if (next.useTieredPricing !== undefined && !!next.useTieredPricing !== !!stored.useTieredPricing) return true;
  return false;
}
