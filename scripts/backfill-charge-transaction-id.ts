/**
 * Plan v3, Phase 1 — one-shot backfill for fullPackageOrders.chargeTransactionId
 *
 * After the Phase 1 migration adds the new column, every historical order
 * still has chargeTransactionId = NULL. This script scans all non-deleted
 * orders, finds the matching DEBIT ledger transaction (by referenceType +
 * referenceId), and populates chargeTransactionId so the edit/delete flows
 * in Phase 3 can reverse/adjust the exact original charge.
 *
 * Design guarantees:
 *   - Idempotent: only updates rows where chargeTransactionId IS NULL.
 *   - Safe: never overwrites an existing value.
 *   - Deterministic: picks the EARLIEST DEBIT transaction for each order
 *     (the one created at applyCharge time). Adjustment transactions that
 *     come later are ignored.
 *   - Dry-run support via `--dry-run` flag so operators can inspect output
 *     before committing.
 *   - Transparent: logs every order that gets backfilled, every order that
 *     was skipped (no charge found), and emits a final summary.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-charge-transaction-id.ts --dry-run
 *   pnpm exec tsx scripts/backfill-charge-transaction-id.ts
 */
import "dotenv/config";
import { getDb } from "../server/db/connection";
import {
  fullPackageOrders,
  ledgerTransactions,
} from "../drizzle/schema";
import { and, eq, inArray, isNull, asc } from "drizzle-orm";

type BackfillResult = {
  orderId: number;
  orderCode: string;
  orderType: string;
  chargeTransactionId: number | null;
  status: "backfilled" | "skipped_already_set" | "skipped_no_charge" | "skipped_dry_run";
};

// orderType (fullPackageOrders.orderType) → matching DEBIT referenceType
const REF_TYPE_FOR_ORDER: Record<string, "full_package" | "commission" | "purchase_request"> = {
  full_package: "full_package",
  commission: "commission",
  purchase_request: "purchase_request",
};

// DEBIT transaction types that represent the ORIGINAL charge on an order.
// Adjustments and reversals are deliberately excluded so we always point to
// the genesis charge.
const ORIGINAL_DEBIT_TYPES = [
  "DEBIT_FULL_PACKAGE",
  "DEBIT_COMMISSION",
  "DEBIT_PURCHASE_REQUEST",
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await getDb();
  if (!db) {
    console.error("❌ DATABASE_URL not set or database unavailable. Check your .env file.");
    process.exit(1);
  }

  console.log(`\n🔧 Backfill chargeTransactionId — ${dryRun ? "DRY RUN" : "LIVE"} mode\n`);

  // Only look at non-deleted orders that don't already have a chargeTransactionId.
  const orders = await db.select({
    id: fullPackageOrders.id,
    orderCode: fullPackageOrders.orderCode,
    orderType: fullPackageOrders.orderType,
    customerId: fullPackageOrders.customerId,
  })
    .from(fullPackageOrders)
    .where(and(
      isNull(fullPackageOrders.chargeTransactionId),
      isNull(fullPackageOrders.deletedAt),
    ));

  console.log(`Found ${orders.length} orders without chargeTransactionId.\n`);
  if (orders.length === 0) {
    console.log("✅ Nothing to backfill. Exiting.");
    process.exit(0);
  }

  const results: BackfillResult[] = [];
  let backfilled = 0;
  let skippedNoCharge = 0;

  for (const order of orders) {
    const refType = REF_TYPE_FOR_ORDER[order.orderType];
    if (!refType) {
      // Unknown orderType — skip defensively. Should never happen but guard anyway.
      results.push({
        orderId: order.id,
        orderCode: order.orderCode,
        orderType: order.orderType,
        chargeTransactionId: null,
        status: "skipped_no_charge",
      });
      skippedNoCharge++;
      continue;
    }

    // Pick the earliest DEBIT transaction that references this order.
    // Ordering by id ASC is equivalent to createdAt ASC for auto-increment ids
    // and avoids tie-breaking issues on identical timestamps.
    const [originalCharge] = await db.select({
      id: ledgerTransactions.id,
      transactionType: ledgerTransactions.transactionType,
      createdAt: ledgerTransactions.createdAt,
    })
      .from(ledgerTransactions)
      .where(and(
        eq(ledgerTransactions.referenceType, refType),
        eq(ledgerTransactions.referenceId, order.id),
        inArray(ledgerTransactions.transactionType, ORIGINAL_DEBIT_TYPES as unknown as string[]),
      ))
      .orderBy(asc(ledgerTransactions.id))
      .limit(1);

    if (!originalCharge) {
      // Order exists but was never charged (e.g. still 'pending', or quote-only
      // purchase request). That's fine — edit/delete paths will see a NULL
      // chargeTransactionId and skip the reversal step.
      results.push({
        orderId: order.id,
        orderCode: order.orderCode,
        orderType: order.orderType,
        chargeTransactionId: null,
        status: "skipped_no_charge",
      });
      skippedNoCharge++;
      continue;
    }

    if (dryRun) {
      results.push({
        orderId: order.id,
        orderCode: order.orderCode,
        orderType: order.orderType,
        chargeTransactionId: originalCharge.id,
        status: "skipped_dry_run",
      });
    } else {
      // Double-check IS NULL inside the UPDATE to prevent clobbering if a
      // concurrent write happened between the SELECT above and this UPDATE.
      await db.update(fullPackageOrders)
        .set({ chargeTransactionId: originalCharge.id })
        .where(and(
          eq(fullPackageOrders.id, order.id),
          isNull(fullPackageOrders.chargeTransactionId),
        ));
      results.push({
        orderId: order.id,
        orderCode: order.orderCode,
        orderType: order.orderType,
        chargeTransactionId: originalCharge.id,
        status: "backfilled",
      });
      backfilled++;
    }
  }

  // ========== SUMMARY ==========
  console.log("─".repeat(80));
  console.log("Summary:");
  console.log(`  Orders scanned:             ${orders.length}`);
  console.log(`  ${dryRun ? "Would backfill" : "Backfilled"}:                ${dryRun ? results.filter(r => r.status === "skipped_dry_run").length : backfilled}`);
  console.log(`  Skipped (no charge found):  ${skippedNoCharge}`);
  console.log("─".repeat(80));

  // Detail list for operators to scan.
  for (const r of results.slice(0, 50)) {
    const marker = {
      backfilled: "✅",
      skipped_already_set: "⏭️",
      skipped_no_charge: "⚠️",
      skipped_dry_run: "🔍",
    }[r.status];
    console.log(`  ${marker} #${r.orderId} ${r.orderCode} (${r.orderType}) → txn ${r.chargeTransactionId ?? "—"}`);
  }
  if (results.length > 50) {
    console.log(`  … (${results.length - 50} more)`);
  }

  if (dryRun) {
    console.log("\n🔍 Dry-run complete. Re-run without --dry-run to apply changes.");
  } else {
    console.log("\n✅ Backfill complete.");
  }
  process.exit(0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("❌ Backfill failed:", msg);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
