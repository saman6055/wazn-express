/**
 * A receipted box is settled — the owner's rule, said many times and again on
 * 2026-10-08 after AZ088: "the box is the touchstone; it is the only place
 * money comes back. Whoever had a box and that box was receipted must not, in
 * any way, owe for that box and the trackings in it. The goods reached them
 * and they paid, exactly. A mistake like this is not acceptable."
 *
 * What went wrong before the till was fixed: an order's goods were put on the
 * customer's account as an ORDER (goods + commission, then its freight), and
 * when the carton was paid at the box the till wrote the same goods on the
 * account a second time as a PARCEL and receipted that. The receipt cancelled
 * its own second charge; the first stayed as a debt for goods already paid
 * for. On 10 September 2026 this happened to 1,484 lines across 120 accounts
 * in one day.
 *
 * The till no longer does it. This file is the rule that keeps it so, and
 * finds what is left: a tracking that stands on an account twice — once
 * through its order, once through its box — is a double charge, and the
 * smaller of the two is what was written once too often.
 */

export interface DoubleChargeLine {
  trackingNumber: string;
  boxCode: string | null;
  /** The box's own charge for this tracking: its ledger row and what it stands at. */
  boxChargeId: number;
  boxChargeUsd: number;
  boxChargedAt: Date | string;
  /** The order-side rows for the same goods, each with what it stands at. */
  orderCharges: Array<{ id: number; usd: number; description: string; orderCode: string | null }>;
  orderChargedUsd: number;
  /** Written once too often: the smaller side. */
  twiceUsd: number;
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** How much of one tracking was written twice: never more than either side. */
export function twiceCharged(boxChargeUsd: number, orderChargedUsd: number): number {
  return cents(Math.max(0, Math.min(boxChargeUsd, orderChargedUsd)));
}

export interface DoubleChargeCustomer {
  customerId: number;
  customerCode: string | null;
  customerName: string | null;
  balanceUsd: number;
  lines: DoubleChargeLine[];
  twiceUsd: number;
  /**
   * What the customer is shown as owing that is not owed: the double charge,
   * but never more than the debt that is actually on the account — an account
   * already put right by hand owes nothing, and nothing is to be taken off it.
   */
  falseDebtUsd: number;
}

export function falseDebt(twiceUsd: number, balanceUsd: number): number {
  return cents(Math.max(0, Math.min(twiceUsd, balanceUsd)));
}

/**
 * The plan for putting one customer right: which order-side rows to take off,
 * whole or in part, so that exactly the false debt leaves the account and no
 * credit is made. The rows written first go first.
 */
export function planCorrection(customer: Pick<DoubleChargeCustomer, "lines" | "falseDebtUsd">): Array<{ chargeId: number; removeUsd: number; whole: boolean; trackingNumber: string; boxCode: string | null }> {
  let left = Math.round(customer.falseDebtUsd * 100);
  const plan: Array<{ chargeId: number; removeUsd: number; whole: boolean; trackingNumber: string; boxCode: string | null }> = [];
  const seen = new Set<number>();
  for (const line of customer.lines) {
    // No more than this line was written twice, whatever its rows add up to.
    let lineLeft = Math.round(line.twiceUsd * 100);
    for (const charge of line.orderCharges) {
      if (left <= 0 || lineLeft <= 0) break;
      if (seen.has(charge.id)) continue;
      seen.add(charge.id);
      const stands = Math.round(charge.usd * 100);
      if (stands <= 0) continue;
      const take = Math.min(stands, left, lineLeft);
      plan.push({ chargeId: charge.id, removeUsd: take / 100, whole: take === stands, trackingNumber: line.trackingNumber, boxCode: line.boxCode });
      left -= take;
      lineLeft -= take;
    }
  }
  return plan;
}

export function doubleChargeReason(trackingNumber: string, boxCode: string | null): string {
  return `ڕاستکردنەوەی دووجار نووسین — ئەم کاڵایە لە بۆکسی ${boxCode ?? "?"} واسڵ کراوە و پارەکەی دراوە (${trackingNumber})`;
}
