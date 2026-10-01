import { eq } from "drizzle-orm";
import { getDb } from "./connection";
import { customerAccounts, customers, ledgerTransactions } from "../../drizzle/schema";
import { adjustCustomerBalance } from "./finance.db";
import { bulkReceiptCredit, BULK_RECEIPT_FIX_REASON } from "@shared/bulkReceiptCredit";

/**
 * The accounts that 10 September 2026 left in credit, and putting them right.
 *
 * The rule and its story are in shared/bulkReceiptCredit. Here: read every
 * account's rows, ask the rule, and — only for the accounts an admin names —
 * post the correction as one ADJUSTMENT_DEBIT through the same function a
 * hand adjustment uses, so the balance, the ledger row and the statement all
 * move together.
 *
 * The finder never writes. The apply recomputes each amount on the server at
 * the moment of posting — it never takes an amount from the screen — and an
 * account that already carries the correction's mark is skipped, so pressing
 * twice, or two admins pressing at once, cannot correct an account twice.
 */

export interface BulkReceiptCreditRow {
  customerId: number;
  customerCode: string;
  customerName: string;
  /** The account now. Positive is debt, negative is credit. */
  balanceUsd: number;
  /** The correction: credit created on 2026-09-10. */
  phantomUsd: number;
  /** The account after the correction. */
  correctedUsd: number;
}

export interface BulkReceiptCreditReport {
  rows: BulkReceiptCreditRow[];
  totalUsd: number;
  /** Accounts already corrected by an earlier run. */
  alreadyFixed: number;
}

async function compute(): Promise<{ report: BulkReceiptCreditReport; byCustomer: Map<number, BulkReceiptCreditRow> }> {
  const db = await getDb();
  if (!db) return { report: { rows: [], totalUsd: 0, alreadyFixed: 0 }, byCustomer: new Map() };

  const accounts = await db
    .select({
      accountId: customerAccounts.id,
      customerId: customerAccounts.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(customerAccounts)
    .innerJoin(customers, eq(customers.id, customerAccounts.customerId));

  const ledger = await db
    .select({
      accountId: ledgerTransactions.accountId,
      transactionType: ledgerTransactions.transactionType,
      amountUsd: ledgerTransactions.amountUsd,
      createdAt: ledgerTransactions.createdAt,
      description: ledgerTransactions.description,
    })
    .from(ledgerTransactions);

  const rowsOf = new Map<number, typeof ledger>();
  for (const row of ledger) {
    const list = rowsOf.get(row.accountId);
    if (list) list.push(row);
    else rowsOf.set(row.accountId, [row]);
  }

  const rows: BulkReceiptCreditRow[] = [];
  let alreadyFixed = 0;
  let totalCents = 0;
  for (const account of accounts) {
    const result = bulkReceiptCredit(rowsOf.get(account.accountId) ?? []);
    if (result.alreadyFixed) { alreadyFixed += 1; continue; }
    if (!(result.phantomUsd > 0.005)) continue;
    totalCents += Math.round(result.phantomUsd * 100);
    rows.push({
      customerId: account.customerId,
      customerCode: String(account.customerCode ?? ""),
      customerName: String(account.customerName ?? ""),
      balanceUsd: result.balanceUsd,
      phantomUsd: result.phantomUsd,
      correctedUsd: result.correctedUsd,
    });
  }
  rows.sort((a, b) => b.phantomUsd - a.phantomUsd);
  return {
    report: { rows, totalUsd: totalCents / 100, alreadyFixed },
    byCustomer: new Map(rows.map((r) => [r.customerId, r])),
  };
}

/** Read only: who, how much, and what each account becomes. */
export async function findBulkReceiptCredits(): Promise<BulkReceiptCreditReport> {
  return (await compute()).report;
}

export interface BulkReceiptCorrectionResult {
  corrected: number;
  amountUsd: number;
  skipped: Array<{ customerId: number; reason: string }>;
}

/** Post the correction for the customers named — one at a time, each recomputed. */
export async function correctBulkReceiptCredits(
  customerIds: number[],
  userId: number,
): Promise<BulkReceiptCorrectionResult> {
  const result: BulkReceiptCorrectionResult = { corrected: 0, amountUsd: 0, skipped: [] };
  let cents = 0;
  for (const customerId of Array.from(new Set(customerIds))) {
    // Recomputed for every customer: the account may have moved, or been
    // corrected by somebody else, since the list was drawn.
    const { byCustomer } = await compute();
    const row = byCustomer.get(customerId);
    if (!row) {
      result.skipped.push({ customerId, reason: "nothing to correct (already done, or no credit from that day)" });
      continue;
    }
    try {
      await adjustCustomerBalance(customerId, row.customerCode, row.phantomUsd, "debit", BULK_RECEIPT_FIX_REASON, userId);
      result.corrected += 1;
      cents += Math.round(row.phantomUsd * 100);
    } catch (err) {
      result.skipped.push({ customerId, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  result.amountUsd = cents / 100;
  return result;
}
