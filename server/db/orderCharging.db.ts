import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { getDb } from "./connection";
import {
  customers,
  deliveryBoxes,
  deliveryBoxItems,
  fullPackageOrders,
  fullPackageOrderTrackings,
  packages,
} from "../../drizzle/schema";
import { appLogger } from "../utils/logger";

/**
 * The goods a customer already has, put on their account.
 *
 * An order bought for a customer — کڕین بە تێچوو or پاکێجی تەواو — is a debt
 * from the moment it is entered (fullPackage.db chargeOrderAtCreation, the
 * owner's rule of 2026-09-15). That covers every order typed in since. It
 * does not cover the ones typed in before it, and it cannot cover an entry
 * whose charge failed, because that path deliberately never throws.
 *
 * For those, there was no second door. An order that travels as a *parcel*
 * in a batch — the box item carries `packageId`, not `fullPackageOrderId` —
 * slipped past all four:
 *
 *  • batch pricing charges shipping for self-order parcels only, because an
 *    order is billed through its own invoice (batchCharging.db);
 *  • marking the box delivered updates orders reached through
 *    `fullPackageOrderId`, and a parcel-shaped carton has none
 *    (lib/boxLifecycle markBoxContentsDelivered);
 *  • the receipt refuses to charge an order carton, because the order flow
 *    is supposed to have done it (boxSettlement.db);
 *  • and the order's own delivery charge fires on the ORDER's status, which
 *    nothing moved.
 *
 * Every one of those four is right on its own. Together they left a customer
 * holding $211 of goods with nothing on their account — and then a receipt
 * for the box posted the payment and the discount as credits against a debt
 * that was never there, which is how an account ends up owing the customer
 * money for goods they were given.
 *
 * So this is the fifth door, and it is the one the owner named, 2026-09-26:
 * the invoice exists when the tracking goes into the box, and when the batch
 * is delivered. Both call the same thing, it is idempotent through
 * `isCharged` / `chargeTransactionId`, and it charges through the identical
 * path an order entered today takes — so nothing can be billed twice, and
 * the amount is the one rule there has ever been.
 */

/** A tracking, as it is written on a parcel and on an order. */
const clean = (t: string | null | undefined): string => String(t ?? "").trim();

/**
 * Charge every order that arrived on these trackings and has never been
 * billed. Returns what it did, and never throws: an order that cannot be
 * charged is one the office can still see and fix, while a refusal here
 * would stop a parcel going into a box.
 */
export async function chargeOrdersBehindTrackings(
  trackingNumbers: Array<string | null | undefined>,
  userId: number,
): Promise<{ charged: number; amountUsd: number }> {
  const trackings = Array.from(new Set(trackingNumbers.map(clean).filter(Boolean)));
  if (trackings.length === 0) return { charged: 0, amountUsd: 0 };

  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0 };

  try {
    // An order names its tracking in one of two places: on the order itself,
    // or in its list of trackings when it arrived in several pieces.
    const [direct, viaList] = await Promise.all([
      db
        .select({ id: fullPackageOrders.id })
        .from(fullPackageOrders)
        .where(inArray(fullPackageOrders.trackingNumber, trackings)),
      db
        .select({ id: fullPackageOrderTrackings.fullPackageOrderId })
        .from(fullPackageOrderTrackings)
        .where(inArray(fullPackageOrderTrackings.trackingNumber, trackings)),
    ]);

    const ids = Array.from(new Set([...direct, ...viaList].map((r) => Number(r.id)).filter(Boolean)));
    if (ids.length === 0) return { charged: 0, amountUsd: 0 };

    /*
     * Only what has never been billed, and only what can be: a quote is not
     * a debt until it is approved, and a deleted order is not a debt at all.
     * `chargeOrderAtCreation` checks the same things again — this is here so
     * the common case costs one query and no work.
     */
    const rows = await db
      .select()
      .from(fullPackageOrders)
      .where(and(
        inArray(fullPackageOrders.id, ids),
        eq(fullPackageOrders.isCharged, false),
        isNull(fullPackageOrders.chargeTransactionId),
        isNull(fullPackageOrders.deletedAt),
      ));

    let charged = 0;
    let amountUsd = 0;
    // Imported here, not at the top: fullPackage.db is a large module that
    // reaches back into this side of the graph, and a cycle between them
    // surfaces as an unrelated "not a function" at runtime.
    const { chargeOrderAtCreation } = await import("./fullPackage.db");
    for (const order of rows) {
      const result = await chargeOrderAtCreation(order as never, userId);
      if (result.charged) {
        charged += 1;
        amountUsd = Math.round((amountUsd + result.amount) * 100) / 100;
      }
    }
    if (charged > 0) {
      appLogger.info("[OrderCharge] billed orders that travelled as parcels", {
        trackings: trackings.length, charged, amountUsd,
      });
    }
    return { charged, amountUsd };
  } catch (e) {
    appLogger.error("[OrderCharge] failed to bill orders behind parcels", {
      trackings: trackings.length,
      error: e instanceof Error ? e.message : String(e),
    });
    return { charged: 0, amountUsd: 0 };
  }
}

