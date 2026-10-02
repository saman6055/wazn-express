/**
 * Every movement of money, as the main admin reads it.
 *
 * Owner, 2026-10-02: "every financial movement must have a notification,
 * with a link to where it happened, so one click takes me to it — when
 * another admin receipts a box, at once. One cent more or less and the main
 * admin knows." And: the system must never leave a customer in credit
 * without anybody being told.
 *
 * The feed is not a second record kept beside the books; it IS the books.
 * Every balance change writes a ledger row — who, when, how much, the
 * balance before and after — so the feed reads those rows and cannot miss a
 * movement that some screen forgot to announce. A door added next year is
 * in the feed the day it ships.
 *
 * Two things are done to the raw rows:
 *  - rows written together are shown together. Pricing a batch charges a
 *    hundred parcels in a second; a hundred lines would bury the one that
 *    matters. Same account, same person, same kind, within two minutes, is
 *    one line with its count and its sum.
 *  - a movement that leaves the account further below zero than it found it
 *    says so, in red, with the amount: that is a credit being made.
 */

export type MoneyKind =
  | "payment"
  | "charge"
  | "discount"
  | "correction_down"
  | "correction_up"
  | "hand_down"
  | "hand_up"
  | "refund";

export interface LedgerRowForFeed {
  id: number;
  accountId: number;
  transactionType: string | null;
  referenceType: string | null;
  amountUsd: string | number | null;
  balanceBeforeUsd: string | number | null;
  balanceAfterUsd: string | number | null;
  description: string | null;
  createdById: number | null;
  createdAt: Date | string;
}

export interface MoneyMovement {
  /** The newest ledger row in the group — also the "seen up to" marker. */
  id: number;
  accountId: number;
  kind: MoneyKind;
  /** Raises what the customer owes (+1) or lowers it (−1). */
  direction: 1 | -1;
  amountUsd: number;
  /** Ledger rows folded into this line. */
  count: number;
  balanceAfterUsd: number;
  /** How much further below zero this left the account. 0 when none. */
  creditCreatedUsd: number;
  createdById: number | null;
  at: string;
  /** The row's own words when it stands alone. */
  note: string | null;
  /** The box it names, when it names exactly one. */
  boxCode: string | null;
}

const cents = (v: string | number | null): number => Math.round((Number(v) || 0) * 100);
const iso = (d: Date | string): string => (d instanceof Date ? d : new Date(d)).toISOString();

export function moneyKind(row: Pick<LedgerRowForFeed, "transactionType" | "referenceType">): MoneyKind {
  const type = String(row.transactionType ?? "");
  const byHand = !row.referenceType || row.referenceType === "adjustment" || row.referenceType === "manual";
  if (type === "CREDIT_PAYMENT" || type === "CREDIT_DEPOSIT") return "payment";
  if (type === "CREDIT_DISCOUNT") return "discount";
  if (type === "CREDIT_REFUND" || type === "CREDIT_OTHER") return "refund";
  if (type === "ADJUSTMENT_CREDIT") return byHand ? "hand_down" : "correction_down";
  if (type === "ADJUSTMENT_DEBIT") return byHand ? "hand_up" : "correction_up";
  return "charge";
}

