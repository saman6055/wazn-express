/**
 * What a full-package customer may know about their parcel's size and
 * carriage: nothing.
 *
 * The owner's rule: on a resale order the customer agreed to one figure —
 * "this thing costs you $52" — and that figure is the whole story they are
 * told. Weight, volume, dimensions, a per-kg rate, a freight cost: each of
 * those is half of a subtraction whose other half the customer already holds,
 * and the difference is our margin. So none of them appear anywhere a
 * full-package customer can see — not on a card, not on an invoice, not on a
 * printed receipt, not in the JSON behind the screen.
 *
 * Commission is the opposite case and is deliberately untouched: that
 * customer chose the item, knows its price, and pays carriage by weight —
 * hiding the weight there would make their own bill unverifiable.
 *
 * The split is the same one the invoices already run on (`goodsBasis` in
 * batchInvoice.ts): "agreed_price" conceals, "item_plus_commission" shows.
 * Stated here once so a screen cannot decide it differently.
 *
 * Staff see everything, always. This rule is only ever applied on the portal
 * side of the fence — the staff routers never call it.
 */

import { goodsBasis } from "./batchInvoice";

/**
 * Does this order type hide size and carriage from its customer?
 * full_package and purchase_request (both sold at an agreed price) do;
 * commission does not.
 */
export function concealsSizeAndCarriage(orderType: string | null | undefined): boolean {
  if (!orderType) return false;
  return goodsBasis(orderType) === "agreed_price";
}

/**
 * A parcel row with its size and carriage figures removed, and a flag the
 * screens read so they render nothing at all rather than "0 kg".
 *
 * Null rather than zero: zero is a measurement ("weightless"), null is a
 * refusal, and the difference is visible in the network tab — which is where
 * this rule actually has to hold, since anything sent is readable whether or
 * not it is rendered.
 */
export function concealParcelSize<T extends Record<string, unknown>>(row: T): T & { sizeConcealed: true } {
  return {
    ...row,
    weightKg: null,
    volumeCbm: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    calculatedCostUsd: null,
    sizeConcealed: true,
  };
}

/**
 * The same refusal for an order row (the fields carry different names there).
 * `shippingChargedUsd` survives on purpose: it is a charge the customer pays
 * and can be asked about; `shippingCostUsd` is what the freight cost us.
 */
export function concealOrderSize<T extends Record<string, unknown>>(order: T): T & { sizeConcealed: true } {
  return {
    ...order,
    weightKg: null,
    volumeCbm: null,
    dimensionLength: null,
    dimensionWidth: null,
    dimensionHeight: null,
    shippingCostUsd: null,
    sizeConcealed: true,
  };
}
