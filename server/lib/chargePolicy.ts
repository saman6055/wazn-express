import { batchMissingSellingPrice, type BatchPricingFacts } from "@shared/batchPricing";

/**
 * When a customer's shipping debt is born.
 *
 * The old rule wrote every charge at "batch marked delivered" — an office
 * event the customer never sees. The owner's decision (2026-09-09): the debt
 * exists the moment a batch HAS a selling price, whether the price was there
 * at creation or typed in a week later in Erbil, because from that moment the
 * amount is a fact (rate × weight) and hiding it is how the AZ070 case
 * happened — goods handed over against a balance of $0.00.
 *
 * Decision B, also the owner's: the new rule is for the future only. Batches
 * created before this date finish their lives under the old rule and post at
 * delivery, exactly as they always did; only batches born on or after it
 * charge on pricing. One constant, so the line cannot drift between readers.
 */
export const SHIPPING_CHARGE_ON_PRICING_FROM = new Date("2026-09-10T00:00:00+03:00");

/**
 * Does this batch charge its parcels now, on pricing?
 *
 * Three questions, all of them cheap: born under the new rule, and carrying a
 * price for the way it travels. A batch priced only through tiers or
 * per-customer agreements deliberately answers "no" here and falls back to
 * the delivery-time charge — those rates need per-customer resolution that
 * the pessimistic shared rule refuses to guess at.
 */
export function batchChargesOnPricing(batch: BatchPricingFacts & { createdAt?: Date | string | null }): boolean {
  if (!batch.createdAt) return false;
  const created = batch.createdAt instanceof Date ? batch.createdAt : new Date(batch.createdAt);
  if (isNaN(created.getTime()) || created < SHIPPING_CHARGE_ON_PRICING_FROM) return false;
  return !batchMissingSellingPrice(batch);
}
