import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { companyStock, customerAccounts, fullPackageOrders, storeProducts } from "../../drizzle/schema";
import { customers, users } from "../../drizzle/schema/users.schema";
import { isLiveSale } from "@shared/orderProfit";
import { withFix } from "@shared/fixAdvice";
import {
  REFUSAL_FAULT,
  STOCK_OLD_DAYS,
  clampKeep,
  keptLedgerReason,
  planRefusal,
  refusalLedgerReason,
  stockSaleLedgerText,
  type RefusalReason,
} from "@shared/refusedGoods";
import { appLogger } from "../utils/logger";
import { getCustomerById } from "./customers.db";
import { adjustCharge, adjustCustomerBalance, reverseCharge } from "./finance.db";

const num = (v: unknown) => Number(v ?? 0) || 0;
const cents = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;

type Order = typeof fullPackageOrders.$inferSelect;

/** Per piece: what the customer is charged and what the company paid — the profit report's own rule. */
function unitPrices(order: Order): { unitSellUsd: number; unitBuyUsd: number } {
  if (order.orderType === "commission") {
    return { unitSellUsd: num(order.itemPriceUsd) + num(order.commissionFeeUsd), unitBuyUsd: num(order.itemPriceUsd) };
  }
  return { unitSellUsd: num(order.sellingPriceUsd), unitBuyUsd: num(order.purchasePriceUsd) };
}

async function loadForRefusal(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [order] = await db.select().from(fullPackageOrders).where(eq(fullPackageOrders.id, orderId)).limit(1);
  if (!order || order.deletedAt) throw new Error(withFix("ئەم داواکارییە نەدۆزرایەوە.", ["کۆدی داواکارییەکە دووبارە بنووسە"]));
  if (!isLiveSale(order)) {
    throw new Error(withFix(`داواکاریی ${order.orderCode} پێشتر هەڵوەشێنراوەتەوە یان گەڕێنراوەتەوە.`, ["ئەگەر کاڵاکەی لای شەریکەیە، لە لیستی «کاڵای ماوە» بیبینە"]));
  }
  if (!order.customerId) throw new Error(withFix(`داواکاریی ${order.orderCode} کڕیاری لەسەر نییە.`, ["داواکارییەکە بکەوە و کڕیارەکەی دیاری بکە"]));
  const customer = await getCustomerById(order.customerId);
  if (!customer) throw new Error(withFix("کڕیاری ئەم داواکارییە نەدۆزرایەوە.", ["داواکارییەکە بکەوە و کڕیارەکەی دیاری بکە"]));
  const [account] = await db.select({ balance: customerAccounts.currentBalanceUsd }).from(customerAccounts).where(eq(customerAccounts.customerId, order.customerId)).limit(1);
  return { db, order, customer, balanceUsd: num(account?.balance) };
}

/** What a refusal would do, before anything is done. Read only. */
export async function previewRefusal(orderId: number, refuseQuantity: number) {
  const { order, customer, balanceUsd } = await loadForRefusal(orderId);
  const prices = unitPrices(order);
  const plan = planRefusal({
    orderQuantity: order.quantity ?? 1,
    refuseQuantity,
    ...prices,
    charged: Boolean(order.isCharged),
    balanceUsd,
  });
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    productName: order.productName,
    productImage: order.productImage,
    status: order.status,
    orderQuantity: order.quantity ?? 1,
    customerId: order.customerId,
    customerCode: customer.customerCode,
    customerName: customer.fullName,
    balanceUsd,
    charged: Boolean(order.isCharged),
    advancePaidUsd: num(order.advancePaidUsd),
    ...prices,
    plan,
  };
}

export async function findOrderForRefusal(orderCode: string) {
  const db = await getDb();
  if (!db) return null;
  const code = orderCode.trim();
  if (!code) return null;
  const [row] = await db.select({ id: fullPackageOrders.id }).from(fullPackageOrders).where(eq(fullPackageOrders.orderCode, code)).limit(1);
  return row ? previewRefusal(Number(row.id), 1) : null;
}

/**
 * Refuse pieces of an order: off the customer's account, some of the
 * customer's money kept if the main admin says so, and the pieces into the
 * company's stock at what they cost. Each step is a line somebody can read.
 */
