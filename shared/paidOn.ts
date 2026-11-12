/**
 * «بەرواری پارەدان» - the day the customer paid, when it is entered later
 * (owner, 2026-11-12: «تاریخی پارەدان و تاریخی داخل کردنیش هەبێ»).
 *
 * The day is Erbil's (UTC+3, no daylight saving). Today is the default and
 * changes nothing. A past day is allowed up to a limit; a future day never.
 * The money is dated that day at this moment's Erbil clock time, so rows
 * entered together keep their order within the day.
 *
 * Pure: the server checks and dates by it, the form shows the same limits.
 */

export const ERBIL_OFFSET_MS = 3 * 60 * 60 * 1000;
/** How far back anyone may date a payment, in days. */
export const PAID_ON_MAX_DAYS_BACK = 30;
/** The main admin may go further back, for an old payment found later. */
export const PAID_ON_MAX_DAYS_BACK_MAIN_ADMIN = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in Erbil, YYYY-MM-DD. */
export function erbilToday(now: Date = new Date()): string {
  return new Date(now.getTime() + ERBIL_OFFSET_MS).toISOString().slice(0, 10);
}

/** The earliest day this role may date a payment, YYYY-MM-DD. */
export function earliestPaidOn(role: string | null | undefined, now: Date = new Date()): string {
  const days = role === "super_admin" ? PAID_ON_MAX_DAYS_BACK_MAIN_ADMIN : PAID_ON_MAX_DAYS_BACK;
  return erbilToday(new Date(now.getTime() - days * DAY_MS));
}

export type PaidOnCheck =
  | { ok: true; paidAt: Date | null }
  | { ok: false; why: "format" | "future" | "too_old"; earliest: string; today: string };

/**
 * Check a paid day and give the moment to date the money by. `paidAt` is null
 * for today (or nothing chosen): the money is dated now, as always.
 */
export function checkPaidOn(paidOn: string | null | undefined, role: string | null | undefined, now: Date = new Date()): PaidOnCheck {
  const today = erbilToday(now);
  const earliest = earliestPaidOn(role, now);
  if (!paidOn || paidOn === today) return { ok: true, paidAt: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(`${paidOn}T00:00:00Z`))
    || new Date(`${paidOn}T00:00:00Z`).toISOString().slice(0, 10) !== paidOn) {
    return { ok: false, why: "format", earliest, today };
  }
  if (paidOn > today) return { ok: false, why: "future", earliest, today };
  if (paidOn < earliest) return { ok: false, why: "too_old", earliest, today };
  // That day, at this moment's Erbil clock time.
  const sinceMidnight = (now.getTime() + ERBIL_OFFSET_MS) % DAY_MS;
  const paidAt = new Date(Date.parse(`${paidOn}T00:00:00Z`) - ERBIL_OFFSET_MS + sinceMidnight);
  return { ok: true, paidAt };
}

/** dd/mm, the way the office reads a short date. */
export function shortDay(d: Date | string): string {
  const day = erbilToday(d instanceof Date ? d : new Date(d));
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/**
 * Entered on a later day than it is dated: both are worth showing. The same
 * day is not - an entry a minute after its date is just the entry.
 */
export function enteredLater(createdAt: Date | string | null | undefined, enteredAt: Date | string | null | undefined): boolean {
  if (!createdAt || !enteredAt) return false;
  return erbilToday(new Date(enteredAt)) !== erbilToday(new Date(createdAt));
}

/** +1 when a ledger type raises what the customer owes, -1 when it lowers it. */
export function ledgerSign(type: string | null | undefined): 1 | -1 {
  const t = String(type ?? "").toUpperCase();
  return t.startsWith("DEBIT_") || t === "ADJUSTMENT_DEBIT" ? 1 : -1;
}

/**
 * The balance after each row, in date order, when some rows were dated
 * earlier than they were typed in. Each row's stored balance was written in
 * the order of entry, so a back-dated row would break the column read by
 * date. Worked back from the balance now: `endUsd` is the balance after the
 * last row shown, and each row before it is that less what came after.
 * Whole cents, so nothing drifts.
 */
export function balancesByDate(rows: readonly { type: string | null; amountUsd: string | number | null }[], endUsd: number): number[] {
  const out = new Array<number>(rows.length);
  let cents = Math.round(endUsd * 100);
  for (let i = rows.length - 1; i >= 0; i--) {
    out[i] = cents / 100;
    cents -= ledgerSign(rows[i].type) * Math.round((Number(rows[i].amountUsd) || 0) * 100);
  }
  return out;
}
