import { and, eq, inArray, like } from "drizzle-orm";
import { getDb } from "./connection";
import { boxSettlements, customerAccounts, deliveryBoxItems, deliveryBoxes, fullPackageOrders, fullPackageOrderTrackings, ledgerTransactions, packages } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { isOrderChargeText } from "@shared/batchCleanup";
import { withFix } from "@shared/fixAdvice";
import {
  doubleChargeReason,
  falseDebt,
  planCorrection,
  stillOwed,
  trackingKey,
  twiceCharged,
  type AccountRow,
  type DoubleChargeCustomer,
  type DoubleChargeLine,
} from "@shared/boxPaidStillOwed";
import { appLogger } from "../utils/logger";
import { cacheGetOrSet, cacheInvalidate } from "./cache";
import { adjustCharge, effectiveChargeUsd, reverseCharge } from "./finance.db";

const num = (v: unknown) => Number(v ?? 0) || 0;
const cents = (n: number) => Math.round(n * 100) / 100;
const COUNT_KEY = "boxes:double-charged";

/** The box's own line for a tracking: «BOX-20260823-003 — 79019153879390». */
const BOX_LINE = /^(BOX-[\w-]+)\s+—\s+(\S+)/;

/**
 * Every customer who still owes for goods in a box that was receipted
 * (shared/boxPaidStillOwed). Read only.
 *
 * For each box-side charge that still stands, the orders carrying the same
 * tracking for the same customer are found, and what still stands of their
 * own charges — goods and freight — is set beside it.
 */