export async function refuseOrderGoods(
  input: { orderId: number; refuseQuantity: number; reason: RefusalReason; keepUsd: number; note?: string },
  userId: number,
) {
  const { db, order, customer, balanceUsd } = await loadForRefusal(input.orderId);
  const prices = unitPrices(order);
  const plan = planRefusal({ orderQuantity: order.quantity ?? 1, refuseQuantity: input.refuseQuantity, ...prices, charged: Boolean(order.isCharged), balanceUsd });
  const refused = (order.quantity ?? 1) - plan.remainingQuantity;
  const keepUsd = clampKeep(input.keepUsd, plan);
  if (input.reason === "other" && !(input.note ?? "").trim()) {
    throw new Error(withFix("هۆکارەکە نەنووسراوە.", ["لە خانەی تێبینی بنووسە بۆچی ڕەت کراوەتەوە"]));
  }
  const why = refusalLedgerReason(order.orderCode, input.reason, refused);

  // 1. The refused pieces come off the account. The main admin is the one
  //    doing this, so a credit it leaves is one he has seen in the dialog.
  if (plan.takenOffUsd > 0) {
    if (order.chargeTransactionId) {
      if (plan.whole) await reverseCharge(order.chargeTransactionId, why, userId, undefined, { allowCredit: true });
      else await adjustCharge(order.chargeTransactionId, cents(prices.unitSellUsd * plan.remainingQuantity), why, userId, undefined, { allowCredit: true });
    } else {
      // Charged before charges carried an id: the same amount, as its own line.
      await adjustCustomerBalance(order.customerId!, customer.customerCode, plan.takenOffUsd, "credit", why, userId);
    }
  }

  // 2. What the company keeps of the customer's own money.
  if (keepUsd > 0) {
    try {
      await adjustCustomerBalance(order.customerId!, customer.customerCode, keepUsd, "debit", keptLedgerReason(order.orderCode), userId);
    } catch (e) {
      appLogger.error("[RefusedGoods] taken off the account but the kept line failed", { orderId: order.id, keepUsd, error: e instanceof Error ? e.message : String(e) });
      throw new Error(withFix(
        `کاڵاکە لەسەر ${customer.customerCode} لابرا، بەڵام دێڕی «قەرەبووی ڕەتکردنەوە» بە $${keepUsd.toFixed(2)} تۆمار نەکرا.`,
        [`لە حیسابی ${customer.customerCode} ڕێکخستنێکی دەستی بە $${keepUsd.toFixed(2)} وەک «زیادکردن» بنووسە`, `لە هۆکارەکەدا بنووسە: ${keptLedgerReason(order.orderCode)}`, "ئینجا دووبارە ئەم ڕەتکردنەوەیە مەکەوە — پەیوەندی بە پشتیوانییەوە بکە بۆ تۆمارکردنی کاڵاکە"],
      ));
    }
  }

  // 3. The order: ended, or smaller.
  //    "cancelled", not "returned": every database this system runs on knows
  //    that word (the older ones were created with a shorter list of statuses,
  //    and a status they do not know is refused). The stock row says the rest.
  if (plan.whole) await db.update(fullPackageOrders).set({ status: "cancelled" }).where(eq(fullPackageOrders.id, order.id));
  else await db.update(fullPackageOrders).set({ quantity: plan.remainingQuantity }).where(eq(fullPackageOrders.id, order.id));

  // 4. The pieces are the company's now.
  const [inserted] = await db.insert(companyStock).values({
    orderId: order.id,
    orderCode: order.orderCode,
    customerId: order.customerId,
    productName: order.productName,
    productImage: order.productImage,
    quantity: refused,
    costUsd: plan.costUsd.toFixed(2),
    refusedSellUsd: plan.takenOffUsd.toFixed(2),
    keptUsd: keepUsd.toFixed(2),
    reason: input.reason,
    fault: REFUSAL_FAULT[input.reason],
    note: (input.note ?? "").trim() || null,
    createdById: userId,
  });
  appLogger.info("[RefusedGoods] refused", { orderId: order.id, orderCode: order.orderCode, refused, takenOffUsd: plan.takenOffUsd, keepUsd, costUsd: plan.costUsd, userId });
  return { stockId: Number(inserted.insertId), orderCode: order.orderCode, refused, takenOffUsd: plan.takenOffUsd, keptUsd: keepUsd, costUsd: plan.costUsd, returnedToCustomerUsd: cents(plan.keepableUsd - keepUsd) };
}

