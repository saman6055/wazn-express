import { and, desc, eq, gt, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "./connection";
import { boxSettlements, customerAccounts, deliveryBoxes } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { PAYMENT_WHATSAPP_SINCE } from "@shared/paymentWhatsApp";

/**
 * What "your payment arrived" says for one receipt, with the account as it
 * stands now (shared/paymentWhatsApp). Read only.
 */
export async function getPaymentWhatsAppFacts(settlementId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      settlementNumber: boxSettlements.settlementNumber,
      paidUsd: boxSettlements.paidUsd,
      status: boxSettlements.status,
      boxCode: deliveryBoxes.boxCode,
      parcelCount: deliveryBoxes.totalPackages,
      name: customers.fullName,
      code: customers.customerCode,
      mobile: customers.mobileNumber,
      nationality: customers.nationality,
      balance: customerAccounts.currentBalanceUsd,
    })
    .from(boxSettlements)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .innerJoin(customers, eq(customers.id, boxSettlements.customerId))
    .leftJoin(customerAccounts, eq(customerAccounts.customerId, boxSettlements.customerId))
    .where(eq(boxSettlements.id, settlementId))
    .limit(1);
  if (!row || row.status !== "confirmed") return null;
  return {
    settlementNumber: row.settlementNumber,
    paidUsd: Number(row.paidUsd ?? 0),
    whatsapp: {
      name: String(row.name ?? row.code ?? ""),
      mobile: row.mobile ?? null,
      nationality: row.nationality ?? null,
      balanceUsd: Number(row.balance ?? 0),
      boxCode: row.boxCode,
      parcelCount: Number(row.parcelCount ?? 0),
    },
  };
}

/** Told on WhatsApp: stamped with when and by whom. */
export async function markPaymentWhatsAppSent(settlementId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(boxSettlements)
    .set({ whatsappSentAt: new Date(), whatsappSentById: userId })
    .where(eq(boxSettlements.id, settlementId));
}

/**
 * Receipts the customer was not told about on WhatsApp yet — from the day
 * this began (earlier receipts were never meant to be sent) and older than a
 * few minutes, so the till has time to press Send. Newest first.
 */
export const PAYMENT_WHATSAPP_GRACE_MS = 5 * 60_000;

export async function listUnsentPaymentWhatsApp() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      settlementId: boxSettlements.id,
      settlementNumber: boxSettlements.settlementNumber,
      paidUsd: boxSettlements.paidUsd,
      createdAt: boxSettlements.createdAt,
      boxId: boxSettlements.boxId,
      boxCode: deliveryBoxes.boxCode,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(boxSettlements)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .innerJoin(customers, eq(customers.id, boxSettlements.customerId))
    .where(and(
      eq(boxSettlements.status, "confirmed"),
      gt(boxSettlements.paidUsd, "0"),
      isNull(boxSettlements.whatsappSentAt),
      gte(boxSettlements.createdAt, PAYMENT_WHATSAPP_SINCE),
      lte(boxSettlements.createdAt, new Date(Date.now() - PAYMENT_WHATSAPP_GRACE_MS)),
    ))
    .orderBy(desc(boxSettlements.createdAt))
    .limit(200);
}