export async function findBoxDoubleCharges(onlyCustomerId?: number): Promise<DoubleChargeCustomer[]> {
  const db = await getDb();
  if (!db) return [];

  const boxRows = await db
    .select({
      id: ledgerTransactions.id,
      accountId: ledgerTransactions.accountId,
      transactionNumber: ledgerTransactions.transactionNumber,
      amountUsd: ledgerTransactions.amountUsd,
      description: ledgerTransactions.description,
      referenceId: ledgerTransactions.referenceId,
      createdAt: ledgerTransactions.createdAt,
      customerId: customerAccounts.customerId,
    })
    .from(ledgerTransactions)
    .innerJoin(customerAccounts, eq(customerAccounts.id, ledgerTransactions.accountId))
    .where(and(
      eq(ledgerTransactions.transactionType, "DEBIT_PACKAGE"),
      like(ledgerTransactions.description, "BOX-% — %"),
      ...(onlyCustomerId ? [eq(customerAccounts.customerId, onlyCustomerId)] : []),
    ));
  if (boxRows.length === 0) return [];

  // The tracking each box line names, and the orders that carry it.
  const parsed = boxRows
    .map((r) => ({ row: r, match: BOX_LINE.exec(String(r.description ?? "")) }))
    .filter((p): p is { row: (typeof boxRows)[number]; match: RegExpExecArray } => p.match !== null);
  const trackings = Array.from(new Set(parsed.map((p) => p.match[2])));
  if (trackings.length === 0) return [];

  const orders: Array<{ id: number; orderCode: string; customerId: number | null; chargeTransactionId: number | null; tracking: string }> = [];
  for (let i = 0; i < trackings.length; i += 500) {
    const chunk = trackings.slice(i, i + 500);
    const [own, listed, viaParcel] = await Promise.all([
      db.select({ id: fullPackageOrders.id, orderCode: fullPackageOrders.orderCode, customerId: fullPackageOrders.customerId, chargeTransactionId: fullPackageOrders.chargeTransactionId, tracking: fullPackageOrders.trackingNumber })
        .from(fullPackageOrders).where(inArray(fullPackageOrders.trackingNumber, chunk)),
      db.select({ id: fullPackageOrders.id, orderCode: fullPackageOrders.orderCode, customerId: fullPackageOrders.customerId, chargeTransactionId: fullPackageOrders.chargeTransactionId, tracking: fullPackageOrderTrackings.trackingNumber })
        .from(fullPackageOrderTrackings).innerJoin(fullPackageOrders, eq(fullPackageOrders.id, fullPackageOrderTrackings.fullPackageOrderId)).where(inArray(fullPackageOrderTrackings.trackingNumber, chunk)),
      db.select({ id: fullPackageOrders.id, orderCode: fullPackageOrders.orderCode, customerId: fullPackageOrders.customerId, chargeTransactionId: fullPackageOrders.chargeTransactionId, tracking: packages.trackingNumber })
        .from(packages).innerJoin(fullPackageOrders, eq(fullPackageOrders.id, packages.fullPackageOrderId)).where(inArray(packages.trackingNumber, chunk)),
    ]);
    for (const o of [...own, ...listed, ...viaParcel]) {
      if (o.tracking) orders.push({ id: Number(o.id), orderCode: o.orderCode, customerId: o.customerId ?? null, chargeTransactionId: o.chargeTransactionId ?? null, tracking: String(o.tracking) });
    }
  }
  if (orders.length === 0) return [];

  // The order-side rows: an order's goods (by its stamped charge, or its own
  // types under its id) and its freight (a package charge under the ORDER's id).
  const orderIds = Array.from(new Set(orders.map((o) => o.id)));
  const stamped = Array.from(new Set(orders.map((o) => o.chargeTransactionId).filter((id): id is number => !!id)));
  const orderRows: Array<{ id: number; accountId: number; transactionNumber: string; amountUsd: string | null; description: string | null; referenceId: number | null; transactionType: string }> = [];
  for (let i = 0; i < orderIds.length; i += 500) {
    const chunk = orderIds.slice(i, i + 500);
    const rows = await db
      .select({ id: ledgerTransactions.id, accountId: ledgerTransactions.accountId, transactionNumber: ledgerTransactions.transactionNumber, amountUsd: ledgerTransactions.amountUsd, description: ledgerTransactions.description, referenceId: ledgerTransactions.referenceId, transactionType: ledgerTransactions.transactionType })
      .from(ledgerTransactions)
      .where(and(
        inArray(ledgerTransactions.referenceId, chunk),
        inArray(ledgerTransactions.transactionType, ["DEBIT_COMMISSION", "DEBIT_FULL_PACKAGE", "DEBIT_PURCHASE_REQUEST", "DEBIT_PACKAGE"]),
      ));
    orderRows.push(...rows.map((r) => ({ ...r, id: Number(r.id), accountId: Number(r.accountId), referenceId: r.referenceId == null ? null : Number(r.referenceId) })));
  }
  for (let i = 0; i < stamped.length; i += 500) {
    const rows = await db
      .select({ id: ledgerTransactions.id, accountId: ledgerTransactions.accountId, transactionNumber: ledgerTransactions.transactionNumber, amountUsd: ledgerTransactions.amountUsd, description: ledgerTransactions.description, referenceId: ledgerTransactions.referenceId, transactionType: ledgerTransactions.transactionType })
      .from(ledgerTransactions)
      .where(inArray(ledgerTransactions.id, stamped.slice(i, i + 500)));
    for (const r of rows) if (!orderRows.some((x) => x.id === Number(r.id))) orderRows.push({ ...r, id: Number(r.id), accountId: Number(r.accountId), referenceId: r.referenceId == null ? null : Number(r.referenceId) });
  }

  const standing = new Map<number, number>();
  const standsAt = async (row: { id: number; accountId: number; transactionNumber: string; amountUsd: string | null }) => {
    if (!standing.has(row.id)) standing.set(row.id, Math.max(0, cents(await effectiveChargeUsd(db, row))));
    return standing.get(row.id)!;
  };

  const orderChargesOf = (order: (typeof orders)[number], accountId: number) =>
    orderRows.filter((r) => {
      if (r.accountId !== accountId) return false;
      if (BOX_LINE.test(String(r.description ?? ""))) return false; // the box's own line is the other side
      if (order.chargeTransactionId && r.id === order.chargeTransactionId) return true;
      if (r.referenceId !== order.id) return false;
      // A package charge under this number is the order's freight only when its text names an order.
      return r.transactionType !== "DEBIT_PACKAGE" || isOrderChargeText(r.description);
    });

  const byCustomer = new Map<number, DoubleChargeLine[]>();
  const used = new Set<number>(); // an order row answers for one box line only
  for (const { row, match } of parsed) {
    const boxChargeUsd = await standsAt({ id: Number(row.id), accountId: Number(row.accountId), transactionNumber: row.transactionNumber, amountUsd: row.amountUsd });
    if (boxChargeUsd <= 0.005) continue;
    const tracking = match[2];
    // The database matches a tracking whatever its case; so must this.
    const mine = orders.filter((o) => trackingKey(o.tracking) === trackingKey(tracking) && o.customerId === row.customerId);
    const charges: DoubleChargeLine["orderCharges"] = [];
    const seenOrders = new Set<number>();
    for (const order of mine) {
      if (seenOrders.has(order.id)) continue;
      seenOrders.add(order.id);
      for (const c of orderChargesOf(order, Number(row.accountId))) {
        if (used.has(c.id)) continue;
        const usd = await standsAt(c);
        if (usd <= 0.005) continue;
        used.add(c.id);
        charges.push({ id: c.id, usd, description: String(c.description ?? ""), orderCode: order.orderCode });
      }
    }
    const orderChargedUsd = cents(charges.reduce((s, c) => s + c.usd, 0));
    const twiceUsd = twiceCharged(boxChargeUsd, orderChargedUsd);
    if (twiceUsd <= 0.005) continue;
    const list = byCustomer.get(Number(row.customerId)) ?? [];
    list.push({ trackingNumber: tracking, boxCode: match[1], boxChargeId: Number(row.id), boxChargeUsd, boxChargedAt: row.createdAt, orderCharges: charges, orderChargedUsd, twiceUsd });
    byCustomer.set(Number(row.customerId), list);
  }
  if (byCustomer.size === 0) return [];

  const ids = Array.from(byCustomer.keys());
  const people = await db
    .select({ id: customers.id, customerCode: customers.customerCode, fullName: customers.fullName, balance: customerAccounts.currentBalanceUsd })
    .from(customers)
    .leftJoin(customerAccounts, eq(customerAccounts.customerId, customers.id))
    .where(inArray(customers.id, ids));

  const out: DoubleChargeCustomer[] = [];
  for (const customerId of ids) {
    const lines = byCustomer.get(customerId)!;
    const who = people.find((p) => Number(p.id) === customerId);
    const twiceUsd = cents(lines.reduce((s, l) => s + l.twiceUsd, 0));
    const balanceUsd = num(who?.balance);
    // Only an account that owes is weighed: the rest have nothing to take off.
    const stillOwedUsd = balanceUsd > 0.005 ? await stillOwedByCustomer(customerId) : 0;
    out.push({ customerId, customerCode: who?.customerCode ?? null, customerName: who?.fullName ?? null, balanceUsd, lines, twiceUsd, stillOwedUsd, falseDebtUsd: falseDebt(twiceUsd, balanceUsd, stillOwedUsd) });
  }
  return out
    .sort((a, b) => b.falseDebtUsd - a.falseDebtUsd || b.twiceUsd - a.twiceUsd);
}

