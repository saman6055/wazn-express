import { sql } from "drizzle-orm";
import { getDb } from "../db/connection";
import { appLogger } from "../utils/logger";
import { CHECKS, type CheckId, type CheckResult } from "@shared/auditSweep";
import { AMBER_AFTER_DAYS, RED_AFTER_DAYS } from "@shared/batchAge";

/**
 * The queries behind the catalogue.
 *
 * Each check is one SELECT and nothing else. Two rules govern this file:
 *
 * 1. **Nothing here writes.** Not a temp table, not an UPDATE, not a stored
 *    balance "corrected" on the way past. The auditor reports; somebody else
 *    decides. A sweep that fixed what it found would be changing the books
 *    with no invoice, no audit entry and nobody's name on it.
 *
 * 2. **A check that breaks says so.** Every one runs inside its own try, and
 *    a thrown query becomes `status: "failed"` carrying the error. The
 *    tempting alternative — catch, log, return zero — makes a broken check
 *    indistinguishable from a clean one, so the report would say the books
 *    balance on the strength of a query that never ran. That is the single
 *    most dangerous thing this file could do, which is why it cannot.
 *
 * The samples are capped at ten rows. The point is to give somebody enough to
 * go and look, not to move the database into a report.
 */

const SAMPLE_LIMIT = 10;

type Row = Record<string, unknown>;

