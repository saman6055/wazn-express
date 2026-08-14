/**
 * What a customer may be told a parcel will cost, and when.
 *
 * The portal printed a confident figure the moment a parcel was registered.
 * That figure came from the general route rule — origin country, destination
 * country, shipping type — multiplied by the chargeable weight. It is not the
 * number the customer is charged. At delivery the price comes from the batch:
 * its tiered rate if it has one, otherwise its own rate, and only as a last
 * resort that general rule.
 *
 * So a parcel could sit in a batch whose rate had not been decided yet and
 * still show a precise price to two decimal places. That is a promise nobody
 * can keep: customs, a rate that rises before loading, storage while the
 * shipment waits — none of it is known at registration, and a customer who
 * saw $1.65 will quite reasonably argue for $1.65.
 *
 * Hence three states rather than one number:
 *
 *   pending  — the batch has no rate yet, so there is nothing honest to say
 *   estimate — the batch has a rate, so a figure can be offered as an estimate
 *   final    — the charge has been made, and the amount is what it is
 *
 * Nothing here decides money. It decides what may be shown, which is a
 * different question and the one that was being answered wrongly.
 */

export type ParcelPriceKind = "pending" | "estimate" | "final";

export interface ParcelPriceInput {
  /** True once the customer has actually been charged for this parcel. */
  isCharged?: boolean | null;
  /** The figure stored at registration, from the general route rule. */
  calculatedCostUsd?: string | number | null;
  /** The batch's own rate. Absent until staff set it, which is often later. */
  batchPricePerKg?: string | number | null;
  batchPricePerCbm?: string | number | null;
  /** Sea batches are priced by volume, everything else by weight. */
  shippingType?: string | null;
  /** Null when the parcel is not in a batch at all. */
  batchId?: number | null;
}

export interface ParcelPriceDisplay {
  kind: ParcelPriceKind;
  /** Absent when nothing may be shown. */
  amount?: number;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

/** Which rate a batch is priced by. Sea goes by volume, air by weight. */
export function ratedBy(shippingType?: string | null): "cbm" | "kg" {
  return shippingType === "sea" ? "cbm" : "kg";
}

/**
 * Has the batch this parcel travels in been given a rate?
 *
 * Until it has, the registration figure rests on nothing the customer will
 * be billed by, and the honest answer is that the price is not settled.
 */
export function batchHasRate(input: ParcelPriceInput): boolean {
  if (input.batchId == null) return false;
  const rate = ratedBy(input.shippingType) === "cbm"
    ? num(input.batchPricePerCbm)
    : num(input.batchPricePerKg);
  return rate > 0;
}

/** What the portal may show for this parcel. */
export function parcelPriceDisplay(input: ParcelPriceInput): ParcelPriceDisplay {
  const amount = num(input.calculatedCostUsd);

  // Charged is charged. Whatever the estimate was, this is the real figure
  // and the customer is entitled to see it plainly.
  if (input.isCharged) return { kind: "final", amount };

  // No figure to offer at all.
  if (amount <= 0) return { kind: "pending" };

  // A rate exists, so an estimate has something behind it.
  if (batchHasRate(input)) return { kind: "estimate", amount };

  // A precise-looking number with no rate behind it is the case this exists
  // to stop.
  return { kind: "pending" };
}

/**
 * What is deliberately not in the estimate.
 *
 * Shown beside it, because the gap between an estimate and an invoice is
 * exactly where an argument starts, and naming the reasons in advance is
 * cheaper than explaining them afterwards.
 */
export const ESTIMATE_EXCLUDES: { ku: string; en: string; ar: string; zh: string } = {
  ku: "خەمڵێنراوە و دەگۆڕێت — گومرگ، گۆڕانی نرخ پێش بارکردن، کرێی ڕاگرتن و گەیاندن تێیدا نییە",
  en: "An estimate, and it can change — customs, a rate change before loading, storage and delivery are not included",
  ar: "تقدير قابل للتغيير — الجمارك وتغيّر السعر قبل الشحن والتخزين والتوصيل غير مشمولة",
  zh: "此为估价，可能变动 — 不含关税、装运前的价格变动、仓储与配送费用",
};

/** Said instead of a number, while the shipment has no rate. */
export const PRICE_NOT_SET_YET: { ku: string; en: string; ar: string; zh: string } = {
  ku: "نرخ دوای دیاریکردنی بارەکە",
  en: "Price once the shipment is rated",
  ar: "السعر بعد تحديد سعر الشحنة",
  zh: "运价确定后公布",
};