export async function listCompanyStock(now: Date = new Date()) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: companyStock.id,
      orderId: companyStock.orderId,
      orderCode: companyStock.orderCode,
      customerId: companyStock.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      productName: companyStock.productName,
      productImage: companyStock.productImage,
      quantity: companyStock.quantity,
      costUsd: companyStock.costUsd,
      refusedSellUsd: companyStock.refusedSellUsd,
      keptUsd: companyStock.keptUsd,
      reason: companyStock.reason,
      fault: companyStock.fault,
      note: companyStock.note,
      status: companyStock.status,
      soldPriceUsd: companyStock.soldPriceUsd,
      soldToCustomerId: companyStock.soldToCustomerId,
      closedAt: companyStock.closedAt,
      closeNote: companyStock.closeNote,
      storeProductId: companyStock.storeProductId,
      createdAt: companyStock.createdAt,
      by: users.name,
    })
    .from(companyStock)
    .leftJoin(customers, eq(customers.id, companyStock.customerId))
    .leftJoin(users, eq(users.id, companyStock.createdById))
    .orderBy(desc(companyStock.createdAt))
    .limit(1000);
  return rows.map((r) => {
    const days = Math.max(0, Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / DAY_MS));
    return {
      ...r,
      costUsd: num(r.costUsd),
      refusedSellUsd: num(r.refusedSellUsd),
      keptUsd: num(r.keptUsd),
      soldPriceUsd: r.soldPriceUsd == null ? null : num(r.soldPriceUsd),
      days,
      old: r.status === "held" && days >= STOCK_OLD_DAYS,
    };
  });
}

async function loadHeld(stockId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(companyStock).where(eq(companyStock.id, stockId)).limit(1);
  if (!row) throw new Error(withFix("ئەم کاڵایە نەدۆزرایەوە.", ["پەڕەکە نوێ بکەوە"]));
  if (row.status !== "held") throw new Error(withFix("ئەم کاڵایە پێشتر داخراوە (فرۆشراوە یان فڕێ دراوە).", ["پەڕەکە نوێ بکەوە"]));
  return { db, row };
}

/**
 * Sold. To a customer on account, the price becomes their debt with a line
 * that says what it is; otherwise it is a cash sale and the money shows as
 * cash on the working-capital page. Claimed with a conditional update, so two
 * people cannot sell the same piece.
 */
export async function sellCompanyStock(input: { stockId: number; priceUsd: number; customerId?: number | null; note?: string }, userId: number) {
  const { db, row } = await loadHeld(input.stockId);
  const priceUsd = cents(input.priceUsd);
  if (!(priceUsd >= 0)) throw new Error(withFix("نرخی فرۆشتن دروست نییە.", ["نرخەکە بە دۆلار بنووسە"]));
  const buyer = input.customerId ? await getCustomerById(input.customerId) : null;
  if (input.customerId && !buyer) throw new Error(withFix("ئەو کڕیارە نەدۆزرایەوە.", ["کڕیارەکە دووبارە هەڵبژێرە"]));

  const [claim] = await db
    .update(companyStock)
    .set({ status: "sold", soldPriceUsd: priceUsd.toFixed(2), soldToCustomerId: buyer?.id ?? null, closedAt: new Date(), closedById: userId, closeNote: (input.note ?? "").trim() || null })
    .where(and(eq(companyStock.id, input.stockId), eq(companyStock.status, "held")));
  if (!(claim as { affectedRows?: number }).affectedRows) throw new Error(withFix("ئەم کاڵایە هەر ئێستا لە لایەن کەسێکی ترەوە داخرا.", ["پەڕەکە نوێ بکەوە"]));

  if (buyer && priceUsd > 0) {
    try {
      await adjustCustomerBalance(buyer.id, buyer.customerCode, priceUsd, "debit", stockSaleLedgerText(row.productName, row.orderCode), userId);
    } catch (e) {
      // Not on the buyer's account after all: the piece goes back on the shelf.
      await db.update(companyStock).set({ status: "held", soldPriceUsd: null, soldToCustomerId: null, closedAt: null, closedById: null, closeNote: null }).where(eq(companyStock.id, input.stockId));
      throw new Error(withFix("نرخەکە لەسەر کڕیار نەنووسرا، بۆیە فرۆشتنەکە تۆمار نەکرا.", ["دووبارە هەوڵ بدەوە", e instanceof Error ? e.message : null]));
    }
  }
  return { stockId: input.stockId, priceUsd, resultUsd: cents(priceUsd - num(row.costUsd)) };
}

/** Never sold: lost, broken, given away. The cost is the loss, the day it is said. */
export async function writeOffCompanyStock(input: { stockId: number; note: string }, userId: number) {
  const { db, row } = await loadHeld(input.stockId);
  if (!input.note.trim()) throw new Error(withFix("هۆکاری فڕێدان نەنووسراوە.", ["بنووسە چی بەسەر کاڵاکەدا هات"]));
  const [claim] = await db
    .update(companyStock)
    .set({ status: "written_off", closedAt: new Date(), closedById: userId, closeNote: input.note.trim() })
    .where(and(eq(companyStock.id, input.stockId), eq(companyStock.status, "held")));
  if (!(claim as { affectedRows?: number }).affectedRows) throw new Error(withFix("ئەم کاڵایە هەر ئێستا لە لایەن کەسێکی ترەوە داخرا.", ["پەڕەکە نوێ بکەوە"]));
  return { stockId: input.stockId, lossUsd: num(row.costUsd) };
}

