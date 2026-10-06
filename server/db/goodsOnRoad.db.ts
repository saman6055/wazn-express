import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { fullPackageOrders } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { LIVE_SALE_SQL, isLiveSale } from "@shared/orderProfit";
import { withFix } from "@shared/fixAdvice";
import { paidBeforeReason, type RoadPaid, type RoadRow } from "@shared/goodsOnRoad";
import { appLogger } from "../utils/logger";
import { getCustomerById } from "./customers.db";
import { adjustCustomerBalance } from "./finance.db";

const num = (v: unknown) => Number(v ?? 0) || 0;
const DAY_MS = 86_400_000;

/**
 * Every live order that is not finished: not yet on the customer's account,
 * or on it and not yet delivered. The first kind is exactly what the
 * working-capital page counts as goods on the road (same `isCharged` test,
 * same price rule), so its total and this list cannot disagree.
 */
export async function listGoodsOnRoad(now: Date = new Date()): Promise<RoadRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      orderId: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      status: fullPackageOrders.status,
      createdAt: fullPackageOrders.createdAt,
      customerId: fullPackageOrders.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      productName: fullPackageOrders.productName,
      quantity: fullPackageOrders.quantity,
      isCharged: fullPackageOrders.isCharged,
      trackingNumber: fullPackageOrders.trackingNumber,
      // The profit report's own per-unit rule (reports.db getProfitForPeriod).
      buy: sql<string>`CASE WHEN ${fullPackageOrders.orderType} = 'commission' THEN ${fullPackageOrders.itemPriceUsd} * ${fullPackageOrders.quantity} ELSE ${fullPackageOrders.purchasePriceUsd} * ${fullPackageOrders.quantity} END`,
      sell: sql<string>`CASE WHEN ${fullPackageOrders.orderType} = 'commission' THEN (${fullPackageOrders.itemPriceUsd} + ${fullPackageOrders.commissionFeeUsd}) * ${fullPackageOrders.quantity} ELSE ${fullPackageOrders.sellingPriceUsd} * ${fullPackageOrders.quantity} END`,
    })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(customers.id, fullPackageOrders.customerId))
    .where(and(
      sql.raw(LIVE_SALE_SQL.replace(/\bdeletedAt\b/g, "fullPackageOrders.deletedAt").replace(/\bstatus\b/g, "fullPackageOrders.status")),
      sql`(COALESCE(${fullPackageOrders.isCharged}, 0) = 0 OR ${fullPackageOrders.status} <> 'delivered')`,
    ))
    .orderBy(asc(fullPackageOrders.createdAt))
    .limit(2000);

  return rows.map((r) => ({
    orderId: Number(r.orderId),
    orderCode: r.orderCode,
    orderType: String(r.orderType),
    status: String(r.status),
    createdAt: r.createdAt,
    days: r.createdAt ? Math.max(0, Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / DAY_MS)) : 0,
    customerId: r.customerId ?? null,
    customerCode: r.customerCode ?? null,
    customerName: r.customerName ?? null,
    productName: r.productName ?? null,
    quantity: Number(r.quantity) || 1,
    buyUsd: num(r.buy),
    sellUsd: num(r.sell),
    onAccount: Boolean(r.isCharged),
    trackingNumber: r.trackingNumber ?? null,
  }));
}

/**
 * An order whose goods are with the customer, closed by the main admin.
 *
 * The goods are charged through the one door every order is charged through
 * (chargeOrderAtCreation), so nothing can be billed twice and the amount is
 * the one rule there has ever been. "Paid before" then takes the same amount
 * straight back off with a line that says why — the balance ends where it
 * began, and the statement shows both lines.
 */
