/**
 * How old a customer's debt is.
 *
 * It was measured from the account's LAST movement. Any movement reset it: on
 * 2026-10-03, after the credit clean-up had touched every account, all 75
 * debtors read "0–30 days" — debts from May among them.
 *
 * Now it is the date of the oldest charge still unpaid. Payments, discounts
 * and corrections pay the oldest charges first (first in, first out), so the
 * charge where the money ran out is the one the customer has owed longest.
 */

export interface LedgerMove {
  /** Positive raises the debt (a charge), negative lowers it (a payment, a credit). */
  signedUsd: number;
  at: Date | string;
}

/** The date of the oldest charge not yet covered, or null when nothing is owed. */
export function oldestUnpaidSince(moves: readonly LedgerMove[]): Date | null {
  const ordered = [...moves].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  let paid = ordered.filter((m) => m.signedUsd < 0).reduce((s, m) => s - m.signedUsd, 0);
  for (const m of ordered) {
    if (m.signedUsd <= 0) continue;
    if (paid >= m.signedUsd - 0.005) {
      paid -= m.signedUsd;
      continue;
    }
    return new Date(m.at);
  }
  return null;
}

/** Whole days from a date to now. */
export function daysSince(date: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
