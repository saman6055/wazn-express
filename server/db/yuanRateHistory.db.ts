/**
 * Reads for the yuan rate's history page (shared/yuanRateHistory). Read-only.
 */
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { getDb } from "./connection";
import { exchangeRates, fullPackageOrders, users } from "../../drizzle/schema";
import { buildYuanRateHistory, type YuanRatePeriod } from "@shared/yuanRateHistory";

const num = (v: unknown) => (v == null ? null : Number(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");

export async function getYuanRateHistory(): Promise<YuanRatePeriod[]> {
  const db = await getDb();
  if (!db) return [];
  const rates = await db
    .select({ id: exchangeRates.id, rate: exchangeRates.rate, effectiveFrom: exchangeRates.effectiveFrom, createdByName: users.name })
    .from(exchangeRates)
    .leftJoin(users, eq(users.id, exchangeRates.createdById))
    .where(eq(exchangeRates.targetCurrency, "RMB"))
    .orderBy(asc(exchangeRates.effectiveFrom));
  const orders = await db
    .select({
      orderType: fullPackageOrders.orderType,
      quantity: fullPackageOrders.quantity,
      itemPriceUsd: fullPackageOrders.itemPriceUsd,
      itemPriceCny: fullPackageOrders.itemPriceCny,
      purchasePriceUsd: fullPackageOrders.purchasePriceUsd,
      purchasePriceCny: fullPackageOrders.purchasePriceCny,
      createdAt: fullPackageOrders.createdAt,
    })
    .from(fullPackageOrders)
    .where(and(
      isNull(fullPackageOrders.deletedAt),
      inArray(fullPackageOrders.orderType, ["commission", "full_package"]),
      notInArray(fullPackageOrders.status, ["cancelled", "refunded", "rejected"]),
    ));
  return buildYuanRateHistory(
    rates.map((r) => ({ id: Number(r.id), rate: Number(r.rate), effectiveFrom: iso(r.effectiveFrom), createdByName: r.createdByName ?? null })),
    orders.map((o) => ({
      orderType: o.orderType,
      quantity: Number(o.quantity) || 1,
      itemPriceUsd: num(o.itemPriceUsd),
      itemPriceCny: num(o.itemPriceCny),
      purchasePriceUsd: num(o.purchasePriceUsd),
      purchasePriceCny: num(o.purchasePriceCny),
      createdAt: iso(o.createdAt),
    })),
  );
}
