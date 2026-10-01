import { sql } from "drizzle-orm";
import { getDb } from "./connection";

/**
 * Every customer the books say we owe money to, and the likeliest reason.
 *
 * Owner, 2026-10-01: "no customer has credit — find the ones that do."
 * Nobody prepays here, so a credit balance is almost never money handed
 * over in advance; it is a debt that was cleared twice. The case that
 * showed it (AZ173): a balance zeroed by hand, then the old boxes receipted
 * for the same money — see accountCover in shared/boxSettlement, which now
 * stops that at the till. This finds the ones that happened before it.
 *
 * Read only. Nothing moves because the list was opened; each row is for the
 * owner to look at and decide.
 */

export interface CreditCustomerRow {
  customerId: number;
  customerCode: string;
  customerName: string;
  /** What the account says we owe the customer. Always positive. */
  creditUsd: number;
  /** Balance lowered by hand, naming no parcel. */
  handCreditUsd: number;
  lastHandCreditAt: Date | null;
  /** Money taken on box receipts still standing. */
  boxReceiptsUsd: number;
  lastBoxReceiptAt: Date | null;
  /** Discounts given. */
  discountUsd: number;
  /**
   * `double_clearing` — lowered by hand and receipted at a box as well, the
   * AZ173 pattern. `hand_credit` — lowered by hand only. `discount` — the
   * discounts alone are at least the credit. `other` — none of those.
   */
  likelyCause: "double_clearing" | "hand_credit" | "discount" | "other";
}

/** Shared with the test: which story a row's numbers tell. */
export function likelyCreditCause(row: {
  creditUsd: number;
  handCreditUsd: number;
  boxReceiptsUsd: number;
  discountUsd: number;
}): CreditCustomerRow["likelyCause"] {
  if (row.handCreditUsd > 0.005 && row.boxReceiptsUsd > 0.005) return "double_clearing";
  if (row.handCreditUsd > 0.005) return "hand_credit";
  if (row.discountUsd + 0.005 >= row.creditUsd) return "discount";
  return "other";
}

export async function findCustomersInCredit(): Promise<CreditCustomerRow[]> {
  const db = await getDb();
  if (!db) return [];

  const [rows] = (await db.execute(sql`
    SELECT c.id AS customerId, c.customerCode, c.fullName AS customerName,
           ROUND(-CAST(a.currentBalanceUsd AS DECIMAL(14,2)), 2) AS creditUsd,
           COALESCE(h.handCreditUsd, 0) AS handCreditUsd, h.lastHandCreditAt,
           COALESCE(b.boxReceiptsUsd, 0) AS boxReceiptsUsd, b.lastBoxReceiptAt,
           COALESCE(d.discountUsd, 0) AS discountUsd
    FROM customerAccounts a
    JOIN customers c ON c.id = a.customerId
    LEFT JOIN (
      SELECT accountId, SUM(CAST(amountUsd AS DECIMAL(14,2))) AS handCreditUsd, MAX(createdAt) AS lastHandCreditAt
      FROM ledgerTransactions
      WHERE transactionType = 'ADJUSTMENT_CREDIT'
        AND (referenceType IS NULL OR referenceType IN ('adjustment', 'manual'))
      GROUP BY accountId
    ) h ON h.accountId = a.id
    LEFT JOIN (
      SELECT customerId, SUM(CAST(paidUsd AS DECIMAL(14,2))) AS boxReceiptsUsd, MAX(createdAt) AS lastBoxReceiptAt
      FROM boxSettlements
      WHERE status = 'confirmed'
      GROUP BY customerId
    ) b ON b.customerId = c.id
    LEFT JOIN (
      SELECT accountId, SUM(CAST(amountUsd AS DECIMAL(14,2))) AS discountUsd
      FROM ledgerTransactions
      WHERE transactionType = 'CREDIT_DISCOUNT'
      GROUP BY accountId
    ) d ON d.accountId = a.id
    WHERE CAST(a.currentBalanceUsd AS DECIMAL(14,2)) < -0.005
    ORDER BY CAST(a.currentBalanceUsd AS DECIMAL(14,2)) ASC
    LIMIT 1000`)) as unknown as [Array<Record<string, unknown>>];

  return (Array.isArray(rows) ? rows : []).map((r) => {
    const base = {
      customerId: Number(r.customerId),
      customerCode: String(r.customerCode ?? ""),
      customerName: String(r.customerName ?? ""),
      creditUsd: Number(r.creditUsd ?? 0),
      handCreditUsd: Number(r.handCreditUsd ?? 0),
      lastHandCreditAt: (r.lastHandCreditAt as Date | null) ?? null,
      boxReceiptsUsd: Number(r.boxReceiptsUsd ?? 0),
      lastBoxReceiptAt: (r.lastBoxReceiptAt as Date | null) ?? null,
      discountUsd: Number(r.discountUsd ?? 0),
    };
    return { ...base, likelyCause: likelyCreditCause(base) };
  });
}
