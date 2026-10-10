import { and, eq, inArray, like, ne, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { boxSettlements, customerAccounts, deliveryBoxItems, deliveryBoxes, fullPackageOrders, fullPackageOrderTrackings, ledgerTransactions, packages } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { isOrderChargeText } from "@shared/batchCleanup";
import { withFix } from "@shared/fixAdvice";
import {
  OWED_VERDICTS,
  accountSums,
  chargeStory,
  doubleChargeReason,
  explainDebt,
  falseDebt,
  planCorrection,
  stillOwed,
  trackingKey,
  twiceCharged,
  type AccountRow,
  type AccountSums,
  type ChargeVerdict,
  type DoubleChargeCustomer,
  type DoubleChargeLine,
  type StoryLine,
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
 * Everything the shared rule needs to explain one account: its ledger rows,
 * the boxes whose receipt stands and those still waiting for one, and the
 * orders with every tracking they go by. Read only.
 */
async function gatherAccount(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  const [account] = await db.select({ id: customerAccounts.id, balance: customerAccounts.currentBalanceUsd }).from(customerAccounts).where(eq(customerAccounts.customerId, customerId)).limit(1);
  if (!account) return null;

  const ledger = await db
    .select({ id: ledgerTransactions.id, transactionNumber: ledgerTransactions.transactionNumber, transactionType: ledgerTransactions.transactionType, amountUsd: ledgerTransactions.amountUsd, balanceAfterUsd: ledgerTransactions.balanceAfterUsd, description: ledgerTransactions.description, referenceId: ledgerTransactions.referenceId, createdAt: ledgerTransactions.createdAt })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, account.id));
  const rows: Array<AccountRow & { createdAt: string | null }> = ledger
    .map((r) => ({ createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null, id: Number(r.id), transactionNumber: r.transactionNumber, transactionType: String(r.transactionType), amountUsd: num(r.amountUsd), balanceAfterUsd: num(r.balanceAfterUsd), description: String(r.description ?? ""), referenceId: r.referenceId == null ? null : Number(r.referenceId) }))
    .sort((a, b) => a.id - b.id);

  // Every live box of the customer, each thing inside it, and whether a receipt stands.
  const boxRows = await db
    .select({ boxId: deliveryBoxes.id, boxCode: deliveryBoxes.boxCode, packageId: deliveryBoxItems.packageId, orderId: deliveryBoxItems.fullPackageOrderId, tracking: packages.trackingNumber, parcelOrderId: packages.fullPackageOrderId })
    .from(deliveryBoxes)
    .leftJoin(deliveryBoxItems, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .leftJoin(packages, eq(packages.id, deliveryBoxItems.packageId))
    .where(and(eq(deliveryBoxes.customerId, customerId), ne(deliveryBoxes.status, "cancelled")));
  const receiptRows = await db
    .select({ boxId: boxSettlements.boxId })
    .from(boxSettlements)
    .where(and(eq(boxSettlements.customerId, customerId), eq(boxSettlements.status, "confirmed")));
  const receiptedBoxIds = new Set(receiptRows.map((r) => Number(r.boxId)));

  const receiptedBoxCodes = new Set<string>();
  const receiptedPackageIds = new Set<number>();
  const receiptedOrderIds = new Set<number>();
  const receiptedTrackings = new Set<string>();
  const openPackageIds = new Set<number>();
  const openOrderIds = new Set<number>();
  const openTrackings = new Set<string>();
  /** Where a thing sits: the box that holds it, a receipted one winning. */
  const boxOf = new Map<string, { boxId: number; boxCode: string; receipted: boolean }>();
  const boxByCode = new Map<string, number>();
  const place = (key: string, box: { boxId: number; boxCode: string; receipted: boolean }) => {
    const had = boxOf.get(key);
    if (!had || (box.receipted && !had.receipted)) boxOf.set(key, box);
  };
  for (const b of boxRows) {
    const receipted = receiptedBoxIds.has(Number(b.boxId));
    const box = { boxId: Number(b.boxId), boxCode: b.boxCode, receipted };
    boxByCode.set(b.boxCode, box.boxId);
    if (receipted) receiptedBoxCodes.add(b.boxCode);
    const P = receipted ? receiptedPackageIds : openPackageIds;
    const O = receipted ? receiptedOrderIds : openOrderIds;
    const T = receipted ? receiptedTrackings : openTrackings;
    if (b.packageId != null) { P.add(Number(b.packageId)); place(`p${b.packageId}`, box); }
    if (b.orderId != null) { O.add(Number(b.orderId)); place(`o${b.orderId}`, box); }
    if (b.parcelOrderId != null) { O.add(Number(b.parcelOrderId)); place(`o${b.parcelOrderId}`, box); }
    if (b.tracking) { T.add(trackingKey(b.tracking)); place(`t${trackingKey(b.tracking)}`, box); }
  }
  // A box line is written only by a receipt: the tracking it names was paid,
  // even where the box itself was later deleted and made again.
  for (const r of rows) {
    const line = BOX_LINE.exec(r.description);
    if (line) receiptedTrackings.add(trackingKey(line[2]));
  }

  const own = await db
    .select({
      id: fullPackageOrders.id, chargeTransactionId: fullPackageOrders.chargeTransactionId, tracking: fullPackageOrders.trackingNumber,
      status: fullPackageOrders.status, orderType: fullPackageOrders.orderType, orderCode: fullPackageOrders.orderCode,
      orderNumber: fullPackageOrders.orderNumber, productName: fullPackageOrders.productName,
      hasImage: sql<number>`(${fullPackageOrders.productImage} IS NOT NULL AND ${fullPackageOrders.productImage} <> '')`,
    })
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
    status: String(o.status ?? ""),
    orderType: String(o.orderType ?? ""),
    orderCode: o.orderCode,
    orderNumber: (o.orderNumber ?? "").trim() || null,
    productName: o.productName,
    hasImage: Boolean(Number(o.hasImage)),
  }));

  const parcels = await db
    .select({ id: packages.id, tracking: packages.trackingNumber, description: packages.description })
    .from(packages)
    .where(eq(packages.customerId, customerId));

  const facts = { receiptedBoxCodes, receiptedPackageIds, receiptedOrderIds, receiptedTrackings, openPackageIds, openOrderIds, openTrackings, orders, isOrderText: isOrderChargeText };
  return { accountId: Number(account.id), balanceUsd: num(account.balance), rows, facts, orders, parcels, boxOf, boxByCode };
}