/**
 * What one customer really still owes (shared/boxPaidStillOwed → stillOwed):
 * the charges that stand on goods no receipted box holds. The account's rows,
 * the boxes whose receipt stands, and the orders with every tracking they go
 * by are gathered here; the rule itself is the shared one.
 */
export async function stillOwedByCustomer(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.customerId, customerId)).limit(1);
  if (!account) return 0;

  const ledger = await db
    .select({ id: ledgerTransactions.id, transactionNumber: ledgerTransactions.transactionNumber, transactionType: ledgerTransactions.transactionType, amountUsd: ledgerTransactions.amountUsd, balanceAfterUsd: ledgerTransactions.balanceAfterUsd, description: ledgerTransactions.description, referenceId: ledgerTransactions.referenceId })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, account.id));
  const rows: AccountRow[] = ledger
    .map((r) => ({ id: Number(r.id), transactionNumber: r.transactionNumber, transactionType: String(r.transactionType), amountUsd: num(r.amountUsd), balanceAfterUsd: num(r.balanceAfterUsd), description: String(r.description ?? ""), referenceId: r.referenceId == null ? null : Number(r.referenceId) }))
    .sort((a, b) => a.id - b.id);

  // Everything inside a box whose receipt stands.
  const inBoxes = await db
    .select({ boxCode: deliveryBoxes.boxCode, packageId: deliveryBoxItems.packageId, orderId: deliveryBoxItems.fullPackageOrderId, tracking: packages.trackingNumber, parcelOrderId: packages.fullPackageOrderId })
    .from(boxSettlements)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .leftJoin(deliveryBoxItems, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .leftJoin(packages, eq(packages.id, deliveryBoxItems.packageId))
    .where(and(eq(deliveryBoxes.customerId, customerId), eq(boxSettlements.status, "confirmed")));
  const receiptedBoxCodes = new Set<string>();
  const receiptedPackageIds = new Set<number>();
  const receiptedOrderIds = new Set<number>();
  const receiptedTrackings = new Set<string>();
  for (const b of inBoxes) {
    receiptedBoxCodes.add(b.boxCode);
    if (b.packageId != null) receiptedPackageIds.add(Number(b.packageId));
    if (b.orderId != null) receiptedOrderIds.add(Number(b.orderId));
    if (b.parcelOrderId != null) receiptedOrderIds.add(Number(b.parcelOrderId));
    if (b.tracking) receiptedTrackings.add(trackingKey(b.tracking));
  }
  // A box line is written only by a receipt: the tracking it names was paid,
  // even where the box itself was later deleted and made again.
  for (const r of rows) {
    const line = BOX_LINE.exec(r.description);
    if (line) receiptedTrackings.add(trackingKey(line[2]));
  }

  const own = await db
    .select({ id: fullPackageOrders.id, chargeTransactionId: fullPackageOrders.chargeTransactionId, tracking: fullPackageOrders.trackingNumber })
    .from(fullPackageOrders)
    .where(eq(fullPackageOrders.customerId, customerId));
  const listed = own.length === 0 ? [] : await db
    .select({ orderId: fullPackageOrderTrackings.fullPackageOrderId, tracking: fullPackageOrderTrackings.trackingNumber })
    .from(fullPackageOrderTrackings)
    .innerJoin(fullPackageOrders, eq(fullPackageOrders.id, fullPackageOrderTrackings.fullPackageOrderId))
    .where(eq(fullPackageOrders.customerId, customerId));
  const orders = own.map((o) => ({
    id: Number(o.id),
    chargeTransactionId: o.chargeTransactionId == null ? null : Number(o.chargeTransactionId),
    trackings: [o.tracking, ...listed.filter((l) => Number(l.orderId) === Number(o.id)).map((l) => l.tracking)].filter((t): t is string => !!t),
  }));

  return cents(stillOwed(rows, { receiptedBoxCodes, receiptedPackageIds, receiptedOrderIds, receiptedTrackings, orders, isOrderText: isOrderChargeText }));
}

