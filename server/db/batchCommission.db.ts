import { inArray, or } from "drizzle-orm";
import { getDb } from "./connection";
import { fullPackageOrders, fullPackageOrderTrackings, packages } from "../../drizzle/schema";
import { isLiveSale, orderProfitUsd } from "@shared/orderProfit";

/**
 * The commission each customer earned the company on their orders that came
 * in one batch (owner, 2026-11-13: the batch report's «Commission» beside the
 * freight profit, and the two together).
 *
 * The rule is the one every profit report uses (shared/orderProfit): a
 * commission order earns its fee × quantity; an order that is not a sale
 * (cancelled, refunded, a quote, deleted) earns nothing.
 *
 * Commission orders only. A full-package order's margin already carries its
 * own carriage, which the batch's freight figure counts again, so it is left
 * to the profit report rather than counted twice here.
 *
 * Each order is counted in one batch only: the batch of its first parcel
 * (the lowest parcel id). An order split over two flights is not counted
 * twice, and an order whose first carton came earlier belongs to that batch.
 * Orders reach a parcel by link (packages.fullPackageOrderId) or by tracking
 * (fullPackageOrderTrackings, or the order's own trackingNumber); several
 * orders may share one carton, so every order on a tracking is read.
 */
export async function commissionByCustomer(
  batchId: number,
  parcels: ReadonlyArray<{ id: number; customerId: number | null; trackingNumber: string | null; fullPackageOrderId: number | null }>,
): Promise<Map<number, { commissionUsd: number; orders: number }>> {
  const out = new Map<number, { commissionUsd: number; orders: number }>();
  const db = await getDb();
  if (!db || parcels.length === 0) return out;

  const trackings = Array.from(new Set(parcels.map((p) => p.trackingNumber).filter((t): t is string => Boolean(t))));
  const linked = Array.from(new Set(parcels.map((p) => p.fullPackageOrderId).filter((id): id is number => Boolean(id))));

  // Every order behind this batch's parcels.
  const orderIds = new Set<number>(linked);
  if (trackings.length > 0) {
    const viaTable = await db.select({ id: fullPackageOrderTrackings.fullPackageOrderId })
      .from(fullPackageOrderTrackings).where(inArray(fullPackageOrderTrackings.trackingNumber, trackings));
    for (const r of viaTable) if (r.id) orderIds.add(Number(r.id));
    const legacy = await db.select({ id: fullPackageOrders.id })
      .from(fullPackageOrders).where(inArray(fullPackageOrders.trackingNumber, trackings));
    for (const r of legacy) orderIds.add(Number(r.id));
  }
  if (orderIds.size === 0) return out;

  const orders = (await db.select({
    id: fullPackageOrders.id,
    customerId: fullPackageOrders.customerId,
    orderType: fullPackageOrders.orderType,
    status: fullPackageOrders.status,
    deletedAt: fullPackageOrders.deletedAt,
    quantity: fullPackageOrders.quantity,
    commissionFeeUsd: fullPackageOrders.commissionFeeUsd,
    trackingNumber: fullPackageOrders.trackingNumber,
  }).from(fullPackageOrders).where(inArray(fullPackageOrders.id, Array.from(orderIds))))
    .filter((o) => o.orderType === "commission" && isLiveSale(o));
  if (orders.length === 0) return out;

  // Each order's trackings, to find all its parcels in every batch.
  const ids = orders.map((o) => o.id);
  const trackOf = new Map<number, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  for (const o of orders) if (o.trackingNumber) trackOf.get(o.id)!.add(o.trackingNumber);
  const rows = await db.select({ id: fullPackageOrderTrackings.fullPackageOrderId, t: fullPackageOrderTrackings.trackingNumber })
    .from(fullPackageOrderTrackings).where(inArray(fullPackageOrderTrackings.fullPackageOrderId, ids));
  for (const r of rows) if (r.id && r.t) trackOf.get(Number(r.id))?.add(r.t);
  const allTrackings = Array.from(new Set(Array.from(trackOf.values()).flatMap((s) => Array.from(s))));

  const theirParcels = await db.select({ id: packages.id, batchId: packages.batchId, fullPackageOrderId: packages.fullPackageOrderId, trackingNumber: packages.trackingNumber })
    .from(packages)
    .where(allTrackings.length > 0
      ? or(inArray(packages.fullPackageOrderId, ids), inArray(packages.trackingNumber, allTrackings))
      : inArray(packages.fullPackageOrderId, ids));

  for (const o of orders) {
    const mine = theirParcels
      .filter((p) => p.batchId != null && (p.fullPackageOrderId === o.id || (p.trackingNumber != null && trackOf.get(o.id)!.has(p.trackingNumber))))
      .sort((a, b) => a.id - b.id);
    if (mine.length === 0 || mine[0].batchId !== batchId) continue;
    const profit = orderProfitUsd(o);
    const was = out.get(o.customerId) ?? { commissionUsd: 0, orders: 0 };
    out.set(o.customerId, { commissionUsd: Math.round((was.commissionUsd + profit) * 100) / 100, orders: was.orders + 1 });
  }
  return out;
}
