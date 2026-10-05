import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import {
  packages, customerAccounts, ledgerTransactions, boxSettlementLines, boxSettlements, deliveryBoxes,
  type LedgerTransaction,
} from "../../drizzle/schema";
import { reverseCharge } from "./finance.db";
import { withFix } from "@shared/fixAdvice";
import { isOrderChargeText } from "@shared/batchCleanup";

/**
 * Delete a parcel and take its money off the account with it.
 *
 * Deleting used to remove the row and nothing else. The parcel's charge
 * stayed on the customer's account with nothing left to explain it — a debt
 * for a parcel that no longer exists — and the office's own workaround for a
 * wrong weight, "delete it and register it again", put a second charge
 * beside the first (told to the owner 2026-09-21; fixed 2026-10-02).
 *
 * Now, in one transaction: every charge posted for this parcel on its own
 * customer's account is reversed (through reverseCharge, so corrections made
 * since are counted and a second call changes nothing), and then the row
 * goes. If either half fails, neither happens.
 *
 * A parcel already paid for on a box receipt is refused. Its money was
 * taken; removing the parcel would leave a payment with nothing behind it.
 * The receipt is undone first, which puts the money question to a person.
 */

export const PARCEL_CHARGE_TYPES = [
  "DEBIT_PACKAGE", "DEBIT_FULL_PACKAGE", "DEBIT_PURCHASE_REQUEST", "DEBIT_COMMISSION", "DEBIT_SERVICE",
  "DEBIT_PENALTY", "DEBIT_OTHER",
] as const;
const CHARGE_TYPES = PARCEL_CHARGE_TYPES;

/**
 * Commission freight is posted as a `package` charge whose reference is the
 * ORDER's id, which can equal some parcel's id. Its text begins with these
 * words; a parcel's own charge never does.
 */
const ORDER_FREIGHT_PREFIX = "کڕین بە تێچوو";

/**
 * The receipt a parcel was paid on, if it was.
 *
 * Asked by everything that would take the parcel's charge away or lower it:
 * the money was taken, so the receipt is undone first and a person answers
 * the money question.
 */
export async function parcelReceipt(
  packageId: number,
): Promise<{ settlementNumber: string; boxCode: string | null } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const receipts = await db
    .select({ settlementNumber: boxSettlements.settlementNumber, boxCode: deliveryBoxes.boxCode })
    .from(boxSettlementLines)
    .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
    .leftJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .where(and(eq(boxSettlementLines.packageId, packageId), eq(boxSettlements.status, "confirmed")))
    .limit(1);
  return receipts[0] ?? null;
}

/**
 * The ledger rows that are this parcel's own charge, on one account.
 *
 * One rule, read by deleting a parcel and by correcting one: a charge posted
 * under the parcel's id - and not an order's freight, which is posted as a
 * `package` charge under the ORDER's id, a number that can equal a parcel's.
 */
export async function parcelOwnCharges(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  account: { id: number },
  packageId: number,
): Promise<LedgerTransaction[]> {
  const rows: LedgerTransaction[] = await tx
    .select()
    .from(ledgerTransactions)
    .where(and(
      eq(ledgerTransactions.accountId, account.id),
      eq(ledgerTransactions.referenceType, "package"),
      eq(ledgerTransactions.referenceId, packageId),
      inArray(ledgerTransactions.transactionType, [...CHARGE_TYPES]),
    ));
  const own: LedgerTransaction[] = [];
  for (const charge of rows) {
    // An order's freight, posted under the order's id — which can be
    // this parcel's id too. Older rows say «کڕین بە عمولە», newer ones
    // «کڕین بە تێچوو»; both name the order (shared/batchCleanup).
    if (isOrderChargeText(charge.description) || String(charge.description ?? "").trimStart().startsWith(ORDER_FREIGHT_PREFIX)) continue;
    own.push(charge);
  }
  return own;
}

export interface ParcelDeletionResult {
  reversedCharges: number;
  reversedUsd: number;
}

export async function deleteParcelWithItsCharges(
  packageId: number,
  userId: number,
): Promise<ParcelDeletionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);
  if (!pkg) return { reversedCharges: 0, reversedUsd: 0 };

  const r = await parcelReceipt(packageId);
  if (r) {
    throw new Error(withFix(
      `ئەم پاکەتە ناسڕدرێتەوە: پارەکەی لە وەسڵی ${r.settlementNumber} ـی بۆکسی ${r.boxCode ?? ""} وەرگیراوە. سڕینەوەی پاکەتەکە پارەیەک بەجێ دەهێڵێت کە هیچ شتێکی لە پشت نییە.`,
      [
        `بۆکسی ${r.boxCode ?? ""} بکەرەوە و وەسڵەکە هەڵبوەشێنەوە`,
        "ئینجا بگەڕێوە و پاکەتەکە بسڕەوە",
        "ئەگەر تەنها کێش یان نرخ هەڵەیە، پاکەتەکە مەسڕەوە — لە شاشەی پارەدانی بۆکس نرخەکەی ڕاست بکەرەوە",
      ],
    ));
  }

  return db.transaction(async (tx) => {
    let reversedCharges = 0;
    let reversedCents = 0;

    if (pkg.customerId) {
      const [account] = await tx
        .select({ id: customerAccounts.id })
        .from(customerAccounts)
        .where(eq(customerAccounts.customerId, pkg.customerId))
        .limit(1);
      if (account) {
        const charges = await parcelOwnCharges(tx, account, packageId);
        for (const charge of charges) {
          const { reversalTransaction } = await reverseCharge(
            charge.id,
            `سڕینەوەی پاکەت ${pkg.trackingNumber ?? pkg.packageCode ?? packageId}`,
            userId,
            tx,
          );
          reversedCharges += 1;
          reversedCents += Math.round(parseFloat(reversalTransaction.amountUsd || "0") * 100);
        }
      }
    }

    await tx.delete(packages).where(eq(packages.id, packageId));
    return { reversedCharges, reversedUsd: reversedCents / 100 };
  });
}
