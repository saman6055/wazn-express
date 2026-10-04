import { and, eq, inArray, isNull, like, notInArray, or } from "drizzle-orm";
import { getDb } from "./connection";
import {
  batches, packages, deliveryBoxes, deliveryBoxItems, boxSettlements, boxSettlementLines,
  paymentRecords, invoices, fullPackageOrders, customers, customerAccounts, ledgerTransactions,
} from "../../drizzle/schema";
import {
  isOrderChargeText,
  type BoxFact, type CleanupFacts, type ParcelFact, type ReceiptFact,
} from "@shared/batchCleanup";

const CHARGE_TYPES = [
  "DEBIT_PACKAGE", "DEBIT_FULL_PACKAGE", "DEBIT_PURCHASE_REQUEST", "DEBIT_COMMISSION", "DEBIT_SERVICE",
  "DEBIT_PENALTY", "DEBIT_OTHER",
] as const;

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Everything tied to a batch, as the delete window shows it (shared/batchCleanup).
 * Read only. Parcel rows carry photos, so only the columns used are selected.
 */
export async function getBatchCleanupFacts(batchId: number): Promise<CleanupFacts | null> {
  const db = await getDb();
  if (!db) return null;

  const [batch] = await db
    .select({ id: batches.id, code: batches.batchCode, status: batches.status })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);
  if (!batch) return null;

  const parcelRows = await db
    .select({
      id: packages.id,
      code: packages.packageCode,
      tracking: packages.trackingNumber,
      customerId: packages.customerId,
      weightKg: packages.weightKg,
      priceUsd: packages.calculatedCostUsd,
    })
    .from(packages)
    .where(eq(packages.batchId, batchId));
  const parcelIds = parcelRows.map((p) => p.id);

  // The boxes: those filed under the batch, and any holding one of its parcels.
  const itemsOfParcels = parcelIds.length
    ? await db
        .select({ boxId: deliveryBoxItems.boxId })
        .from(deliveryBoxItems)
        .where(inArray(deliveryBoxItems.packageId, parcelIds))
    : [];
  const boxIdSet = new Set(itemsOfParcels.map((i) => i.boxId));
  const filed = await db.select({ id: deliveryBoxes.id }).from(deliveryBoxes).where(eq(deliveryBoxes.batchId, batchId));
  for (const b of filed) boxIdSet.add(b.id);
  const boxIds = Array.from(boxIdSet);

  const boxRows = boxIds.length
    ? await db
        .select({ id: deliveryBoxes.id, code: deliveryBoxes.boxCode, status: deliveryBoxes.status, customerId: deliveryBoxes.customerId })
        .from(deliveryBoxes)
        .where(inArray(deliveryBoxes.id, boxIds))
    : [];
  const allItems = boxIds.length
    ? await db
        .select({ boxId: deliveryBoxItems.boxId, packageId: deliveryBoxItems.packageId })
        .from(deliveryBoxItems)
        .where(inArray(deliveryBoxItems.boxId, boxIds))
    : [];

  const settlementRows = boxIds.length
    ? await db
        .select({
          id: boxSettlements.id,
          number: boxSettlements.settlementNumber,
          boxId: boxSettlements.boxId,
          customerId: boxSettlements.customerId,
          paidUsd: boxSettlements.paidUsd,
          discountUsd: boxSettlements.discountUsd,
          reversedOnRecord: paymentRecords.reversedAmountUsd,
        })
        .from(boxSettlements)
        .leftJoin(paymentRecords, eq(paymentRecords.id, boxSettlements.paymentRecordId))
        .where(and(inArray(boxSettlements.boxId, boxIds), eq(boxSettlements.status, "confirmed")))
    : [];

  const paidLines = parcelIds.length
    ? await db
        .select({ packageId: boxSettlementLines.packageId, settlementId: boxSettlementLines.settlementId })
        .from(boxSettlementLines)
        .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
        .where(and(inArray(boxSettlementLines.packageId, parcelIds), eq(boxSettlements.status, "confirmed")))
    : [];

  const inBatch = new Set(parcelIds);
  const boxes: BoxFact[] = boxRows.map((b) => {
    const items = allItems.filter((i) => i.boxId === b.id);
    const foreignItems = items.filter((i) => i.packageId === null || !inBatch.has(i.packageId)).length;
    return {
      id: b.id,
      code: b.code,
      status: String(b.status ?? ""),
      customerId: b.customerId ?? null,
      parcelIds: items.map((i) => i.packageId).filter((id): id is number => id !== null && inBatch.has(id)),
      foreignItems,
      receiptIds: settlementRows.filter((s) => s.boxId === b.id).map((s) => s.id),
      eligible: foreignItems === 0,
      why: foreignItems > 0 ? `${foreignItems} شتی تێدایە کە هی ئەم باچە نییە` : undefined,
    };
  });
  const mixedBox = new Set(boxes.filter((b) => !b.eligible).map((b) => b.id));

  const receipts: ReceiptFact[] = settlementRows.map((s) => {
    const paid = num(s.paidUsd);
    const back = Math.round((paid - Math.min(paid, num(s.reversedOnRecord)) + num(s.discountUsd)) * 100) / 100;
    const box = boxes.find((b) => b.id === s.boxId);
    return {
      id: s.id,
      number: s.number,
      boxId: s.boxId,
      boxCode: box?.code ?? "",
      customerId: s.customerId,
      putBackUsd: back,
      eligible: !mixedBox.has(s.boxId),
      why: mixedBox.has(s.boxId) ? "بۆکسەکەی پاکەتی باچێکی تری تێدایە" : undefined,
    };
  });

  // What each parcel still stands charged on its own customer's account.
  const customerIds = Array.from(new Set([
    ...parcelRows.map((p) => p.customerId).filter((id): id is number => !!id),
    ...receipts.map((r) => r.customerId),
  ]));
  const accounts = customerIds.length
    ? await db
        .select({ id: customerAccounts.id, customerId: customerAccounts.customerId, balance: customerAccounts.currentBalanceUsd })
        .from(customerAccounts)
        .where(inArray(customerAccounts.customerId, customerIds))
    : [];
  const charges = parcelIds.length && accounts.length
    ? await db
        .select({
          id: ledgerTransactions.id,
          number: ledgerTransactions.transactionNumber,
          accountId: ledgerTransactions.accountId,
          referenceId: ledgerTransactions.referenceId,
          amountUsd: ledgerTransactions.amountUsd,
          description: ledgerTransactions.description,
        })
        .from(ledgerTransactions)
        .where(and(
          inArray(ledgerTransactions.accountId, accounts.map((a) => a.id)),
          eq(ledgerTransactions.referenceType, "package"),
          inArray(ledgerTransactions.referenceId, parcelIds),
          inArray(ledgerTransactions.transactionType, [...CHARGE_TYPES]),
        ))
    : [];
  const numbers = charges.map((c) => c.number);
  // A charge already reversed or adjusted carries the marker in the row that did it.
  const markers = numbers.length
    ? await db
        .select({ description: ledgerTransactions.description, type: ledgerTransactions.transactionType, amountUsd: ledgerTransactions.amountUsd })
        .from(ledgerTransactions)
        .where(or(...numbers.map((n) => like(ledgerTransactions.description, `%:${n}]%`))))
    : [];
  const standing = (number: string, amount: number) => {
    let left = amount;
    for (const m of markers) {
      const d = String(m.description ?? "");
      if (d.includes(`[REV:${number}]`)) return 0;
      if (d.includes(`[ADJ:${number}]`)) left += (String(m.type).startsWith("ADJUSTMENT_DEBIT") ? 1 : -1) * num(m.amountUsd);
    }
    return Math.max(0, Math.round(left * 100) / 100);
  };

  const parcels: ParcelFact[] = parcelRows.map((p) => {
    const account = accounts.find((a) => a.customerId === p.customerId);
    const own = charges.filter((c) => c.referenceId === p.id && c.accountId === account?.id && !isOrderChargeText(c.description));
    const boxIdsOf = boxes.filter((b) => b.parcelIds.includes(p.id) || allItems.some((i) => i.boxId === b.id && i.packageId === p.id)).map((b) => b.id);
    const mixed = boxIdsOf.some((id) => mixedBox.has(id));
    return {
      id: p.id,
      code: p.code ?? String(p.id),
      tracking: p.tracking ?? null,
      customerId: p.customerId ?? null,
      weightKg: num(p.weightKg),
      priceUsd: num(p.priceUsd),
      chargedUsd: Math.round(own.reduce((s, c) => s + standing(c.number, num(c.amountUsd)), 0) * 100) / 100,
      receiptIds: Array.from(new Set(paidLines.filter((l) => l.packageId === p.id).map((l) => l.settlementId))),
      boxIds: boxIdsOf,
      eligible: !mixed,
      why: mixed ? "لە بۆکسێکدایە کە پاکەتی باچی تری تێدایە — سەرەتا لە بۆکسەکە دەری بهێنە" : undefined,
    };
  });

  const invoiceRows = await db
    .select({ id: invoices.id, number: invoices.invoiceNumber, totalUsd: invoices.totalUsd, status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.batchId, batchId), notInArray(invoices.status, ["cancelled", "refunded"])));

  const orders = await db
    .select({ id: fullPackageOrders.id })
    .from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.batchId, batchId),
      isNull(fullPackageOrders.deletedAt),
      notInArray(fullPackageOrders.status, ["cancelled", "rejected", "refunded", "returned"]),
    ));

  const codes = customerIds.length
    ? await db.select({ id: customers.id, code: customers.customerCode }).from(customers).where(inArray(customers.id, customerIds))
    : [];

  return {
    batch: { id: batch.id, code: batch.code, status: String(batch.status ?? "") },
    receipts,
    parcels,
    boxes,
    invoices: invoiceRows.map((i) => ({ id: i.id, number: i.number, totalUsd: num(i.totalUsd), status: String(i.status) })),
    liveOrders: orders.length,
    customers: customerIds.map((id) => ({
      id,
      code: codes.find((c) => c.id === id)?.code ?? `#${id}`,
      balanceUsd: num(accounts.find((a) => a.customerId === id)?.balance),
    })),
  };
}

/** An invoice of a deleted batch is kept, marked cancelled, with why. */
export async function cancelInvoiceForCleanup(invoiceId: number, note: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select({ notes: invoices.notes }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  await db
    .update(invoices)
    .set({ status: "cancelled", notes: [row?.notes, note].filter(Boolean).join("\n") })
    .where(eq(invoices.id, invoiceId));
}