/** What one customer really still owes (shared/boxPaidStillOwed → stillOwed). */
export async function stillOwedByCustomer(customerId: number): Promise<number> {
  const got = await gatherAccount(customerId);
  return got ? cents(stillOwed(got.rows, got.facts)) : 0;
}

/** What a ledger row is about: the goods, where they are, and the door to them. */
export interface LedgerSubject {
  verdict: ChargeVerdict | null;
  orderId: number | null;
  orderType: string | null;
  orderCode: string | null;
  orderNumber: string | null;
  productName: string | null;
  hasImage: boolean;
  orderStatus: string | null;
  packageId: number | null;
  tracking: string | null;
  boxId: number | null;
  boxCode: string | null;
}

export interface OwedItem extends LedgerSubject {
  key: string;
  usd: number;
  chargeIds: number[];
  /** The rows of the account this amount was added up from (shared chargeStory). */
  story: StoryLine[];
}

/** One tracking written on the account twice, for the card's own list. */
export interface DoubleLine {
  tracking: string;
  boxCode: string | null;
  boxId: number | null;
  boxChargeUsd: number;
  boxChargedAt: string | null;
  orderCharges: Array<{ id: number; usd: number; description: string; orderCode: string | null }>;
  orderChargedUsd: number;
  twiceUsd: number;
}

/**
 * The customer's debt, explained — for the finance profile.
 *
 * Owner, 2026-10-08: "the profile is very confused. A transaction's detail
 * has no tracking, no platform order number, no photo of the order, no link
 * to it." So every ledger row is given its subject here, and the debt is
 * broken into the four places goods can be: on the road, arrived and not
 * boxed, in a box not receipted, and the customer's own parcels waiting for
 * a box. The verdicts are the shared rule's; nothing is decided here.
 */
