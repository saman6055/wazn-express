/**
 * One delivery box, itemised — the same document as a batch invoice, for the
 * other thing a customer is billed for.
 *
 * A box is what actually arrives at their door: several parcels packed
 * together, carried to a city, handed over. They are charged for the goods
 * inside and for the delivery of the box itself, and until now the portal
 * showed one figure for the whole thing.
 *
 * What is deliberately absent is `deliveryCostUsd` — what the courier charged
 * us. The customer pays `deliveryChargeUsd`; the difference is our margin, and
 * it is kept off this document the same way the purchase price is kept off a
 * batch invoice: by never being fetched. See CUSTOMER_BOX_FIELDS in
 * server/db/deliveryBoxes.db.ts.
 */

export interface BoxItem {
  id: number;
  trackingNumber?: string | null;
  packageCode?: string | null;
  description?: string | null;
  weightKg?: string | number | null;
  /** What this parcel was charged at. Not what it cost us. */
  calculatedCostUsd?: string | number | null;
}

export interface BoxLine {
  id: number;
  label: string;
  trackingNumber: string | null;
  weightKg: number;
  cost: number;
}

export interface BoxInvoice {
  lines: BoxLine[];
  totals: {
    goods: number;
    /** What the customer pays for the box to be delivered. */
    delivery: number;
    weightKg: number;
    grand: number;
  };
  /** Items in the box with no charge recorded. Counted, never invented. */
  unpriced: number;
}

const cents = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const grams = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 1000) : 0;
};

const money = (c: number): number => c / 100;
const kilos = (g: number): number => Math.round(g) / 1000;

/**
 * The box, line by line.
 *
 * `deliveryChargeUsd` is a charge for the box, not for any parcel in it, so it
 * stays a total of its own rather than being shared out. Splitting it across
 * the parcels would invent a per-parcel delivery figure the customer was never
 * quoted and could never reconcile against anything.
 */
export function buildBoxInvoice(
  items: readonly BoxItem[],
  deliveryChargeUsd: string | number | null | undefined = 0,
  fallbackLabel = "—",
): BoxInvoice {
  let goods = 0;
  let weight = 0;
  let unpriced = 0;

  const lines: BoxLine[] = items.map((item) => {
    const cost = cents(item.calculatedCostUsd);
    const w = grams(item.weightKg);

    if (cost === 0) unpriced += 1;
    goods += cost;
    weight += w;

    return {
      id: item.id,
      // The description the warehouse typed, else the code it was scanned by.
      // A blank line on an invoice is worse than a code the customer can look up.
      label: (item.description ?? "").trim() || item.packageCode || item.trackingNumber || fallbackLabel,
      trackingNumber: item.trackingNumber ?? null,
      weightKg: kilos(w),
      cost: money(cost),
    };
  });

  const delivery = cents(deliveryChargeUsd);

  return {
    lines,
    totals: {
      goods: money(goods),
      delivery: money(delivery),
      weightKg: kilos(weight),
      grand: money(goods + delivery),
    },
    unpriced,
  };
}
