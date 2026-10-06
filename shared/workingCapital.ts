/**
 * Working capital — where the company's money is, with nothing typed.
 *
 * Owner, 2026-10-05: money never rests with him. What a box receipt brings in
 * goes the same day to the carrier, to goods bought for a customer, or to an
 * expense — and each of those is already written where it belongs (the batch's
 * cost, the order, the expense, a partner's withdrawal). "I cannot type the
 * cash; make it automatic." A cash figure typed today is wrong tomorrow, and
 * so is "what I owe the carrier".
 *
 * So cash is never an input here. It is what is left once everything the
 * records do know has been taken from what the company should hold:
 *
 *   should hold = capital brought in + work profit − expenses − withdrawals
 *   net cash    = should hold − customers' debt − goods on the road
 *                 + what customers have left with us
 *
 * "Net" because it is cash less what is owed to carriers: a batch's cost
 * leaves profit the day it is written, paid or not, so an unpaid carrier
 * shows as a lower (or negative) figure and paying him changes nothing.
 *
 * Counting the money is a test, not a line in the sum: `cashCheck` compares a
 * count with the figure and says how much went out unwritten. The count is
 * kept as "last check" and never added to anything.
 */

export interface WorkingCapitalFacts {
  /** Capital the partners brought in (opening capital + contributions). */
  capitalUsd: number;
  /** Work profit by the one rule (reports.db getProfitForPeriod), all time. */
  profitUsd: number;
  expensesUsd: number;
  /** What each partner has taken out. */
  withdrawals: { name: string; usd: number }[];
  /** Customers who owe us. */
  debtUsd: number;
  debtors: number;
  /** Customers we owe (their money is in our hands). */
  creditUsd: number;
  /**
   * Orders bought and not yet on the customer's account, at what the customer
   * will owe — profit already counts them from the day they were entered, so
   * the two sides only agree at that value.
   */
  goodsOnRoadUsd: number;
  goodsOnRoadCostUsd: number;
  goodsOnRoadCount: number;
  /**
   * Refused goods still on our hands, at what they cost (shared/refusedGoods).
   * Shown, never summed: the owner counts them as a loss from the day they are
   * refused, so their cost has already left the profit above. A sale brings
   * its price back as profit, and as cash.
   */
  stockUsd: number;
  stockCount: number;
}

export interface WorkingCapital {
  withdrawalsUsd: number;
  /** What the company should hold in every form. */
  shouldHoldUsd: number;
  /** Cash less what is owed to carriers; negative means the company owes. */
  netCashUsd: number;
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function workingCapital(f: WorkingCapitalFacts): WorkingCapital {
  const withdrawalsUsd = cents(f.withdrawals.reduce((sum, w) => sum + (Number(w.usd) || 0), 0));
  const shouldHoldUsd = cents(f.capitalUsd + f.profitUsd - f.expensesUsd - withdrawalsUsd);
  const netCashUsd = cents(shouldHoldUsd - f.debtUsd - f.goodsOnRoadUsd + f.creditUsd);
  return { withdrawalsUsd, shouldHoldUsd, netCashUsd };
}

export interface CashCheck {
  /** What was counted, less what is owed right now. */
  countedNetUsd: number;
  /** Positive: money went out and was not written. Negative: more than the books say. */
  unwrittenUsd: number;
}

/** A count against the books, at one moment. */
export function cashCheck(netCashUsd: number, haveUsd: number, oweUsd: number): CashCheck {
  const countedNetUsd = cents((Number(haveUsd) || 0) - (Number(oweUsd) || 0));
  return { countedNetUsd, unwrittenUsd: cents(netCashUsd - countedNetUsd) };
}

/** A difference this large is worth the main admin's attention. */
export const WORKING_CAPITAL_ALERT_USD = 500;

export const WORKING_CAPITAL_CHECK_KEY = "workingCapital.lastCheck";

export interface StoredCashCheck {
  haveUsd: number;
  oweUsd: number;
  /** The books' figure at the moment of the count. */
  netCashUsd: number;
  unwrittenUsd: number;
  at: string;
}

export function parseStoredCashCheck(raw: string | null | undefined): StoredCashCheck | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredCashCheck>;
    if (typeof v?.at !== "string" || !Number.isFinite(Number(v.haveUsd))) return null;
    return {
      haveUsd: Number(v.haveUsd) || 0,
      oweUsd: Number(v.oweUsd) || 0,
      netCashUsd: Number(v.netCashUsd) || 0,
      unwrittenUsd: Number(v.unwrittenUsd) || 0,
      at: v.at,
    };
  } catch {
    return null;
  }
}

/**
 * "Today", "this week" and "this month" as the office reads them: Baghdad's
 * clock (UTC+3, no daylight saving) and a week that begins on Saturday. Money
 * received at 01:00 in Erbil belongs to that day, not to the one before.
 */
const BAGHDAD_OFFSET_MS = 3 * 3_600_000;

export interface ReceivedWindows {
  today: Date;
  week: Date;
  month: Date;
}

export function receivedWindows(now: Date = new Date()): ReceivedWindows {
  const local = new Date(now.getTime() + BAGHDAD_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startOf = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) - BAGHDAD_OFFSET_MS);
  // getUTCDay: Sunday 0 … Saturday 6. Days since the last Saturday:
  const sinceSaturday = (local.getUTCDay() + 1) % 7;
  return { today: startOf(y, m, d), week: startOf(y, m, d - sinceSaturday), month: startOf(y, m, 1) };
}

export interface MoneyReceived {
  count: number;
  usd: number;
}
