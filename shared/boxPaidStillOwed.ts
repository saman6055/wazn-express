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
  orders: Array<{ id: number; chargeTransactionId: number | null; trackings: string[]; status?: string | null }>;
  /** The rule that tells an order's charge from a parcel's by its text. */
  isOrderText: (description: string) => boolean;
  /** Goods sitting in a box no receipt has been written for yet. */
  openPackageIds?: Set<number>;
  openOrderIds?: Set<number>;
  openTrackings?: Set<string>;
}

const BOX_LINE_TEXT = /^(BOX-[\w-]+)\s+—\s+(\S+)/;
const BOX_NAMED = /(BOX-\d{8}-\d+)/;
const MANUAL = "[ڕێکخستنی دەستی]";
const MARK = /\[(?:REV|ADJ):([^\]]+)\]/;
const ORDER_TYPES = new Set(["DEBIT_COMMISSION", "DEBIT_FULL_PACKAGE", "DEBIT_PURCHASE_REQUEST"]);
export const trackingKey = (t: string | null | undefined) => String(t ?? "").trim().toLowerCase();

/** An order that has reached Iraq: its goods are here, whether boxed or not. */
export const ARRIVED_ORDER_STATUSES = ["arrived", "ready_for_delivery", "delivered"] as const;

/**
 * Where one charge stands, in the owner's own words:
 *   paid      — its goods are in a box that was receipted
 *   settled   — the account was put to nothing by hand after it
 *   road      — an order not yet arrived
 *   arrived   — an order that arrived and sits in no box
 *   openBox   — in a box not receipted yet
 *   parcel    — the customer's own parcel, arrived, in no box
 *   back      — taken back by a correction; nothing stands
 */
export type ChargeVerdict = "paid" | "settled" | "road" | "arrived" | "openBox" | "parcel" | "back";
export const OWED_VERDICTS: readonly ChargeVerdict[] = ["road", "arrived", "openBox", "parcel"];

export interface ExplainedCharge {
  id: number;
  standsUsd: number;
  verdict: ChargeVerdict;
  /** The order this row is a charge of, when it is one. */
  orderId: number | null;
  /** The parcel, when the row is a parcel's own. */
  packageId: number | null;
  /** The box and tracking a box line names. */
  boxCode: string | null;
  tracking: string | null;
}

export interface ExplainedDebt {
  charges: ExplainedCharge[];
  owedUsd: Record<"road" | "arrived" | "openBox" | "parcel", number>;
  /** Money taken without a box receipt since the last zeroing: it pays the open goods first. */
  paidOnAccountUsd: number;
  stillOwedUsd: number;
}

export function explainDebt(rows: AccountRow[], facts: SettledFacts): ExplainedDebt {
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
  const arrived = new Set<string>(ARRIVED_ORDER_STATUSES);

  const charges: ExplainedCharge[] = [];
  const owed = { road: 0, arrived: 0, openBox: 0, parcel: 0 };
  let paidOnAccount = 0;
  for (const r of rows) {
    if (r.transactionType === "CREDIT_PAYMENT") {
      // Money taken without a box receipt pays the oldest open goods.
      if (r.id > zeroedAt && !/^\s*BOX-/.test(r.description)) paidOnAccount += Math.round(r.amountUsd * 100);
      continue;
    }
    if (!r.transactionType.startsWith("DEBIT_")) continue;
    const cents = stands.get(r.id) ?? 0;
    const line = BOX_LINE_TEXT.exec(r.description);
    const isOrder = !line && (ORDER_TYPES.has(r.transactionType) || (r.transactionType === "DEBIT_PACKAGE" && facts.isOrderText(r.description)));
    const order = isOrder ? orderByCharge.get(r.id) ?? (r.referenceId == null ? undefined : orderById.get(r.referenceId)) : undefined;
    const named = BOX_NAMED.exec(r.description);
    const out: ExplainedCharge = {
      id: r.id,
      standsUsd: Math.max(0, cents) / 100,
      verdict: "paid",
      orderId: order?.id ?? null,
      packageId: !isOrder && r.transactionType === "DEBIT_PACKAGE" && r.referenceId ? r.referenceId : null,
      boxCode: line ? line[1] : named ? named[1] : null,
      tracking: line ? line[2] : null,
    };
    charges.push(out);

    if (cents <= 0) { out.verdict = "back"; continue; }
    if (line) continue; // written by a receipt, paid by it
    let verdict: ChargeVerdict;
    if (isOrder) {
      if (!order) verdict = "road"; // an order we cannot find is never called paid
      else if (facts.receiptedOrderIds.has(order.id) || order.trackings.some((t) => facts.receiptedTrackings.has(trackingKey(t)))) verdict = "paid";
      else if (facts.openOrderIds?.has(order.id) || order.trackings.some((t) => facts.openTrackings?.has(trackingKey(t)))) verdict = "openBox";
      else verdict = arrived.has(String(order.status ?? "")) ? "arrived" : "road";
    } else if (r.referenceId != null && facts.receiptedPackageIds.has(r.referenceId)) verdict = "paid";
    else if (named && facts.receiptedBoxCodes.has(named[1])) verdict = "paid"; // a box's own line (its delivery): settled with its box
    else if ((r.referenceId != null && facts.openPackageIds?.has(r.referenceId)) || named) verdict = "openBox";
    else verdict = "parcel";

    if (verdict !== "paid" && r.id <= zeroedAt) verdict = "settled";
    out.verdict = verdict;
    if (verdict === "road" || verdict === "arrived" || verdict === "openBox" || verdict === "parcel") owed[verdict] += cents;
  }
  const open = owed.road + owed.arrived + owed.openBox + owed.parcel;
  return {
    charges,
    owedUsd: { road: owed.road / 100, arrived: owed.arrived / 100, openBox: owed.openBox / 100, parcel: owed.parcel / 100 },
    paidOnAccountUsd: paidOnAccount / 100,
    stillOwedUsd: Math.max(0, open - paidOnAccount) / 100,
  };
}

