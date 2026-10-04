import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { boxSettlements, customers, deliveryBoxes, paymentRecords } from "../../drizzle/schema";
import { BULK_RECEIPT_DAY } from "@shared/bulkReceiptCredit";
import { createAuditLog } from "./admin.db";

/**
 * The receipts 10 September wrote more than once.
 *
 * That day old boxes were closed in bulk, and some were receipted again and
 * again — BOX-20260705-004 twenty-two times, $50.83 each. Every receipt after
 * the first counted money that never came in: $1,863.56 in all. The accounts
 * were put right by the credit clean-up (a correction row each), so no
 * balance is wrong; but the payment records still count that money as
 * received, and every report of cash taken reads them.
 *
 * Marking a duplicate void is a status with its reason — the receipt row and
 * its payment row stay, readable — and it posts nothing to any account,
 * because the account's correction is already there. Only that day, the one
 * the clean-up corrected; a receipt cannot be written twice any more
 * (boxSettlement.db, a58146e).
 */

export const DUPLICATE_RECEIPT_REASON =
  "وەسڵی دووبارەی 10/09 — هەمان بۆکس و هەمان بڕ؛ پارەی دووەم هەرگیز نەهاتووە. حیسابی کڕیار پێشتر ڕاست کراوەتەوە، هیچ پارەیەک ناجووڵێت.";

export interface DuplicateReceiptRow {
  settlementId: number;
  number: string;
  keptNumber: string;
  boxCode: string;
  customerCode: string;
  paidUsd: number;
}

export async function findDuplicateReceipts(onlyIds?: number[]): Promise<DuplicateReceiptRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: boxSettlements.id,
      number: boxSettlements.settlementNumber,
      boxId: boxSettlements.boxId,
      paidUsd: boxSettlements.paidUsd,
      boxCode: deliveryBoxes.boxCode,
      customerCode: customers.customerCode,
    })
    .from(boxSettlements)
    .leftJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .leftJoin(customers, eq(customers.id, boxSettlements.customerId))
    .where(and(
      eq(boxSettlements.status, "confirmed"),
      gt(boxSettlements.paidUsd, "0"),
      sql`DATE(${boxSettlements.createdAt}) = ${BULK_RECEIPT_DAY}`,
    ))
    .orderBy(asc(boxSettlements.id));

  const firstOf = new Map<string, string>();
  const out: DuplicateReceiptRow[] = [];
  for (const r of rows) {
    const key = `${r.boxId}|${Number(r.paidUsd).toFixed(2)}`;
    const kept = firstOf.get(key);
    if (!kept) {
      firstOf.set(key, r.number);
      continue;
    }
    if (onlyIds && !onlyIds.includes(r.id)) continue;
    out.push({
      settlementId: r.id,
      number: r.number,
      keptNumber: kept,
      boxCode: r.boxCode ?? "",
      customerCode: r.customerCode ?? "",
      paidUsd: Number(r.paidUsd ?? 0),
    });
  }
  return out;
}

/** Void the named duplicates: status and reason only, nothing on any account. */
export async function voidDuplicateReceipts(
  settlementIds: number[],
  user: { id: number; role: string },
): Promise<{ voided: number; amountUsd: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await findDuplicateReceipts(settlementIds);
  let amount = 0;
  for (const r of rows) {
    const [s] = await db
      .select({ paymentRecordId: boxSettlements.paymentRecordId })
      .from(boxSettlements)
      .where(eq(boxSettlements.id, r.settlementId))
      .limit(1);
    await db
      .update(boxSettlements)
      .set({ status: "reversed", reversedAt: new Date(), reversedById: user.id, reversalReason: DUPLICATE_RECEIPT_REASON })
      .where(and(eq(boxSettlements.id, r.settlementId), eq(boxSettlements.status, "confirmed")));
    if (s?.paymentRecordId) {
      const [p] = await db.select({ amountUsd: paymentRecords.amountUsd }).from(paymentRecords).where(eq(paymentRecords.id, s.paymentRecordId)).limit(1);
      await db
        .update(paymentRecords)
        .set({
          reversedAmountUsd: String(p?.amountUsd ?? r.paidUsd),
          reversedAt: new Date(),
          paymentStatus: "cancelled",
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancelReason: DUPLICATE_RECEIPT_REASON,
        })
        .where(inArray(paymentRecords.id, [s.paymentRecordId]));
    }
    await createAuditLog({
      userId: user.id,
      userRole: user.role,
      action: "void_duplicate_receipt",
      entityType: "box_settlement",
      entityId: r.settlementId,
      oldValues: { number: r.number, paidUsd: r.paidUsd, keptNumber: r.keptNumber },
      newValues: { status: "reversed", ledger: "untouched" },
    });
    amount += r.paidUsd;
  }
  return { voided: rows.length, amountUsd: Math.round(amount * 100) / 100 };
}