/** Every check's query, keyed by the id declared in the catalogue. */
const QUERIES: Record<CheckId, string> = {
  /* ── money that contradicts itself ─────────────────────────────────── */

  invoice_total_mismatch: `
    SELECT id, invoiceNumber, subtotalUsd, taxUsd, totalUsd
    FROM invoices
    WHERE status <> 'cancelled'
      AND ABS(CAST(totalUsd AS DECIMAL(14,2))
            - (CAST(subtotalUsd AS DECIMAL(14,2)) + COALESCE(CAST(taxUsd AS DECIMAL(14,2)), 0))) > 0.01
    LIMIT ${SAMPLE_LIMIT}`,

  invoice_paid_but_unbalanced: `
    SELECT id, invoiceNumber, status, paidAt, totalUsd
    FROM invoices
    WHERE (status = 'paid' AND paidAt IS NULL)
       OR (status IN ('draft','issued') AND paidAt IS NOT NULL)
    LIMIT ${SAMPLE_LIMIT}`,

  account_balance_drift: `
    SELECT a.id, a.accountNumber, a.currentBalanceUsd,
           ROUND(COALESCE(SUM(
             CASE WHEN t.transactionType LIKE 'DEBIT_%'
                     OR t.transactionType = 'ADJUSTMENT_DEBIT'  THEN  CAST(t.amountUsd AS DECIMAL(14,2))
                  WHEN t.transactionType LIKE 'CREDIT_%'
                     OR t.transactionType = 'ADJUSTMENT_CREDIT' THEN -CAST(t.amountUsd AS DECIMAL(14,2))
                  ELSE 0 END), 0), 2) AS fromHistory
    FROM customerAccounts a
    LEFT JOIN ledgerTransactions t ON t.accountId = a.id
    GROUP BY a.id, a.accountNumber, a.currentBalanceUsd
    HAVING ABS(CAST(a.currentBalanceUsd AS DECIMAL(14,2)) - COALESCE(SUM(
             CASE WHEN t.transactionType LIKE 'DEBIT_%'
                     OR t.transactionType = 'ADJUSTMENT_DEBIT'  THEN  CAST(t.amountUsd AS DECIMAL(14,2))
                  WHEN t.transactionType LIKE 'CREDIT_%'
                     OR t.transactionType = 'ADJUSTMENT_CREDIT' THEN -CAST(t.amountUsd AS DECIMAL(14,2))
                  ELSE 0 END), 0)) > 0.01
    LIMIT ${SAMPLE_LIMIT}`,

  cash_account_drift: `
    SELECT c.id, c.accountName, c.currentBalance, x.balanceAfter AS lastRecorded, x.transactionDate
    FROM cashAccounts c
    JOIN cashTransactions x ON x.id = (
      SELECT id FROM cashTransactions
      WHERE accountId = c.id
      ORDER BY transactionDate DESC, id DESC
      LIMIT 1
    )
    WHERE ABS(CAST(c.currentBalance AS DECIMAL(14,2)) - CAST(x.balanceAfter AS DECIMAL(14,2))) > 0.01
    LIMIT ${SAMPLE_LIMIT}`,

  partner_books_drift: `
    SELECT p.id, p.name, p.currentBalance,
           ROUND(COALESCE(SUM(
             CASE WHEN t.transactionType IN ('capital_contribution','profit_share','loan_to_company','adjustment')
                    THEN  CAST(t.amountUsd AS DECIMAL(14,2))
                  WHEN t.transactionType IN ('withdrawal','loan_repayment')
                    THEN -CAST(t.amountUsd AS DECIMAL(14,2))
                  ELSE 0 END), 0), 2) AS fromHistory
    FROM partners p
    LEFT JOIN partnerTransactions t ON t.partnerId = p.id
    GROUP BY p.id, p.name, p.currentBalance
    HAVING ABS(CAST(p.currentBalance AS DECIMAL(14,2)) - COALESCE(SUM(
             CASE WHEN t.transactionType IN ('capital_contribution','profit_share','loan_to_company','adjustment')
                    THEN  CAST(t.amountUsd AS DECIMAL(14,2))
                  WHEN t.transactionType IN ('withdrawal','loan_repayment')
                    THEN -CAST(t.amountUsd AS DECIMAL(14,2))
                  ELSE 0 END), 0)) > 0.01
    LIMIT ${SAMPLE_LIMIT}`,

  ownership_not_whole: `
    SELECT ROUND(SUM(CAST(ownershipPercentage AS DECIMAL(7,2))), 2) AS totalShare
    FROM partners
    WHERE isActive = 1
    HAVING ABS(SUM(CAST(ownershipPercentage AS DECIMAL(7,2))) - 100) > 0.005`,

  /* ── rows that point at nothing ────────────────────────────────────── */

  orphan_package_batch: `
    SELECT p.id, p.packageCode, p.batchId
    FROM packages p
    LEFT JOIN batches b ON b.id = p.batchId
    WHERE p.batchId IS NOT NULL AND b.id IS NULL
    LIMIT ${SAMPLE_LIMIT}`,

  orphan_transaction_account: `
    SELECT t.id, t.transactionNumber, t.accountId, t.amountUsd
    FROM ledgerTransactions t
    LEFT JOIN customerAccounts a ON a.id = t.accountId
    WHERE a.id IS NULL
    LIMIT ${SAMPLE_LIMIT}`,

  duplicate_customer_code: `
    SELECT customerCode, COUNT(*) AS howMany
    FROM customers
    GROUP BY customerCode
    HAVING COUNT(*) > 1
    LIMIT ${SAMPLE_LIMIT}`,

  duplicate_tracking_number: `
    SELECT trackingNumber, COUNT(*) AS howMany
    FROM packages
    WHERE trackingNumber IS NOT NULL AND TRIM(trackingNumber) <> ''
    GROUP BY trackingNumber
    HAVING COUNT(*) > 1
    LIMIT ${SAMPLE_LIMIT}`,

  /* ── figures that cannot be right ──────────────────────────────────── */

  negative_weight: `
    SELECT id, packageCode, weightKg
    FROM packages
    WHERE weightKg IS NOT NULL AND CAST(weightKg AS DECIMAL(10,3)) <= 0
    LIMIT ${SAMPLE_LIMIT}`,

  zero_price_sale: `
    SELECT id, orderNumber, sellingPriceUsd, purchasePriceUsd
    FROM fullPackageOrders
    WHERE sellingPriceUsd IS NOT NULL AND CAST(sellingPriceUsd AS DECIMAL(14,2)) <= 0
    LIMIT ${SAMPLE_LIMIT}`,

  /* ── work that has stopped ─────────────────────────────────────────── */

  batch_overdue: `
    SELECT id, batchCode, status, createdAt,
           DATEDIFF(NOW(), createdAt) AS daysOpen
    FROM batches
    WHERE status NOT IN ('delivered','closed')
      AND DATEDIFF(NOW(), createdAt) > ${RED_AFTER_DAYS}
    ORDER BY createdAt ASC
    LIMIT ${SAMPLE_LIMIT}`,

  batch_unwatched: `
    SELECT id, batchCode, shippingType, awbNumber, DATEDIFF(NOW(), createdAt) AS daysOpen
    FROM batches
    WHERE status NOT IN ('delivered','closed')
      AND shippingType IN ('air_regular','air_irregular')
      AND (flightNumber IS NULL OR TRIM(flightNumber) = '')
      AND DATEDIFF(NOW(), createdAt) >= 4
    ORDER BY createdAt ASC
    LIMIT ${SAMPLE_LIMIT}`,

  package_never_batched: `
    SELECT id, packageCode, status, DATEDIFF(NOW(), createdAt) AS daysWaiting
    FROM packages
    WHERE batchId IS NULL
      AND status NOT IN ('delivered','cancelled','returned')
      AND DATEDIFF(NOW(), createdAt) > ${AMBER_AFTER_DAYS}
    ORDER BY createdAt ASC
    LIMIT ${SAMPLE_LIMIT}`,

  package_arrived_undelivered: `
    SELECT id, packageCode, status, DATEDIFF(NOW(), createdAt) AS daysWaiting
    FROM packages
    WHERE status IN ('ready_for_delivery','at_depot','customs_processing')
      AND deliveredAt IS NULL
      AND DATEDIFF(NOW(), createdAt) > ${RED_AFTER_DAYS}
    ORDER BY createdAt ASC
    LIMIT ${SAMPLE_LIMIT}`,

  unclaimed_no_request: `
    SELECT p.id, p.packageCode, DATEDIFF(NOW(), p.createdAt) AS daysWaiting
    FROM packages p
    LEFT JOIN packageClaimRequests r ON r.packageId = p.id
    WHERE p.isUnclaimed = 1
      AND r.id IS NULL
      AND DATEDIFF(NOW(), p.createdAt) > ${AMBER_AFTER_DAYS}
    ORDER BY p.createdAt ASC
    LIMIT ${SAMPLE_LIMIT}`,

  debt_unreminded: `
    SELECT a.id, a.accountNumber, a.currentBalanceUsd,
           DATEDIFF(NOW(), a.updatedAt) AS daysSinceMoved
    FROM customerAccounts a
    LEFT JOIN paymentReminders m ON m.accountId = a.id
    WHERE CAST(a.currentBalanceUsd AS DECIMAL(14,2)) > 0
      AND DATEDIFF(NOW(), a.updatedAt) > 30
      AND m.id IS NULL
    ORDER BY a.currentBalanceUsd DESC
    LIMIT ${SAMPLE_LIMIT}`,
};

