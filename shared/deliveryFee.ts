/**
 * Whether the local delivery fee is our money.
 *
 * Owner, 2026-09-10: it is not — the courier takes it — so for now it stays
 * out of our accounts entirely. It is not charged to the customer's account,
 * not counted as owed on a box, not in the delivery page's money total, not on
 * the box invoice, and not in the company's revenue or profit.
 *
 * The fee itself is still recorded on the box, still shown in the box table,
 * and still printed on the receipt, because the courier collects it and needs
 * to know how much.
 *
 * One switch on purpose. When the owner decides it is ours again, this is the
 * only line to change: every place that reads the fee as money reads it
 * through here.
 */
export const DELIVERY_FEE_IN_OUR_ACCOUNTS = false as boolean;

/** The box's delivery fee as our books see it: zero while it is the courier's. */
export function ourDeliveryFee(fee: string | number | null | undefined): number {
  if (!DELIVERY_FEE_IN_OUR_ACCOUNTS) return 0;
  const n = typeof fee === "number" ? fee : parseFloat(String(fee ?? "0"));
  return Number.isFinite(n) ? n : 0;
}