export const MONEY_KIND_LABEL: Record<MoneyKind, { ku: string; en: string; ar: string; zh: string }> = {
  payment: { ku: "پارە وەرگیرا", en: "Payment received", ar: "استُلمت دفعة", zh: "收到付款" },
  charge: { ku: "قەرز نووسرا", en: "Charged", ar: "قُيِّد دين", zh: "已计费" },
  discount: { ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" },
  correction_down: { ku: "نرخ کەم کرایەوە / هەڵوەشایەوە", en: "Price lowered / cancelled", ar: "خُفِّض السعر / أُلغي", zh: "降价 / 取消" },
  correction_up: { ku: "نرخ زیاد کرا", en: "Price raised", ar: "رُفع السعر", zh: "加价" },
  hand_down: { ku: "بە دەست کەم کرایەوە", en: "Lowered by hand", ar: "خُفِّض يدوياً", zh: "手工冲减" },
  hand_up: { ku: "بە دەست زیاد کرا", en: "Raised by hand", ar: "رُفع يدوياً", zh: "手工增加" },
  refund: { ku: "پارە گەڕێنرایەوە", en: "Refund", ar: "استرداد", zh: "退款" },
};

/** Rows written within this long of each other can be one line. */
export const GROUP_WINDOW_MS = 2 * 60 * 1000;

const BOX = /BOX-\d{8}-\d+/;

const creditMade = (beforeCents: number, afterCents: number): number =>
  Math.max(0, Math.max(0, -afterCents) - Math.max(0, -beforeCents)) / 100;

/**
 * Fold ledger rows into movements, newest first.
 *
 * `rows` may arrive in any order. Money received and anything done by hand
 * is never folded: each of those is one person's one decision.
 */
export function groupMovements(rows: readonly LedgerRowForFeed[]): MoneyMovement[] {
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  const out: MoneyMovement[] = [];
  let open: { movement: MoneyMovement; amountCents: number; beforeCents: number; lastAt: number; foldable: boolean } | null = null;

  for (const row of sorted) {
    const kind = moneyKind(row);
    const type = String(row.transactionType ?? "");
    const direction: 1 | -1 = type.startsWith("DEBIT_") || type === "ADJUSTMENT_DEBIT" ? 1 : -1;
    const at = new Date(row.createdAt).getTime();
    const foldable = kind === "charge" || kind === "correction_down" || kind === "correction_up" || kind === "discount";
    const box = (row.description ?? "").match(BOX)?.[0] ?? null;
    const afterCents = cents(row.balanceAfterUsd);

    if (
      open !== null &&
      open.foldable &&
      foldable &&
      open.movement.accountId === row.accountId &&
      open.movement.kind === kind &&
      open.movement.createdById === (row.createdById ?? null) &&
      at - open.lastAt <= GROUP_WINDOW_MS
    ) {
      open.amountCents += cents(row.amountUsd);
      open.lastAt = at;
      const m = open.movement;
      m.id = row.id;
      m.count += 1;
      m.amountUsd = open.amountCents / 100;
      m.balanceAfterUsd = afterCents / 100;
      m.creditCreatedUsd = creditMade(open.beforeCents, afterCents);
      m.at = iso(row.createdAt);
      m.note = null;
      if (m.boxCode !== box) m.boxCode = null;
      continue;
    }

    const beforeCents = cents(row.balanceBeforeUsd);
    const movement: MoneyMovement = {
      id: row.id,
      accountId: row.accountId,
      kind,
      direction,
      amountUsd: cents(row.amountUsd) / 100,
      count: 1,
      balanceAfterUsd: afterCents / 100,
      creditCreatedUsd: creditMade(beforeCents, afterCents),
      createdById: row.createdById ?? null,
      at: iso(row.createdAt),
      note: row.description,
      boxCode: box,
    };
    out.push(movement);
    open = { movement, amountCents: cents(row.amountUsd), beforeCents, lastAt: at, foldable };
  }
  return out.reverse();
}

/** How many movements are newer than the last one the reader looked at. */
export function unseenMovements(movements: readonly MoneyMovement[], seenId: number): number {
  return movements.filter((m) => m.id > seenId).length;
}

/** Any unseen movement that made a credit — the bell turns red for these. */
export function unseenCredit(movements: readonly MoneyMovement[], seenId: number): boolean {
  return movements.some((m) => m.id > seenId && m.creditCreatedUsd > 0.005);
}

/**
 * Where a click on a line goes — to the thing itself (owner's standing
 * rule: an alert opens the record, not a list). A box receipt opens its
 * box; everything else opens the customer's own money page, where the row
 * is on the statement.
 */
export function moneyLineHref(line: { kind: MoneyKind; boxId?: number | null; customerId: number | null }): string {
  if (line.kind === "payment" && line.boxId) return `/customer-delivery-scanner?box=${line.boxId}`;
  if (line.customerId) return `/finance/customer/${line.customerId}`;
  return "/finance";
}
