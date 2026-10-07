/**
 * A charge that was taken back, and the row that took it back, folded away.
 *
 * Owner, 2026-10-07, looking at a corrected account: "a thing that was void
 * from the start — why is it good to keep it as a record?" It is kept
 * because a ledger whose rows can vanish proves nothing, and because every
 * balance printed since was built on it. But it need not be looked at every
 * day: a charge that no longer stands at all, together with the corrections
 * that cancelled it, adds up to nothing — so hiding the whole set changes no
 * balance on any row that stays in view.
 *
 * Only a COMPLETE set is folded. A charge that still stands in part stays,
 * with its correction, because there the correction explains a figure that
 * is still owed. A correction whose charge is not in the list stays too:
 * alone it is a real movement of the balance.
 */

export interface FoldableRow {
  id: number;
  transactionNumber: string;
  transactionType: string;
  amountUsd: string | number | null;
  description?: string | null;
}

const MARK = /\[(?:REV|ADJ):([^\]]+)\]/;

/** The ids that fold away: each cancelled charge and every correction that names it. */
export function foldedCorrectionIds(rows: readonly FoldableRow[]): Set<number> {
  const byNumber = new Map(rows.map((r) => [r.transactionNumber, r]));
  const sets = new Map<number, { cents: number; ids: number[] }>();
  for (const r of rows) {
    if (!r.transactionType.startsWith("ADJUSTMENT_")) continue;
    const named = MARK.exec(String(r.description ?? ""));
    const target = named ? byNumber.get(named[1]) : undefined;
    if (!target || !target.transactionType.startsWith("DEBIT_")) continue;
    const set = sets.get(target.id) ?? { cents: Math.round(Number(target.amountUsd ?? 0) * 100), ids: [target.id] };
    const amount = Math.round(Number(r.amountUsd ?? 0) * 100);
    set.cents += r.transactionType === "ADJUSTMENT_DEBIT" ? amount : -amount;
    set.ids.push(r.id);
    sets.set(target.id, set);
  }
  const out = new Set<number>();
  for (const set of Array.from(sets.values())) if (set.cents === 0) for (const id of set.ids) out.add(id);
  return out;
}
