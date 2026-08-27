/**
 * Whether a batch can be charged for yet.
 *
 * A parcel put into a batch with no selling price is a parcel that will be
 * invoiced at nothing when the batch is delivered. Nobody notices at the
 * counter — the receipt simply comes out short, the customer pays what it
 * says, and the difference is gone. It is the one omission on the whole
 * shipping side that costs money silently.
 *
 * Which price depends on how the batch travels: air is sold by the kilo, sea
 * by the cubic metre. A tiered price counts as a price — that is what tiers
 * are — and so does a per-customer price, but neither can be judged from the
 * batch row alone, so the caller says whether any exist.
 *
 * Shared so the warning on the scanner and any check on the server are the
 * same rule rather than two opinions that drift.
 */

export interface BatchPricingFacts {
  shippingType?: string | null;
  pricePerKg?: string | number | null;
  pricePerCbm?: string | number | null;
}

const positive = (value: string | number | null | undefined): boolean => {
  if (value === null || value === undefined || value === "") return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0;
};

/** Sea is sold by volume; everything else by weight. */
export function batchSellsBy(shippingType?: string | null): "cbm" | "kg" {
  return shippingType === "sea" ? "cbm" : "kg";
}

/**
 * True when nothing on this batch says what to charge.
 *
 * `hasTiers` and `hasCustomerPricing` let the caller answer for the two
 * sources that do not live on the batch row. Passing neither is the
 * pessimistic reading, which is the right default for a warning.
 */
export function batchMissingSellingPrice(
  batch: BatchPricingFacts,
  options: { hasTiers?: boolean; hasCustomerPricing?: boolean } = {},
): boolean {
  if (options.hasTiers || options.hasCustomerPricing) return false;
  return !positive(batchSellsBy(batch.shippingType) === "cbm" ? batch.pricePerCbm : batch.pricePerKg);
}