export async function explainCustomerDebt(customerId: number): Promise<{
  balanceUsd: number;
  stillOwedUsd: number;
  /** Shown as owed but not owed: what the correction page would take off. */
  falseDebtUsd: number;
  /** On the account, and neither goods still owed nor a double charge. */
  unexplainedUsd: number;
  owedUsd: Record<"road" | "arrived" | "openBox" | "parcel", number>;
  paidOnAccountUsd: number;
  items: OwedItem[];
  subjects: Record<number, LedgerSubject>;
  /** The lines behind "written twice", and what they come to before the cap. */
  double: { lines: DoubleLine[]; twiceUsd: number };
  /** The whole account in five sums that make the balance. */
  sums: AccountSums;
}> {
  const empty = { balanceUsd: 0, stillOwedUsd: 0, falseDebtUsd: 0, unexplainedUsd: 0, owedUsd: { road: 0, arrived: 0, openBox: 0, parcel: 0 }, paidOnAccountUsd: 0, items: [], subjects: {}, double: { lines: [], twiceUsd: 0 }, sums: accountSums([], 0) };
  const got = await gatherAccount(customerId);
  if (!got) return empty;
  const explained = explainDebt(got.rows, got.facts);

  const orderById = new Map(got.orders.map((o) => [o.id, o]));
  const orderByTracking = new Map<string, (typeof got.orders)[number]>();
  for (const o of got.orders) for (const t of o.trackings) if (!orderByTracking.has(trackingKey(t))) orderByTracking.set(trackingKey(t), o);
  const parcelById = new Map(got.parcels.map((p) => [Number(p.id), p]));

  const subjectOf = (c: { orderId: number | null; packageId: number | null; boxCode: string | null; tracking: string | null }, verdict: ChargeVerdict | null): LedgerSubject => {
    const parcel = c.packageId != null ? parcelById.get(c.packageId) : undefined;
    const tracking = c.tracking ?? parcel?.tracking ?? null;
    const order = (c.orderId != null ? orderById.get(c.orderId) : undefined) ?? (tracking ? orderByTracking.get(trackingKey(tracking)) : undefined);
    const shownTracking = tracking ?? order?.trackings[0] ?? null;
    const box =
      (c.packageId != null ? got.boxOf.get(`p${c.packageId}`) : undefined) ??
      (order ? got.boxOf.get(`o${order.id}`) : undefined) ??
      (shownTracking ? got.boxOf.get(`t${trackingKey(shownTracking)}`) : undefined);
    const boxCode = c.boxCode ?? box?.boxCode ?? null;
    return {
      verdict,
      orderId: order?.id ?? null,
      orderType: order?.orderType ?? null,
      orderCode: order?.orderCode ?? null,
      orderNumber: order?.orderNumber ?? null,
      productName: order?.productName ?? parcel?.description ?? null,
      hasImage: order?.hasImage ?? false,
      orderStatus: order?.status ?? null,
      packageId: c.packageId,
      tracking: shownTracking,
      boxId: (boxCode ? got.boxByCode.get(boxCode) : undefined) ?? box?.boxId ?? null,
      boxCode,
    };
  };

  const subjects: Record<number, LedgerSubject> = {};
  const items = new Map<string, OwedItem>();
  for (const c of explained.charges) {
    const subject = subjectOf(c, c.verdict);
    subjects[c.id] = subject;
    if (!(OWED_VERDICTS as readonly string[]).includes(c.verdict)) continue;
    const key = subject.orderId != null ? `o${subject.orderId}` : c.packageId != null ? `p${c.packageId}` : `r${c.id}`;
    const item = items.get(key) ?? { ...subject, key, usd: 0, chargeIds: [], story: [] };
    item.usd = cents(item.usd + c.standsUsd);
    item.chargeIds.push(c.id);
    items.set(key, item);
  }
  // A payment or a correction that names a box opens that box.
  for (const r of got.rows) {
    if (subjects[r.id]) continue;
    const named = /(BOX-\d{8}-\d+)/.exec(r.description);
    if (named) subjects[r.id] = subjectOf({ orderId: null, packageId: null, boxCode: named[1], tracking: null }, null);
  }

  const stillOwedUsd = cents(explained.stillOwedUsd);
  const [double] = got.balanceUsd > 0.005 ? await findBoxDoubleCharges(customerId) : [];
  const falseDebtUsd = double?.falseDebtUsd ?? 0;
  return {
    balanceUsd: got.balanceUsd,
    stillOwedUsd,
    falseDebtUsd,
    unexplainedUsd: cents(got.balanceUsd - stillOwedUsd - falseDebtUsd),
    owedUsd: explained.owedUsd,
    paidOnAccountUsd: explained.paidOnAccountUsd,
    items: Array.from(items.values())
      .map((item) => ({ ...item, story: chargeStory(got.rows, item.chargeIds) }))
      .sort((a, b) => b.usd - a.usd),
    subjects,
    double: {
      twiceUsd: double?.twiceUsd ?? 0,
      lines: (double?.lines ?? []).map((l) => ({
        tracking: l.trackingNumber,
        boxCode: l.boxCode,
        boxId: (l.boxCode ? got.boxByCode.get(l.boxCode) : undefined) ?? null,
        boxChargeUsd: l.boxChargeUsd,
        boxChargedAt: l.boxChargedAt ? new Date(l.boxChargedAt).toISOString() : null,
        orderCharges: l.orderCharges,
        orderChargedUsd: l.orderChargedUsd,
        twiceUsd: l.twiceUsd,
      })),
    },
    sums: accountSums(got.rows, got.balanceUsd),
  };
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
