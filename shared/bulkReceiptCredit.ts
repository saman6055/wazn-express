/**
 * The credit that one day of box receipts created — 2026-09-10.
 *
 * Read from the real ledger on 2026-10-02 (6,902 rows, 177 accounts): before
 * 10 September not one customer was in credit. That day 445 receipts were
 * written, $60,219.61, for boxes dated April to September — old boxes closed
 * in bulk, whose money had been taken in cash long before (owner, 2026-10-02:
 * "yes, all of it had been received in cash"). Much of that debt was no
 * longer on the accounts: 121 of them had been zeroed by hand on 14 August to
 * record the same cash, and some boxes held goods that were never charged at
 * all. So the receipts took accounts below zero: $13,039.86 of credit in 76
 * accounts, for money nobody had handed over twice.
 *
 * What one account was given that day is how far below zero it stood at the
 * end of the day, less how far it already was the day before. That is
 * independent of the order the rows were written in, and it is what this
 * file computes. The correction is one debit of exactly that amount — a new
 * row with its reason; nothing already in the ledger is edited or removed.
 */

/** The day, as the ledger's own timestamps say it (UTC). */
export const BULK_RECEIPT_DAY = "2026-09-10";

/** Written into the correction's reason; an account carrying it is done. */
export const BULK_RECEIPT_FIX_MARK = "[FIX:BOX-RECEIPTS-2026-09-10]";

export const BULK_RECEIPT_FIX_REASON =
  `وەسڵی بۆکسە کۆنەکان لە 10/09 کە پارەکەیان پێشتر بە کاش وەرگیرابوو — کریدیتی وەهمی لادەبرێت ${BULK_RECEIPT_FIX_MARK}`;

export interface LedgerRowForCredit {
  transactionType: string | null;
  amountUsd: string | number | null;
  createdAt: Date | string;
  description?: string | null;
}

const cents = (v: string | number | null): number => Math.round((Number(v) || 0) * 100);

/** +1 raises what the customer owes, −1 lowers it. The ledger's own sign rule. */
export function balanceSign(transactionType: string | null): 1 | -1 {
  const type = String(transactionType ?? "");
  return type.startsWith("DEBIT_") || type === "ADJUSTMENT_DEBIT" ? 1 : -1;
}

const dayOf = (createdAt: Date | string): string =>
  (createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString()).slice(0, 10);

export interface BulkReceiptCredit {
  /** The account now. Positive is debt. */
  balanceUsd: number;
  /** Credit created on the day — the correction to post. 0 when none. */
  phantomUsd: number;
  /** The account once the correction is posted. */
  correctedUsd: number;
  /** A correction carrying the mark is already on the account. */
  alreadyFixed: boolean;
}

export function bulkReceiptCredit(rows: readonly LedgerRowForCredit[], day = BULK_RECEIPT_DAY): BulkReceiptCredit {
  let before = 0;
  let through = 0;
  let now = 0;
  let alreadyFixed = false;
  for (const row of rows) {
    const signed = balanceSign(row.transactionType) * cents(row.amountUsd);
    const rowDay = dayOf(row.createdAt);
    if (rowDay < day) before += signed;
    if (rowDay <= day) through += signed;
    now += signed;
    if (String(row.description ?? "").includes(BULK_RECEIPT_FIX_MARK)) alreadyFixed = true;
  }
  const phantom = Math.max(0, Math.max(0, -through) - Math.max(0, -before));
  return {
    balanceUsd: now / 100,
    phantomUsd: alreadyFixed ? 0 : phantom / 100,
    correctedUsd: (now + (alreadyFixed ? 0 : phantom)) / 100,
    alreadyFixed,
  };
}
