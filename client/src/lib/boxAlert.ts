/**
 * Which boxes are quietly owed money — the AZ070 rule.
 *
 * A box was handed to a customer, its ten parcels and $50.71, and nothing
 * anywhere said so: the ledger charges post at batch delivery, nobody had
 * pressed پارەدان, and the finance page's headline debt was blind to it.
 * The owner asked for a red flag no forgotten box can hide from.
 *
 * Two flavours, by severity:
 *  - "handed_unpaid": the box says delivered and money is still outstanding.
 *    Goods are gone; every day of this is pure exposure. Flags at any age.
 *  - "aging_unpaid": the box is still open/ready/in transit but has been
 *    sitting longer than the whole open→handover cycle normally takes
 *    (the owner's own figure: about five days) with money outstanding.
 *
 * Discounts count as settled: forgiven money is not owed money.
 */

export const BOX_UNPAID_ALERT_DAYS = 5;

const DAY_MS = 86_400_000;

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export interface BoxAlertFacts {
  status: string;
  totalValueUsd?: string | number | null;
  deliveryChargeUsd?: string | number | null;
  settledUsd?: string | number | null;
  settledDiscountUsd?: string | number | null;
  createdAt: string | Date;
}

export interface BoxUnpaidAlert {
  kind: "handed_unpaid" | "aging_unpaid";
  /** Days since the box was opened. */
  days: number;
  outstandingUsd: number;
}

export function boxUnpaidAlert(box: BoxAlertFacts, now: Date = new Date()): BoxUnpaidAlert | null {
  if (box.status === "cancelled") return null;

  const outstanding =
    Math.round(
      (num(box.totalValueUsd) + num(box.deliveryChargeUsd) - num(box.settledUsd) - num(box.settledDiscountUsd) + Number.EPSILON) * 100,
    ) / 100;
  if (outstanding <= 0.009) return null;

  const created = box.createdAt instanceof Date ? box.createdAt : new Date(box.createdAt);
  const days = Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS));

  if (box.status === "delivered") {
    return { kind: "handed_unpaid", days, outstandingUsd: outstanding };
  }
  if (days > BOX_UNPAID_ALERT_DAYS) {
    return { kind: "aging_unpaid", days, outstandingUsd: outstanding };
  }
  return null;
}
