import { and, inArray, isNull } from "drizzle-orm";
import { getDb } from "./connection";
import { fullPackageOrders, packageOrderLinks, packages } from "../../drizzle/schema";
import type { ParcelOrderRef } from "@shared/parcelSource";

/**
 * The platform order numbers behind parcels.
 *
 * Owner, 2026-09-17: a buy-at-cost or full-package parcel is checked with the
 * customer by the order number on the shop's platform, so wherever staff see a
 * parcel's tracking, its order number sits beside it.
 *
 * A carton can carry several orders (packageOrderLinks), and one order can be
 * split over several cartons: every number comes back, the parcel's main order
 * first. Orders that were deleted, or never given a number, say nothing.
 * Read-only.
 */

const cleanIds = (ids: readonly (number | null | undefined)[]) =>
  Array.from(new Set(ids.filter((id): id is number => Number.isInteger(id) && (id as number) > 0)));

/** Order ids → their platform order numbers (empty ones left out). */
export async function orderNumbersForOrders(orderIds: readonly (number | null | undefined)[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const ids = cleanIds(orderIds);
  if (ids.length === 0) return out;
  const db = await getDb();
  if (!db) return out;

  const rows = await db
    .select({ id: fullPackageOrders.id, orderNumber: fullPackageOrders.orderNumber })
    .from(fullPackageOrders)
    .where(and(inArray(fullPackageOrders.id, ids), isNull(fullPackageOrders.deletedAt)));
  for (const row of rows) {
    const number = (row.orderNumber ?? "").trim();
    if (number) out.set(row.id, number);
  }
  return out;
}

/**
 * Each line of a box, with its order numbers — for the eye only; nothing here
 * is money. A line is a parcel, an order, or both.
 */
export async function withParcelOrderNumbers<T extends { packageId: number | null; fullPackageOrderId: number | null }>(
  lines: readonly T[],
): Promise<Array<T & { orderNumbers: string[] }>> {
  const [byPackage, byOrder] = await Promise.all([
    orderNumbersForPackages(lines.map((line) => line.packageId)),
    orderNumbersForOrders(lines.map((line) => line.fullPackageOrderId)),
  ]);
  return lines.map((line) => {
    const found: string[] = [];
    const candidates = [...(line.packageId ? byPackage.get(line.packageId) ?? [] : []), line.fullPackageOrderId ? byOrder.get(line.fullPackageOrderId) : undefined];
    for (const number of candidates) if (number && !found.includes(number)) found.push(number);
    return { ...line, orderNumbers: found };
  });
}

/** Parcel ids → the order numbers of every order in them, the main order first. */
export async function orderNumbersForPackages(packageIds: readonly (number | null | undefined)[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const ids = cleanIds(packageIds);
  if (ids.length === 0) return out;
  const db = await getDb();
  if (!db) return out;

  const [mains, links] = await Promise.all([
    db.select({ packageId: packages.id, orderId: packages.fullPackageOrderId }).from(packages).where(inArray(packages.id, ids)),
    db
      .select({ packageId: packageOrderLinks.packageId, orderId: packageOrderLinks.fullPackageOrderId, isPrimary: packageOrderLinks.isPrimary })
      .from(packageOrderLinks)
      .where(inArray(packageOrderLinks.packageId, ids)),
  ]);

  const ordersOf = new Map<number, number[]>();
  const add = (packageId: number, orderId: number | null) => {
    if (!orderId) return;
    const list = ordersOf.get(packageId) ?? [];
    if (!list.includes(orderId)) list.push(orderId);
    ordersOf.set(packageId, list);
  };
  for (const main of mains) add(main.packageId, main.orderId);
  for (const link of [...links].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))) add(link.packageId, link.orderId);

  const allOrderIds: number[] = [];
  ordersOf.forEach((orderIds) => allOrderIds.push(...orderIds));
  const numbers = await orderNumbersForOrders(allOrderIds);
  ordersOf.forEach((orderIds, packageId) => {
    const found: string[] = [];
    for (const id of orderIds) {
      const number = numbers.get(id);
      if (number && !found.includes(number)) found.push(number);
    }
    if (found.length > 0) out.set(packageId, found);
  });
  return out;
}

/**
 * Which order each parcel belongs to — the record a stuck parcel is actually
 * dealt with in (owner, 2026-09-21).
 *
 * The same gathering as the order numbers above: the parcel's own order
 * first, then the orders linked to its carton, the primary one before the
 * rest. What comes back is enough to open the order's page without asking
 * anything else: the id, which kind it is, its code and its platform number.
 * Deleted orders say nothing. Read-only.
 */
export async function orderSourcesForPackages(
  packageIds: readonly (number | null | undefined)[],
): Promise<Map<number, ParcelOrderRef[]>> {
  const out = new Map<number, ParcelOrderRef[]>();
  const ids = cleanIds(packageIds);
  if (ids.length === 0) return out;
  const db = await getDb();
  if (!db) return out;

  const [mains, links] = await Promise.all([
    db.select({ packageId: packages.id, orderId: packages.fullPackageOrderId }).from(packages).where(inArray(packages.id, ids)),
    db
      .select({ packageId: packageOrderLinks.packageId, orderId: packageOrderLinks.fullPackageOrderId, isPrimary: packageOrderLinks.isPrimary })
      .from(packageOrderLinks)
      .where(inArray(packageOrderLinks.packageId, ids)),
  ]);

  const ordersOf = new Map<number, number[]>();
  const add = (packageId: number, orderId: number | null) => {
    if (!orderId) return;
    const list = ordersOf.get(packageId) ?? [];
    if (!list.includes(orderId)) list.push(orderId);
    ordersOf.set(packageId, list);
  };
  for (const main of mains) add(main.packageId, main.orderId);
  for (const link of [...links].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))) add(link.packageId, link.orderId);

  const allOrderIds: number[] = [];
  ordersOf.forEach((orderIds) => allOrderIds.push(...orderIds));
  if (allOrderIds.length === 0) return out;

  const rows = await db
    .select({
      id: fullPackageOrders.id,
      orderType: fullPackageOrders.orderType,
      orderCode: fullPackageOrders.orderCode,
      orderNumber: fullPackageOrders.orderNumber,
    })
    .from(fullPackageOrders)
    .where(and(inArray(fullPackageOrders.id, cleanIds(allOrderIds)), isNull(fullPackageOrders.deletedAt)));
  const byId = new Map(rows.map((row) => [row.id, row]));

  ordersOf.forEach((orderIds, packageId) => {
    const found: ParcelOrderRef[] = [];
    for (const id of orderIds) {
      const row = byId.get(id);
      if (!row) continue;
      found.push({
        orderId: row.id,
        orderType: (row.orderType ?? "full_package") as ParcelOrderRef["orderType"],
        orderCode: row.orderCode ?? null,
        orderNumber: (row.orderNumber ?? "").trim() || null,
      });
    }
    if (found.length > 0) out.set(packageId, found);
  });
  return out;
}
