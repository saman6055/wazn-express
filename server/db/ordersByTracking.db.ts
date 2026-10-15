import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { fullPackageOrders, fullPackageOrderTrackings, packages } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { computeOrderChargeAmount } from "./fullPackage.db";

/**
 * The orders that carry a tracking no parcel was ever registered under.
 *
 * Owner, 2026-10-15, searching the parcels list for YT7602474897157 and
 * finding nothing: "why does the system not show it? I want to look into
 * each tracking's state one by one." The tracking belonged to an order
 * entered six months earlier whose carton never reached the warehouse - so
 * there was no parcel to list, and the list said only "no parcels". The
 * answer was in the order all along; this finds it.
 *
 * Exact match on the tracking, whatever its case, in both places an order
 * can record one. Read only, a handful of columns, never a picture.
 */
export interface OrderOnTracking {
  orderId: number;
  orderCode: string;
  orderType: string;
  status: string;
  customerCode: string | null;
  customerName: string | null;
  orderNumber: string | null;
  productName: string | null;
  sellUsd: number;
  isCharged: boolean;
  createdAt: Date | string | null;
  /** A parcel under this tracking exists after all (the list hid it by a filter). */
  parcelRegistered: boolean;
}

export async function findOrdersByTracking(tracking: string): Promise<OrderOnTracking[]> {
  const term = tracking.trim();
  if (term.length < 4) return [];
  const db = await getDb();
  if (!db) return [];

  const listed = await db
    .select({ orderId: fullPackageOrderTrackings.fullPackageOrderId })
    .from(fullPackageOrderTrackings)
    .where(sql`LOWER(${fullPackageOrderTrackings.trackingNumber}) = LOWER(${term})`)
    .limit(20);
  const ids = listed.map((r) => Number(r.orderId));

  const rows = await db
    .select({
      orderId: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      status: fullPackageOrders.status,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      orderNumber: fullPackageOrders.orderNumber,
      productName: fullPackageOrders.productName,
      sellingPriceUsd: fullPackageOrders.sellingPriceUsd,
      itemPriceUsd: fullPackageOrders.itemPriceUsd,
      commissionFeeUsd: fullPackageOrders.commissionFeeUsd,
      quantity: fullPackageOrders.quantity,
      isCharged: fullPackageOrders.isCharged,
      createdAt: fullPackageOrders.createdAt,
    })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(customers.id, fullPackageOrders.customerId))
    .where(and(
      isNull(fullPackageOrders.deletedAt),
      or(
        sql`LOWER(${fullPackageOrders.trackingNumber}) = LOWER(${term})`,
        ids.length > 0 ? inArray(fullPackageOrders.id, ids) : sql`1 = 0`,
      ),
    ))
    .limit(20);
  if (rows.length === 0) return [];

  const [parcel] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(sql`LOWER(${packages.trackingNumber}) = LOWER(${term})`)
    .limit(1);

  return rows.map((r) => ({
    orderId: Number(r.orderId),
    orderCode: r.orderCode,
    orderType: String(r.orderType ?? ""),
    status: String(r.status ?? ""),
    customerCode: r.customerCode ?? null,
    customerName: r.customerName ?? null,
    orderNumber: (r.orderNumber ?? "").trim() || null,
    productName: r.productName ?? null,
    // The price the account is charged, by the one rule every order is charged by.
    sellUsd: Math.round(computeOrderChargeAmount({ orderType: String(r.orderType ?? ""), sellingPriceUsd: r.sellingPriceUsd, itemPriceUsd: r.itemPriceUsd, commissionFeeUsd: r.commissionFeeUsd, quantity: r.quantity }) * 100) / 100,
    isCharged: Boolean(r.isCharged),
    createdAt: r.createdAt ?? null,
    parcelRegistered: Boolean(parcel),
  }));
}