/**
 * The moment a tracking is in the box.
 *
 * The goods are in front of the customer; the account must already know what
 * they cost. Called from every door that puts items in a box.
 */
export async function chargeOrdersInBox(
  boxId: number,
  userId: number,
): Promise<{ charged: number; amountUsd: number }> {
  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0 };
  const items = await db
    .select({
      trackingNumber: deliveryBoxItems.trackingNumber,
      orderId: deliveryBoxItems.fullPackageOrderId,
    })
    .from(deliveryBoxItems)
    .where(eq(deliveryBoxItems.boxId, boxId));
  if (items.length === 0) return { charged: 0, amountUsd: 0 };

  const byTracking = await chargeOrdersBehindTrackings(items.map((i) => i.trackingNumber), userId);

  // A carton that names its order outright does not need the tracking at all.
  const named = Array.from(new Set(items.map((i) => Number(i.orderId)).filter(Boolean)));
  if (named.length === 0) return byTracking;

  const rows = await db
    .select()
    .from(fullPackageOrders)
    .where(and(
      inArray(fullPackageOrders.id, named),
      eq(fullPackageOrders.isCharged, false),
      isNull(fullPackageOrders.chargeTransactionId),
      isNull(fullPackageOrders.deletedAt),
    ));
  if (rows.length === 0) return byTracking;

  const { chargeOrderAtCreation } = await import("./fullPackage.db");
  let charged = byTracking.charged;
  let amountUsd = byTracking.amountUsd;
  for (const order of rows) {
    const result = await chargeOrderAtCreation(order as never, userId);
    if (result.charged) {
      charged += 1;
      amountUsd = Math.round((amountUsd + result.amount) * 100) / 100;
    }
  }
  return { charged, amountUsd };
}

/**
 * The moment the batch is delivered.
 *
 * The safety net for everything that reached Erbil without passing a box —
 * and for boxes built before this door existed. Same idempotent charge.
 */
export async function chargeOrdersInBatch(
  batchId: number,
  userId: number,
): Promise<{ charged: number; amountUsd: number }> {
  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0 };
  const rows = await db
    .select({ trackingNumber: packages.trackingNumber })
    .from(packages)
    .where(eq(packages.batchId, batchId));
  return chargeOrdersBehindTrackings(rows.map((r) => r.trackingNumber), userId);
}

/** Where the goods already are, which is why the debt is certain. */
export type UnbilledWhere = "box" | "delivered" | "order_delivered";

export interface UnbilledOrder {
  orderId: number;
  orderCode: string;
  orderType: string;
  productName: string | null;
  customerId: number;
  customerCode: string;
  customerName: string;
  amountUsd: number;
  where: UnbilledWhere;
  boxCode: string | null;
  trackingNumber: string | null;
  createdAt: Date | string | null;
}

/**
 * The ones the doors were built too late for.
 *
 * Read only. It answers one question and no other: which goods has a
 * customer already been given, that their account has never been told about?
 *
 * "Already been given" is deliberately narrow — the order is in a delivery
 * box, or its parcel is marked delivered, or the order itself is. Goods still
 * in China are not billed here whatever their age: charging at entry is the
 * rule going forward (fullPackage.db chargeOrderAtCreation), and reaching
 * back to bill things that have not arrived would be a second, quieter rule.
 *
 * Nothing moves because this was opened. Billing is a separate decision with
 * its own button — the owner's, not a screen's.
 */