/** Put a piece on Wazn Store's shelf (owner: another customer often wants the same thing for less). */
export async function listStockInStore(input: { stockId: number; priceUsd: number }, userId: number) {
  const { db, row } = await loadHeld(input.stockId);
  if (row.storeProductId) throw new Error(withFix("ئەم کاڵایە پێشتر خراوەتە ناو وەزن ستۆر.", ["لە بەڕێوەبردنی وەزن ستۆر بیبینە"]));
  const priceUsd = cents(input.priceUsd);
  if (!(priceUsd > 0)) throw new Error(withFix("نرخی فرۆشتن دروست نییە.", ["نرخەکە بە دۆلار بنووسە"]));
  const name = (row.productName ?? "کاڵا").slice(0, 280);
  const [product] = await db.insert(storeProducts).values({
    nameEn: name,
    nameKu: name,
    price: priceUsd.toFixed(2),
    coverImageUrl: row.productImage && row.productImage.length <= 500 ? row.productImage : null,
    category: "کاڵای ماوە",
    status: "active",
    stock: row.quantity,
    slug: `stock-${row.id}-${Date.now().toString(36)}`,
  });
  await db.update(companyStock).set({ storeProductId: Number(product.insertId) }).where(eq(companyStock.id, row.id));
  appLogger.info("[RefusedGoods] listed in the store", { stockId: row.id, productId: Number(product.insertId), priceUsd, userId });
  return { stockId: row.id, storeProductId: Number(product.insertId) };
}

/**
 * What refused goods did to profit in a window: money kept on the day of the
 * refusal, and how each piece ended on the day it was closed. Read by the one
 * profit rule (reports.db getProfitForPeriod).
 */
export async function getStockProfitBetween(start: Date, end: Date): Promise<{ keptUsd: number; outcomeUsd: number; profitUsd: number; closed: number }> {
  const db = await getDb();
  if (!db) return { keptUsd: 0, outcomeUsd: 0, profitUsd: 0, closed: 0 };
  const [[kept], [closed]] = await Promise.all([
    db.select({ usd: sql<string>`COALESCE(SUM(${companyStock.keptUsd}), 0)` }).from(companyStock).where(and(gte(companyStock.createdAt, start), lte(companyStock.createdAt, end))),
    db
      .select({
        usd: sql<string>`COALESCE(SUM(CASE WHEN ${companyStock.status} = 'sold' THEN COALESCE(${companyStock.soldPriceUsd}, 0) - ${companyStock.costUsd} ELSE -${companyStock.costUsd} END), 0)`,
        n: sql<number>`COUNT(*)`,
      })
      .from(companyStock)
      .where(and(sql`${companyStock.status} <> 'held'`, gte(companyStock.closedAt, start), lte(companyStock.closedAt, end))),
  ]);
  const keptUsd = num(kept?.usd);
  const outcomeUsd = num(closed?.usd);
  return { keptUsd, outcomeUsd, profitUsd: cents(keptUsd + outcomeUsd), closed: Number(closed?.n) || 0 };
}

/** Goods still on our hands, at what they cost — the working-capital page's line. */
export async function getStockHeld(): Promise<{ usd: number; count: number; old: number }> {
  const db = await getDb();
  if (!db) return { usd: 0, count: 0, old: 0 };
  const [row] = await db
    .select({
      usd: sql<string>`COALESCE(SUM(${companyStock.costUsd}), 0)`,
      count: sql<number>`COUNT(*)`,
      old: sql<number>`COALESCE(SUM(CASE WHEN ${companyStock.createdAt} <= NOW() - INTERVAL ${sql.raw(String(STOCK_OLD_DAYS))} DAY THEN 1 ELSE 0 END), 0)`,
    })
    .from(companyStock)
    .where(eq(companyStock.status, "held"));
  return { usd: num(row?.usd), count: Number(row?.count) || 0, old: Number(row?.old) || 0 };
}

/** How many times this customer has refused goods — shown where their next order is typed. */
export async function countCustomerRefusals(customerId: number): Promise<{ times: number; costUsd: number }> {
  const db = await getDb();
  if (!db) return { times: 0, costUsd: 0 };
  const [row] = await db
    .select({ times: sql<number>`COUNT(*)`, usd: sql<string>`COALESCE(SUM(${companyStock.costUsd}), 0)` })
    .from(companyStock)
    .where(and(eq(companyStock.customerId, customerId), eq(companyStock.fault, "customer")));
  return { times: Number(row?.times) || 0, costUsd: num(row?.usd) };
}
