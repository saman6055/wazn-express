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
  /** The goods no receipt has paid for: a correction never goes below this. */
  stillOwedUsd: number;
  /**
   * What the customer is shown as owing that is not owed: the double charge,
   * but never more than the debt on the account above what is really still
   * owed — an account already put right by hand has nothing taken off it, and
   * goods on the road or in an open box stay owed.
   */
  falseDebtUsd: number;
}

export function falseDebt(twiceUsd: number, balanceUsd: number, stillOwedUsd = 0): number {
  return cents(Math.max(0, Math.min(twiceUsd, balanceUsd - Math.max(0, stillOwedUsd))));
}

/**
 * What a customer really still owes: the goods no receipt has paid for.
 *
 * Found on the nine debtors of 8 October 2026. AZ001 had $11,493 written
 * twice and a balance of $4,471: taking "the double charge, but never more
 * than the balance" would have wiped her whole account — two open boxes and
 * $1,200 of goods still on the road with it. Accounts zeroed by hand on 14
 * August and then receipted in bulk on 10 September carry more double lines
 * than debt, so the double lines alone cannot say how much to take off. This
 * can: every charge that stands, minus those a receipted box settled, minus
 * those a zeroing by hand settled before them, is what is still owed — and a
 * correction never goes below it.
 */
export interface AccountRow {
  id: number;
  transactionNumber: string;
  transactionType: string;
  amountUsd: number;
  balanceAfterUsd: number;
  description: string;
  referenceId: number | null;
}

export interface SettledFacts {
  /** Boxes with a receipt that stands. */
  receiptedBoxCodes: Set<string>;
  receiptedPackageIds: Set<number>;
  receiptedOrderIds: Set<number>;
  /** Lower case: the same tracking is typed «YT76…» on the order and «yt76…» on the parcel. */
  receiptedTrackings: Set<string>;
  orders: Array<{ id: number; chargeTransactionId: number | null; trackings: string[] }>;
  /** The rule that tells an order's charge from a parcel's by its text. */
  isOrderText: (description: string) => boolean;
}

const BOX_LINE_TEXT = /^(BOX-[\w-]+)\s+—\s+(\S+)/;
const BOX_NAMED = /(BOX-\d{8}-\d+)/;
const MANUAL = "[ڕێکخستنی دەستی]";
const MARK = /\[(?:REV|ADJ):([^\]]+)\]/;
const ORDER_TYPES = new Set(["DEBIT_COMMISSION", "DEBIT_FULL_PACKAGE", "DEBIT_PURCHASE_REQUEST"]);
export const trackingKey = (t: string | null | undefined) => String(t ?? "").trim().toLowerCase();

export function stillOwed(rows: AccountRow[], facts: SettledFacts): number {
  const byNumber = new Map(rows.map((r) => [r.transactionNumber, r]));
  // What each charge stands at, after the corrections that name it.
  const stands = new Map<number, number>();
  for (const r of rows) if (r.transactionType.startsWith("DEBIT_")) stands.set(r.id, Math.round(r.amountUsd * 100));
  let zeroedAt = 0;
  for (const r of rows) {
    if (!r.transactionType.startsWith("ADJUSTMENT_")) continue;
    const named = MARK.exec(r.description);
    const target = named ? byNumber.get(named[1]) : undefined;
    if (target && stands.has(target.id)) {
      const amount = Math.round(r.amountUsd * 100);
      stands.set(target.id, stands.get(target.id)! + (r.transactionType === "ADJUSTMENT_DEBIT" ? amount : -amount));
    } else if (r.transactionType === "ADJUSTMENT_CREDIT" && r.description.includes(MANUAL) && r.balanceAfterUsd <= 0.005) {
      // The account was put to nothing by hand: whatever stood before is settled.
      zeroedAt = Math.max(zeroedAt, r.id);
    }
  }

  const orderById = new Map(facts.orders.map((o) => [o.id, o]));
  const orderByCharge = new Map(facts.orders.filter((o) => o.chargeTransactionId).map((o) => [o.chargeTransactionId!, o]));
  const receipted = (r: AccountRow): boolean => {
    if (BOX_LINE_TEXT.test(r.description)) return true; // written by a receipt, paid by it
    const isOrder = ORDER_TYPES.has(r.transactionType) || (r.transactionType === "DEBIT_PACKAGE" && facts.isOrderText(r.description));
    if (isOrder) {
      const order = orderByCharge.get(r.id) ?? (r.referenceId == null ? undefined : orderById.get(r.referenceId));
      if (!order) return false;
      return facts.receiptedOrderIds.has(order.id) || order.trackings.some((t) => facts.receiptedTrackings.has(trackingKey(t)));
    }
    if (r.referenceId != null && facts.receiptedPackageIds.has(r.referenceId)) return true;
    // A box's own line that is not a tracking's (its delivery): settled with its box.
    const box = BOX_NAMED.exec(r.description);
    return !!box && facts.receiptedBoxCodes.has(box[1]);
  };

  let open = 0;
  let paidOnAccount = 0;
  for (const r of rows) {
    if (r.id <= zeroedAt) continue;
    if (r.transactionType === "CREDIT_PAYMENT") {
      // Money taken without a box receipt pays the oldest open goods.
      if (!/^\s*BOX-/.test(r.description)) paidOnAccount += Math.round(r.amountUsd * 100);
      continue;
    }
    const cents = stands.get(r.id) ?? 0;
    if (cents <= 0 || receipted(r)) continue;
    open += cents;
  }
  return Math.max(0, open - paidOnAccount) / 100;
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