/**
 * Run one check.
 *
 * Returns rather than throws. The caller wants eighteen answers, and one bad
 * query must not cost it the other seventeen.
 */
async function runCheck(id: CheckId): Promise<CheckResult> {
  try {
    const db = await getDb();
    if (!db) {
      return { id, status: "failed", count: 0, error: "no database connection" };
    }

    const [rows] = (await db.execute(sql.raw(QUERIES[id]))) as unknown as [Row[]];
    const found = Array.isArray(rows) ? rows : [];

    if (found.length === 0) return { id, status: "clean", count: 0 };
    return { id, status: "found", count: found.length, sample: found };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Logged as well as returned: a check that has been failing for a week is
    // a bug in this file, and the report alone is easy to skim past.
    appLogger.warn(`Audit check failed: ${id}`, { error: message });
    return { id, status: "failed", count: 0, error: message };
  }
}

/**
 * Every check, in one pass.
 *
 * Sequential on purpose. This runs against the production database while the
 * office is using it, and eighteen simultaneous aggregate scans is a way to
 * make the whole system slow for everyone at eight in the morning. A sweep
 * that takes a few seconds longer costs nothing; one that locks the parcels
 * page costs the day.
 */
export async function runSweep(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of CHECKS) {
    results.push(await runCheck(check.id));
  }
  return results;
}

export interface Movement {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  userId: number | null;
  userRole: string | null;
  createdAt: Date | string;
}

/**
 * What has changed since a given moment.
 *
 * The audit log is the only place that records who moved a figure and when,
 * so "what happened since yesterday" is one query rather than a diff of
 * everything. Capped, because an unbounded answer to that question on a busy
 * day is the entire table.
 */
export async function movementsSince(since: Date, limit = 500): Promise<Movement[]> {
  const db = await getDb();
  if (!db) return [];

  const [rows] = (await db.execute(
    sql`SELECT id, action, entityType, entityId, userId, userRole, createdAt
        FROM auditLogs
        WHERE createdAt >= ${since}
        ORDER BY createdAt DESC
        LIMIT ${limit}`,
  )) as unknown as [Movement[]];

  return Array.isArray(rows) ? rows : [];
}
