/**
 * Which rate a customer is billed at for one shipment.
 *
 * A shipment can carry three answers at once: a rate agreed with this
 * particular customer, a tiered rate that depends on how much they shipped,
 * and the shipment's own default. The order between them was written out by
 * hand in four places — the financial report, the portal preview, the
 * per-package delivery charge and the batch invoice run — and two of them
 * had left the customer's own rate out.
 *
 * The result was a customer with an agreed rate seeing it in the portal and
 * on the profit report, and then being invoiced at the shipment default.
 * Nobody would notice until they did, and then it is an argument about a bill
 * we sent.
 *
 * So the order lives here, once:
 *
 *   1. the rate agreed with this customer for this shipment
 *   2. the tier their total falls into, if the shipment is priced in tiers
 *   3. the shipment's own rate
 *
 * This decides only which rate applies. Multiplying it by weight or volume,
 * and everything about invoices, stays where it was.
 */

export type RateSource = "customer" | "tier" | "batch" | "none";

export interface BatchRateInput {
  /** Sea shipments are billed by volume, everything else by weight. */
  unit: "kg" | "cbm";
  /** The rate agreed with this customer for this shipment, if there is one. */
  customerPricePerKg?: string | number | null;
  customerPricePerCbm?: string | number | null;
  /** Whether the shipment is priced in tiers at all. */
  useTieredPricing?: boolean | null;
  /**
   * The tier rate for this customer's total, already looked up. Null when the
   * shipment has no tiers or none match.
   */
  tierRate?: number | null;
  /** The shipment's own rate. */
  batchPricePerKg?: string | number | null;
  batchPricePerCbm?: string | number | null;
}

export interface BatchRate {
  /** 0 when the shipment has not been rated at all. */
  rate: number;
  source: RateSource;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

/** Which rate applies, and where it came from. */
export function resolveBatchRate(input: BatchRateInput): BatchRate {
  const bySea = input.unit === "cbm";

  // 1. Agreed with this customer. A rate of 0 is not an agreement — it is an
  //    empty field — so it does not silence the rest.
  const agreed = num(bySea ? input.customerPricePerCbm : input.customerPricePerKg);
  if (agreed > 0) return { rate: agreed, source: "customer" };

  // 2. The tier their total falls into. Only when the shipment is actually
  //    priced in tiers: rows can outlive the setting being turned off.
  if (input.useTieredPricing) {
    const tier = num(input.tierRate);
    if (tier > 0) return { rate: tier, source: "tier" };
  }

  // 3. The shipment's own rate.
  const batch = num(bySea ? input.batchPricePerCbm : input.batchPricePerKg);
  if (batch > 0) return { rate: batch, source: "batch" };

  // Nothing has been decided yet. The caller must not invent a figure from it.
  return { rate: 0, source: "none" };
}

/** Which unit a shipment is billed in. Sea by volume, everything else by weight. */
export function billingUnit(shippingType?: string | null): "kg" | "cbm" {
  return shippingType === "sea" ? "cbm" : "kg";
}

/** How the rate is described on an invoice line, in the office's own words. */
export const RATE_SOURCE_NOTE: Record<Exclude<RateSource, "none">, { ku: string; en: string }> = {
  customer: { ku: "نرخی تایبەت بەم کڕیارە", en: "Rate agreed with this customer" },
  tier: { ku: "نرخی پلەیی", en: "Tiered rate" },
  batch: { ku: "نرخی بارەکە", en: "Shipment rate" },
};
