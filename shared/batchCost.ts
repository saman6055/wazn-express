/**
 * What one shipment cost the company, from whichever number was recorded.
 *
 * The office knows the cost of a batch in one of two shapes. Sometimes the
 * carrier quotes a rate — $7.00 per kg — and that is what gets typed. Just as
 * often the carrier's invoice arrives as one figure for the whole shipment —
 * $2,000 — days after the batch was created, and nobody sits down to divide
 * it. The total was stored (`batches.shippingCost`) and then read by nothing:
 * every profit figure multiplied the per-unit rate, so a batch recorded only
 * by its total showed a cost of zero and a profit that was pure fiction.
 *
 * One rule, asked by everything that needs a cost:
 *
 *   1. An explicit per-unit rate wins. It is the more deliberate entry, and
 *      once the total has been divided (see `deriveCostRate`) both are set
 *      and agree.
 *   2. Otherwise the recorded total IS the cost, and the per-unit rate is
 *      derived from it when the billed base is known.
 *   3. Neither recorded — the cost is honestly zero, and `source` says so,
 *      so a screen can show "تێچوو تۆمار نەکراوە" instead of a confident 0.
 *
 * Air batches divide over chargeable kilograms, sea over CBM — the same
 * bases the customer side already bills in.
 */

export type BatchCostSource = "rate" | "total" | "none";

export interface BatchCostInputs {
  shippingType?: string | null;
  /** Explicit per-unit rates, as stored (decimal strings or numbers). */
  costPerKg?: string | number | null;
  costPerCbm?: string | number | null;
  /** The carrier's one figure for the whole shipment. */
  shippingCost?: string | number | null;
  /** Billed base for an air batch: chargeable kilograms. */
  chargeableKg?: number;
  /** Billed base for a sea batch: cubic meters. */
  totalCbm?: number;
}

export interface BatchCostResult {
  totalCostUsd: number;
  /** Cost per kg (air) or per CBM (sea). 0 when it cannot be known yet. */
  effectiveRate: number;
  unit: "kg" | "cbm";
  source: BatchCostSource;
}

const positive = (value: string | number | null | undefined): number => {
  const n = parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * What the carrier's rate multiplies — one answer for every screen.
 *
 * The weight (or volume) the carrier billed; failing that, the weight on its
 * scale; failing that, what our own parcels weigh plain. Owner, 2026-10-04:
 * the old batches were filled with a rate and the "actual weight" only, and
 * every report still said they cost nothing, while the batch's own page
 * multiplied the rate by our parcels' volume weight — two answers for one
 * shipment. The carrier charges the plain weight (we charge the volume), so
 * the last fallback is our parcels' plain weight, not their chargeable one.
 */
export function carrierCostBase(
  shippingType: string | null | undefined,
  batch: {
    chargedWeightKg?: string | number | null;
    actualWeightKg?: string | number | null;
    chargedCbm?: string | number | null;
    actualCbm?: string | number | null;
  },
  parcels: { weightKg: number; cbm: number },
): number {
  return isSeaCost(shippingType)
    ? positive(batch.chargedCbm) || positive(batch.actualCbm) || Math.max(0, parcels.cbm)
    : positive(batch.chargedWeightKg) || positive(batch.actualWeightKg) || Math.max(0, parcels.weightKg);
}

/** The same rule in SQL, for the reports that read many batches at once. */
export const CARRIER_BASE_KG_SQL = `COALESCE(
  NULLIF(CAST(COALESCE(batches.chargedWeightKg, 0) AS DECIMAL(12,2)), 0),
  NULLIF(CAST(COALESCE(batches.actualWeightKg, 0) AS DECIMAL(12,2)), 0),
  (SELECT COALESCE(SUM(CAST(COALESCE(p.weightKg, 0) AS DECIMAL(12,3))), 0) FROM packages p WHERE p.batchId = batches.id))`;
export const CARRIER_BASE_CBM_SQL = `COALESCE(
  NULLIF(CAST(COALESCE(batches.chargedCbm, 0) AS DECIMAL(12,4)), 0),
  NULLIF(CAST(COALESCE(batches.actualCbm, 0) AS DECIMAL(12,4)), 0),
  (SELECT COALESCE(SUM(CAST(COALESCE(p.volumeCbm, 0) AS DECIMAL(12,4))), 0) FROM packages p WHERE p.batchId = batches.id))`;

export function isSeaCost(shippingType?: string | null): boolean {
  return shippingType === "sea";
}

export function resolveBatchCost(inputs: BatchCostInputs): BatchCostResult {
  const sea = isSeaCost(inputs.shippingType);
  const unit = sea ? ("cbm" as const) : ("kg" as const);
  const base = sea ? inputs.totalCbm ?? 0 : inputs.chargeableKg ?? 0;
  const rate = sea ? positive(inputs.costPerCbm) : positive(inputs.costPerKg);
  const total = positive(inputs.shippingCost);

  // A rate needs its weight. With no billed base yet, rate × 0 said the
  // batch cost nothing and every dollar of its freight looked like profit
  // (found 2026-10-03 on AIR-2026-035, -043, -046, -047, -056, -059, -060
  // and SEA-068: a rate, no weight, and the carrier's total sitting unused).
  if (rate > 0 && base > 0) {
    return { totalCostUsd: rate * base, effectiveRate: rate, unit, source: "rate" };
  }
  if (total > 0) {
    return {
      totalCostUsd: total,
      effectiveRate: base > 0 ? total / base : 0,
      unit,
      source: "total",
    };
  }
  // A rate is known but not yet what it multiplies: the cost is honestly
  // not known yet, which "none" says.
  return { totalCostUsd: 0, effectiveRate: rate, unit, source: "none" };
}

/**
 * The per-unit rate to write back once the shipment's billed base is known —
 * the "divide the $2,000 over the kilos" step, run when the batch is
 * delivered and the weights are final.
 *
 * Null when there is nothing to derive: a rate is already set, no total was
 * recorded, or the base is still zero. Rounded to cents because the column
 * holds two decimals; the total itself stays the exact figure, so reports
 * that want the true cost read the total, not rate × base.
 */
export function deriveCostRate(inputs: BatchCostInputs): number | null {
  const resolved = resolveBatchCost(inputs);
  if (resolved.source !== "total" || resolved.effectiveRate <= 0) return null;
  return Math.round(resolved.effectiveRate * 100) / 100;
}
