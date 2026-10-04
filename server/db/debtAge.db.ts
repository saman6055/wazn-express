import { and, gt, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import { customerAccounts, ledgerTransactions } from "../../drizzle/schema";
import { oldestUnpaidSince } from "@shared/debtAge";

/**
 * For every account that owes, the date of its oldest charge still unpaid
 * (shared/debtAge). Read only.
 */
export async function getDebtAges(): Promise<Array<{ accountId: number; oldestUnpaidAt: Date | null }>> {
  const db = await getDb();
  if (!db) return [];
  const owing = await db
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(gt(customerAccounts.currentBalanceUsd, "0"));
  const ids = owing.map((a) => a.id);
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      accountId: ledgerTransactions.accountId,
      type: ledgerTransactions.transactionType,
      amountUsd: ledgerTransactions.amountUsd,
      at: ledgerTransactions.createdAt,
    })
    .from(ledgerTransactions)
    .where(and(inArray(ledgerTransactions.accountId, ids)));
  const byAccount = new Map<number, Array<{ signedUsd: number; at: Date }>>();
  for (const r of rows) {
    const up = String(r.type).startsWith("DEBIT_") || r.type === "ADJUSTMENT_DEBIT";
    const list = byAccount.get(r.accountId) ?? [];
    list.push({ signedUsd: (up ? 1 : -1) * Number(r.amountUsd ?? 0), at: r.at as Date });
    byAccount.set(r.accountId, list);
  }
  return ids.map((accountId) => ({ accountId, oldestUnpaidAt: oldestUnpaidSince(byAccount.get(accountId) ?? []) }));
}