export async function closeOrderOnRoad(orderId: number, paid: RoadPaid, userId: number): Promise<{ orderCode: string; amountUsd: number; balanceUsd: number | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [order] = await db.select().from(fullPackageOrders).where(eq(fullPackageOrders.id, orderId)).limit(1);
  if (!order || order.deletedAt) {
    throw new Error(withFix("ئەم داواکارییە نەدۆزرایەوە.", ["پەڕەکە نوێ بکەوە"]));
  }
  // Only what the list itself shows: a cancelled or returned order is no
  // sale, and closing one would put a debt on somebody for goods they never got.
  if (!isLiveSale(order)) {
    throw new Error(withFix(`داواکاریی ${order.orderCode} هەڵوەشێنراوەتەوە یان گەڕێنراوەتەوە — ناکرێت لەسەر کڕیار بنووسرێت.`, ["پەڕەکە نوێ بکەوە، ئەم داواکارییە نابێت لە لیستەکەدا بێت"]));
  }
  if (order.isCharged || order.chargeTransactionId) {
    throw new Error(withFix(`داواکاریی ${order.orderCode} پێشتر لەسەر کڕیار نووسراوە.`, ["ئەگەر پارەکەی دراوە، لە بۆکسەکەیەوە واسڵی بکە", "ئەگەر نەگەیشتووە، هیچ کارێک پێویست نییە"]));
  }
  if (!order.customerId) {
    throw new Error(withFix(`داواکاریی ${order.orderCode} کڕیاری لەسەر نییە.`, ["داواکارییەکە بکەوە و کڕیارەکەی دیاری بکە"]));
  }
  const customer = await getCustomerById(order.customerId);
  if (!customer) {
    throw new Error(withFix("کڕیاری ئەم داواکارییە نەدۆزرایەوە.", ["داواکارییەکە بکەوە و کڕیارەکەی دیاری بکە"]));
  }

  // Imported here, not at the top: fullPackage.db reaches back into this side of the graph.
  const { chargeOrderAtCreation } = await import("./fullPackage.db");
  const charge = await chargeOrderAtCreation(order, userId);
  if (!charge.charged) {
    const why: Record<string, string> = {
      quote: "ئەمە داواکاریی نرخە و هێشتا پەسەند نەکراوە.",
      no_price: "ئەم داواکارییە نرخی فرۆشتنی نییە.",
      already_charged: "ئەم داواکارییە هەر ئێستا لە شوێنێکی تر نووسرا.",
    };
    throw new Error(withFix(why[charge.reason ?? ""] ?? "نرخی داواکارییەکە لەسەر کڕیار نەنووسرا.", ["داواکارییەکە بکەوە و نرخەکەی ببینە", "دووبارە هەوڵ بدەوە"]));
  }

  let balanceUsd: number | null = null;
  if (paid === "before") {
    try {
      const credit = await adjustCustomerBalance(order.customerId, customer.customerCode, charge.amount, "credit", paidBeforeReason(order.orderCode), userId);
      balanceUsd = credit.newBalanceUsd;
    } catch (e) {
      // The charge stands and the line that should cancel it does not: say so
      // exactly, rather than leave a debt nobody can explain.
      appLogger.error("[GoodsOnRoad] charged but the paid-before line failed", { orderId, orderCode: order.orderCode, amount: charge.amount, error: e instanceof Error ? e.message : String(e) });
      throw new Error(withFix(
        `$${charge.amount.toFixed(2)} لەسەر ${customer.customerCode} نووسرا، بەڵام دێڕی «پێشتر دراوە» تۆمار نەکرا.`,
        [`لە حیسابی ${customer.customerCode} ڕێکخستنێکی دەستی بە $${charge.amount.toFixed(2)} وەک «کەمکردنەوە» بنووسە`, `لە هۆکارەکەدا بنووسە: ${paidBeforeReason(order.orderCode)}`],
      ));
    }
  }

  await db
    .update(fullPackageOrders)
    .set({ status: "delivered", deliveredDate: new Date() })
    .where(eq(fullPackageOrders.id, orderId));
  appLogger.info("[GoodsOnRoad] order closed as with the customer", { orderId, orderCode: order.orderCode, paid, amount: charge.amount, userId });
  return { orderCode: order.orderCode, amountUsd: charge.amount, balanceUsd };
}