export function stillOwed(rows: AccountRow[], facts: SettledFacts): number {
  return explainDebt(rows, facts).stillOwedUsd;
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

// ───────────────────────── every figure, peeled ─────────────────────────

/**
 * The owner, 2026-10-10, on the card that explains a debt: "whatever I press
 * here should give me the complete, exact detail - any number I want, peeled
 * for me like an onion, so I know how it came about."
 *
 * So each figure on the card is given the lines it was added up from, and
 * each of those is a row of the customer's own account - nothing is worked
 * out a second time here. A figure and the lines under it must come to the
 * same cent, or the screen says so.
 */

/** One row of the account, as a line under a figure: what it added or took off. */
export interface StoryLine {
  id: number;
  transactionNumber: string;
  /** When it was written, as the account has it. */
  at: string | null;
  /** The charge itself, something added to it afterwards, or something taken off it. */
  kind: "charge" | "raised" | "takenOff";
  description: string;
  /** Signed: what this row did to the figure. */
  usd: number;
}

const toCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);

/**
 * How one owed thing came to its amount: its charge row or rows, and every
 * correction that names one of them. Added up, the lines are what the charge
 * stands at.
 */
export function chargeStory(rows: Array<AccountRow & { createdAt?: string | null }>, chargeIds: number[]): StoryLine[] {
  const wanted = new Set(chargeIds);
  const numberOf = new Map<string, number>();
  for (const r of rows) if (wanted.has(r.id)) numberOf.set(r.transactionNumber, r.id);
  const out: StoryLine[] = [];
  for (const r of rows) {
    if (wanted.has(r.id)) {
      out.push({ id: r.id, transactionNumber: r.transactionNumber, at: r.createdAt ?? null, kind: "charge", description: r.description, usd: toCents(r.amountUsd) / 100 });
      continue;
    }
    if (!r.transactionType.startsWith("ADJUSTMENT_")) continue;
    const named = MARK.exec(r.description);
    if (!named || !numberOf.has(named[1])) continue;
    const up = r.transactionType === "ADJUSTMENT_DEBIT";
    out.push({ id: r.id, transactionNumber: r.transactionNumber, at: r.createdAt ?? null, kind: up ? "raised" : "takenOff", description: r.description, usd: (up ? 1 : -1) * toCents(r.amountUsd) / 100 });
  }
  return out;
}

/** What the lines under a figure come to. */
export function storyTotal(lines: StoryLine[]): number {
  return lines.reduce((sum, l) => sum + toCents(l.usd), 0) / 100;
}

/**
 * The whole account in five sums, which together are the balance: everything
 * charged, what was added to charges afterwards, what was taken off them,
 * what was paid, and any other credit. `differenceUsd` is what the balance on
 * the account says beyond those - nothing, on an account whose rows are whole.
 */
export interface AccountSums {
  chargedUsd: number;
  chargedCount: number;
  raisedUsd: number;
  takenOffUsd: number;
  paidUsd: number;
  paidCount: number;
  otherCreditUsd: number;
  computedUsd: number;
  differenceUsd: number;
  rows: number;
}

export function accountSums(rows: AccountRow[], balanceUsd: number): AccountSums {
  let charged = 0, raised = 0, takenOff = 0, paid = 0, other = 0, chargedCount = 0, paidCount = 0;
  for (const r of rows) {
    const c = toCents(r.amountUsd);
    if (r.transactionType.startsWith("DEBIT_")) { charged += c; chargedCount += 1; }
    else if (r.transactionType === "ADJUSTMENT_DEBIT") raised += c;
    else if (r.transactionType === "ADJUSTMENT_CREDIT") takenOff += c;
    else if (r.transactionType === "CREDIT_PAYMENT") { paid += c; paidCount += 1; }
    else if (r.transactionType.startsWith("CREDIT_")) other += c;
  }
  const computed = charged + raised - takenOff - paid - other;
  return {
    chargedUsd: charged / 100,
    chargedCount,
    raisedUsd: raised / 100,
    takenOffUsd: takenOff / 100,
    paidUsd: paid / 100,
    paidCount,
    otherCreditUsd: other / 100,
    computedUsd: computed / 100,
    differenceUsd: (toCents(balanceUsd) - computed) / 100,
    rows: rows.length,
  };
}