export async function findUnbilledArrivedOrders(): Promise<UnbilledOrder[]> {
  const db = await getDb();
  if (!db) return [];

  const candidates = await db
    .select({
      id: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      productName: fullPackageOrders.productName,
      status: fullPackageOrders.status,
      trackingNumber: fullPackageOrders.trackingNumber,
      quantity: fullPackageOrders.quantity,
      sellingPriceUsd: fullPackageOrders.sellingPriceUsd,
      itemPriceUsd: fullPackageOrders.itemPriceUsd,
      commissionFeeUsd: fullPackageOrders.commissionFeeUsd,
      customerId: fullPackageOrders.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      createdAt: fullPackageOrders.createdAt,
    })
    .from(fullPackageOrders)
    .innerJoin(customers, eq(customers.id, fullPackageOrders.customerId))
    .where(and(
      eq(fullPackageOrders.isCharged, false),
      isNull(fullPackageOrders.chargeTransactionId),
      isNull(fullPackageOrders.deletedAt),
      // A quote is not a debt until the customer approves it.
      ne(fullPackageOrders.orderType, "purchase_request"),
    ));
  if (candidates.length === 0) return [];

  const ids = candidates.map((o) => Number(o.id));

  // Every tracking an order arrived on: its own, and the list for an order
  // that came in several pieces.
  const extra = await db
    .select({
      orderId: fullPackageOrderTrackings.fullPackageOrderId,
      trackingNumber: fullPackageOrderTrackings.trackingNumber,
    })
    .from(fullPackageOrderTrackings)
    .where(inArray(fullPackageOrderTrackings.fullPackageOrderId, ids));

  const trackingsOf = new Map<number, string[]>();
  const add = (orderId: number, tracking: string | null | undefined) => {
    const t = clean(tracking);
    if (!t) return;
    const list = trackingsOf.get(orderId) ?? [];
    if (!list.includes(t)) list.push(t);
    trackingsOf.set(orderId, list);
  };
  for (const o of candidates) add(Number(o.id), o.trackingNumber);
  for (const r of extra) add(Number(r.orderId), r.trackingNumber);

  const allTrackings = Array.from(new Set(Array.from(trackingsOf.values()).flat()));

  // In a box, or marked delivered: either way the customer has the goods.
  const inBox = allTrackings.length
    ? await db
        .select({
          trackingNumber: deliveryBoxItems.trackingNumber,
          boxCode: deliveryBoxes.boxCode,
        })
        .from(deliveryBoxItems)
        .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
        .where(inArray(deliveryBoxItems.trackingNumber, allTrackings))
    : [];
  const boxOf = new Map(inBox.map((r) => [clean(r.trackingNumber), r.boxCode]));

  const arrived = allTrackings.length
    ? await db
        .select({ trackingNumber: packages.trackingNumber, status: packages.status })
        .from(packages)
        .where(and(
          inArray(packages.trackingNumber, allTrackings),
          eq(packages.status, "delivered"),
        ))
    : [];
  const deliveredTrackings = new Set(arrived.map((r) => clean(r.trackingNumber)));

  const { computeOrderChargeAmount } = await import("./fullPackage.db");

  const rows: UnbilledOrder[] = [];
  for (const o of candidates) {
    const orderId = Number(o.id);
    const trackings = trackingsOf.get(orderId) ?? [];
    const boxTracking = trackings.find((t) => boxOf.has(t));
    const deliveredTracking = trackings.find((t) => deliveredTrackings.has(t));

    let where: UnbilledWhere | null = null;
    if (boxTracking) where = "box";
    else if (deliveredTracking) where = "delivered";
    else if (String(o.status) === "delivered") where = "order_delivered";
    if (!where) continue;

    const amountUsd = computeOrderChargeAmount(o as never);
    if (!(amountUsd > 0)) continue;

    rows.push({
      orderId,
      orderCode: String(o.orderCode ?? ""),
      orderType: String(o.orderType ?? ""),
      productName: o.productName ?? null,
      customerId: Number(o.customerId),
      customerCode: String(o.customerCode ?? ""),
      customerName: String(o.customerName ?? ""),
      amountUsd: Math.round(amountUsd * 100) / 100,
      where,
      boxCode: boxTracking ? (boxOf.get(boxTracking) ?? null) : null,
      trackingNumber: boxTracking ?? deliveredTracking ?? trackings[0] ?? null,
      createdAt: o.createdAt ?? null,
    });
  }

  // Oldest first: the debt that has been missing longest is the one to look
  // at, and it is the one a customer is most likely to argue about.
  rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  return rows;
}

/**
 * Put them on the accounts — only the ones named, one at a time.
 *
 * Through the same charge as everything else, so the amount is the one rule
 * and an order that somebody billed in the meantime is skipped rather than
 * billed twice. What it could not do is reported back by order code, because
 * a repair that silently half-finished is worse than one that did nothing.
 */
export async function billUnbilledOrders(
  orderIds: number[],
  userId: number,
): Promise<{ charged: number; amountUsd: number; skipped: Array<{ orderCode: string; reason: string }> }> {
  const ids = Array.from(new Set(orderIds.map(Number).filter(Boolean)));
  const skipped: Array<{ orderCode: string; reason: string }> = [];
  if (ids.length === 0) return { charged: 0, amountUsd: 0, skipped };

  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0, skipped };

  const rows = await db
    .select()
    .from(fullPackageOrders)
    .where(and(
      inArray(fullPackageOrders.id, ids),
      eq(fullPackageOrders.isCharged, false),
      isNull(fullPackageOrders.chargeTransactionId),
      isNull(fullPackageOrders.deletedAt),
    ));

  const { chargeOrderAtCreation } = await import("./fullPackage.db");
  let charged = 0;
  let amountUsd = 0;
  for (const order of rows) {
    const result = await chargeOrderAtCreation(order as never, userId);
    if (result.charged) {
      charged += 1;
      amountUsd = Math.round((amountUsd + result.amount) * 100) / 100;
    } else {
      skipped.push({ orderCode: String(order.orderCode ?? order.id), reason: result.reason ?? "unknown" });
    }
  }
  appLogger.info("[OrderCharge] repair run", { asked: ids.length, charged, amountUsd, skipped: skipped.length });
  return { charged, amountUsd, skipped };
}