/**
 * Called after every box receipt: the count is thrown away, so the very next
 * look at the bell asks the question again with that receipt in it. If a
 * receipt ever leaves its own customer owing for what it paid, the main admin
 * is told within the minute rather than a month later on the debtors' list.
 */
export function boxReceiptWritten(): void {
  cacheInvalidate([COUNT_KEY]);
}

/** For the bell: how many customers are shown owing for a box they paid. Kept ten minutes. */
export async function countBoxDoubleCharges(): Promise<number> {
  return cacheGetOrSet(COUNT_KEY, 10 * 60_000, async () => (await findBoxDoubleCharges()).filter((c) => c.falseDebtUsd > 0.5).length);
}

/**
 * Put one customer right. The order-side rows for goods already paid at the
 * box are taken off through the ledger's own corrections — each marked, so
 * the row no longer stands and the same goods can never be found twice again
 * — for exactly the false debt and not a cent more: no credit is made.
 */
export async function correctBoxDoubleCharge(customerId: number, userId: number): Promise<{ removedUsd: number; lines: number; balanceUsd: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [customer] = await findBoxDoubleCharges(customerId);
  if (!customer || customer.falseDebtUsd <= 0.005) {
    throw new Error(withFix("ئەم کڕیارە هیچ قەرزێکی دووجار نووسراوی لەسەر نەماوە.", ["پەڕەکە نوێ بکەوە"]));
  }
  const plan = planCorrection(customer);
  let removedUsd = 0;
  for (const step of plan) {
    const why = doubleChargeReason(step.trackingNumber, step.boxCode);
    if (step.whole) {
      await reverseCharge(step.chargeId, why, userId);
    } else {
      const [row] = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.id, step.chargeId)).limit(1);
      if (!row) continue;
      const stands = await effectiveChargeUsd(db, row);
      await adjustCharge(step.chargeId, cents(stands - step.removeUsd), why, userId);
    }
    removedUsd = cents(removedUsd + step.removeUsd);
  }
  cacheInvalidate([COUNT_KEY]);
  const [after] = await db.select({ balance: customerAccounts.currentBalanceUsd }).from(customerAccounts).where(eq(customerAccounts.customerId, customerId)).limit(1);
  appLogger.info("[BoxDoubleCharge] corrected", { customerId, removedUsd, lines: plan.length, userId });
  return { removedUsd, lines: plan.length, balanceUsd: num(after?.balance) };
}
