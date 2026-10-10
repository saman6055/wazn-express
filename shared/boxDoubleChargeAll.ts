/**
 * Every false debt put right at one press.
 *
 * Owner, 2026-10-10, looking at a customer shown owing $147.37 of which
 * $60.36 was written twice: "if it is not real, why does it show a void
 * thing? Problems like this in an accounting system are a great fault -
 * chasing them wastes a great deal of time and effort." Thirty-three
 * customers carried such a line, each waiting for its own press.
 *
 * So the main admin sees the whole list once - who, how much comes off, what
 * each account stands at afterwards - and says yes once. Two things keep that
 * one yes as safe as thirty-three:
 *
 *   - it is a yes to the list he SAW. If the list has changed since - a
 *     receipt written, an account touched - nothing is done and he is asked
 *     to look again;
 *   - each customer is still put right by the one rule (correctBoxDoubleCharge),
 *     one at a time, so one failure stops nobody else and is reported by name.
 */

export interface SeenList {
  customers: number;
  totalUsd: number;
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);

/** The list as the screen shows it: only those with something to take off. */
export function seenList(rows: ReadonlyArray<{ falseDebtUsd: number }>): SeenList {
  const owing = rows.filter((r) => r.falseDebtUsd > 0.005);
  return { customers: owing.length, totalUsd: owing.reduce((s, r) => s + cents(r.falseDebtUsd), 0) / 100 };
}

/** Is what is about to be corrected exactly what was agreed to? To the cent. */
export function sameList(seen: SeenList, now: SeenList): boolean {
  return seen.customers === now.customers && cents(seen.totalUsd) === cents(now.totalUsd);
}

export interface CorrectAllResult {
  corrected: number;
  removedUsd: number;
  failed: Array<{ customerId: number; customerCode: string | null; message: string }>;
}
