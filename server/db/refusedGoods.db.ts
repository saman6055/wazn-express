import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { companyStock, customerAccounts, fullPackageOrders, fullPackageOrderTrackings, packages, storeProducts } from "../../drizzle/schema";
import { batches } from "../../drizzle/schema/batches.schema";
import { customers, users } from "../../drizzle/schema/users.schema";
import { isLiveSale } from "@shared/orderProfit";
import { withFix } from "@shared/fixAdvice";
import {
  REFUSAL_FAULT,
  STOCK_OLD_DAYS,
  abandonLedgerReason,
  clampKeep,
  parcelFreightCostUsd,
  keptLedgerReason,
  planRefusal,
  refusalLedgerReason,
  stockSaleLedgerText,
  type RefusalReason,
} from "@shared/refusedGoods";
import { appLogger } from "../utils/logger";
import { getCustomerById } from "./customers.db";
import { adjustCharge, adjustCustomerBalance, reverseCharge } from "./finance.db";
import { getBatchCostsByRule } from "./batches.db";
import { parcelOwnCharges, parcelReceipt } from "./parcelDeletion.db";
import { getVolumetricDivisor } from "./settings.db";

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

/**
 * Find the order behind what the office has in its hand: a tracking number,
 * or the order's own code (owner, 2026-10-07: "I search by the tracking — the
 * system must find it"). One carton can carry several orders, so this returns
 * every live one and the office picks. `plainParcel` says the tracking is
 * known but belongs to a customer's own parcel, which has no buying cost to
 * put in stock.
 */
export async function searchOrdersForRefusal(query: string) {
  const db = await getDb();
  const q = query.trim();
  if (!db || !q) return { orders: [], parcels: [], plainParcel: false, allEnded: false };
  const [byCode, byOwnTracking, byList, byParcel] = await Promise.all([
    db.select({ id: fullPackageOrders.id }).from(fullPackageOrders).where(eq(fullPackageOrders.orderCode, q)),
    db.select({ id: fullPackageOrders.id }).from(fullPackageOrders).where(or(eq(fullPackageOrders.trackingNumber, q), eq(fullPackageOrders.supplierTrackingNumber, q))),
    db.select({ id: fullPackageOrderTrackings.fullPackageOrderId }).from(fullPackageOrderTrackings).where(eq(fullPackageOrderTrackings.trackingNumber, q)),
    db.select({ id: packages.id, orderId: packages.fullPackageOrderId }).from(packages).where(eq(packages.trackingNumber, q)),
  ]);
  const ids = Array.from(new Set([...byCode, ...byOwnTracking, ...byList].map((r) => Number(r.id)).concat(byParcel.map((r) => Number(r.orderId))).filter((id) => id > 0)));
  // A parcel with no order behind it: the company only carried it. It can
  // still be left behind, or have no owner at all.
  const plainIds = byParcel.filter((r) => !(Number(r.orderId) > 0)).map((r) => Number(r.id));
  const parcels = [];
  for (const id of plainIds) {
    const view = await previewParcelAbandon(id).catch(() => null);
    if (view) parcels.push(view);
  }
  if (ids.length === 0) return { orders: [], parcels, plainParcel: byParcel.length > 0 && parcels.length === 0, allEnded: false };
  const rows = await db
    .select({
      orderId: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      productName: fullPackageOrders.productName,
      quantity: fullPackageOrders.quantity,
      status: fullPackageOrders.status,
      deletedAt: fullPackageOrders.deletedAt,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(customers.id, fullPackageOrders.customerId))
    .where(inArray(fullPackageOrders.id, ids));
  const live = rows.filter((r) => isLiveSale(r));
  return {
    orders: live.map((r) => ({ orderId: Number(r.orderId), orderCode: r.orderCode, productName: r.productName, quantity: r.quantity ?? 1, status: String(r.status), customerCode: r.customerCode, customerName: r.customerName })),
    parcels,
    plainParcel: false,
    /** Found, but every one of them is already cancelled or refused. */
    allEnded: rows.length > 0 && live.length === 0,
  };
}

// ---------------------------------------------------------------------------
// A parcel the company only carried: left behind, or with no owner
// ---------------------------------------------------------------------------

async function loadParcelForAbandon(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);
  if (!pkg) throw new Error(withFix("ئەم پاکەتە نەدۆزرایەوە.", ["تراکەکە دووبارە بنووسە"]));
  if (Number(pkg.fullPackageOrderId) > 0) {
    throw new Error(withFix("ئەم پاکەتە داواکاریی کڕینی لەسەرە.", ["بە هەمان تراک بگەڕێ و داواکارییەکە ڕەت بکەوە، نەک پاکەتەکە"]));
  }
  if (pkg.status === "returned" || pkg.status === "cancelled") {
    throw new Error(withFix("ئەم پاکەتە پێشتر گەڕێنراوەتەوە یان هەڵوەشێنراوەتەوە.", ["لە لیستی خوارەوە بە هەمان تراک بیدۆزەوە"]));
  }
  const [already] = await db.select({ id: companyStock.id }).from(companyStock).where(eq(companyStock.packageId, packageId)).limit(1);
  if (already) throw new Error(withFix("ئەم پاکەتە پێشتر خراوەتە ناو کاڵای ماوە.", ["لە لیستی خوارەوە بە هەمان تراک بیدۆزەوە"]));

  const ownerless = Boolean(pkg.isUnclaimed) || !pkg.customerId;
  const customer = !ownerless && pkg.customerId ? await getCustomerById(pkg.customerId) : null;
  const [account] = customer
    ? await db.select({ id: customerAccounts.id, balance: customerAccounts.currentBalanceUsd }).from(customerAccounts).where(eq(customerAccounts.customerId, customer.id)).limit(1)
    : [];
  const charges = account ? await parcelOwnCharges(db, { id: Number(account.id) }, packageId) : [];

  // What carrying it cost: the batch's real rate on this parcel's own weight or volume.
  let freightCostUsd = 0;
  if (pkg.batchId) {
    const cost = (await getBatchCostsByRule([Number(pkg.batchId)])).get(Number(pkg.batchId));
    if (cost) {
      freightCostUsd = parcelFreightCostUsd({
        unit: cost.unit,
        ratePerUnit: cost.effectiveRate,
        weightKg: num(pkg.weightKg),
        lengthCm: num(pkg.lengthCm),
        widthCm: num(pkg.widthCm),
        heightCm: num(pkg.heightCm),
        volumeCbm: num(pkg.volumeCbm),
        divisor: await getVolumetricDivisor(),
      });
    }
  }
  const [batch] = pkg.batchId ? await db.select({ code: batches.batchCode }).from(batches).where(eq(batches.id, Number(pkg.batchId))).limit(1) : [];
  return { db, pkg, ownerless, customer: customer ?? null, account: account ?? null, charges, freightCostUsd, batchCode: batch?.code ?? null };
}

/** What leaving this parcel behind would do, before anything is done. Read only. */
export async function previewParcelAbandon(packageId: number) {
  const { pkg, ownerless, customer, account, charges, freightCostUsd, batchCode } = await loadParcelForAbandon(packageId);
  // What the customer is charged for it now: the charges standing on the account, net of anything already undone.
  const chargedUsd = pkg.isCharged ? cents(num(pkg.calculatedCostUsd)) : 0;
  const balanceUsd = num(account?.balance);
  const takenOffUsd = charges.length > 0 ? chargedUsd : 0;
  const balanceAfterUsd = cents(balanceUsd - takenOffUsd);
  return {
    packageId: Number(pkg.id),
    trackingNumber: pkg.trackingNumber,
    description: pkg.description,
    ownerless,
    customerId: customer?.id ?? null,
    customerCode: customer?.customerCode ?? null,
    customerName: customer?.fullName ?? null,
    batchCode,
    weightKg: num(pkg.weightKg),
    freightCostUsd,
    takenOffUsd,
    balanceUsd,
    balanceAfterUsd,
    keepableUsd: cents(Math.max(0, -balanceAfterUsd)),
  };
}

/**
 * A parcel the company only carried becomes the company's own: the freight
 * comes off the customer who will not take it (an ownerless one was never on
 * anybody's account), and the parcel goes into stock at no buying cost — what
 * is lost is the freight, which its batch's cost already carries, so it is
 * shown here and never taken out of profit a second time.
 */
export async function abandonParcel(input: { packageId: number; keepUsd: number; note?: string }, userId: number) {
  const { db, pkg, ownerless, customer, account, charges, freightCostUsd } = await loadParcelForAbandon(input.packageId);
  const paid = await parcelReceipt(input.packageId);
  if (paid) {
    throw new Error(withFix(
      `ئەم پاکەتە پارەکەی لە وەسڵی ${paid.settlementNumber} وەرگیراوە، بۆیە هیچ خەسارەیەکی لەسەر نییە.`,
      ["ئەگەر کڕیار کاڵاکەی ناوێت و پارەکەی داوە، هیچ کارێک پێویست نییە", `ئەگەر دەبێت پارەکەی بگەڕێتەوە، یەکەم جار وەسڵەکە لە بۆکسی ${paid.boxCode ?? ""} هەڵبوەشێنەوە`],
    ));
  }
  const tracking = pkg.trackingNumber ?? `#${pkg.id}`;
  const why = abandonLedgerReason(tracking);

  let takenOffUsd = 0;
  for (const charge of charges) {
    const { reversalTransaction } = await reverseCharge(charge.id, why, userId, undefined, { allowCredit: true });
    takenOffUsd = cents(takenOffUsd + num(reversalTransaction.amountUsd));
  }

  let keptUsd = 0;
  if (customer && account) {
    const [after] = await db.select({ balance: customerAccounts.currentBalanceUsd }).from(customerAccounts).where(eq(customerAccounts.id, Number(account.id))).limit(1);
    const keepable = cents(Math.max(0, -num(after?.balance)));
    keptUsd = cents(Math.min(keepable, Math.max(0, Number(input.keepUsd) || 0)));
    if (keptUsd > 0) await adjustCustomerBalance(customer.id, customer.customerCode, keptUsd, "debit", keptLedgerReason(tracking), userId);
  }

  // No longer a parcel anybody is charged for. Its price is cleared as well as
  // its charge: the batch's profit shares the carrier's cost out by each
  // parcel's price, so a parcel left with a price would take its share of the
  // cost away with it and the loss would never show. At nothing, the whole
  // cost of the batch falls on the parcels that were paid for — which is the
  // loss, in the batch's own figures. (What it was charged stays on the stock
  // row and in the ledger.)
  await db.update(packages).set({ isCharged: false, status: "returned", calculatedCostUsd: "0" }).where(eq(packages.id, Number(pkg.id)));

  const reason: RefusalReason = ownerless ? "ownerless" : "abandoned";
  const [inserted] = await db.insert(companyStock).values({
    packageId: Number(pkg.id),
    trackingNumber: pkg.trackingNumber,
    customerId: customer?.id ?? null,
    productName: (pkg.description ?? "").trim().slice(0, 480) || "پاکەت",
    quantity: 1,
    costUsd: "0.00",
    freightCostUsd: freightCostUsd.toFixed(2),
    refusedSellUsd: takenOffUsd.toFixed(2),
    keptUsd: keptUsd.toFixed(2),
    reason,
    fault: REFUSAL_FAULT[reason],
    note: (input.note ?? "").trim() || null,
    createdById: userId,
  });
  appLogger.info("[RefusedGoods] parcel left behind", { packageId: pkg.id, tracking, ownerless, takenOffUsd, keptUsd, freightCostUsd, userId });
  return { stockId: Number(inserted.insertId), trackingNumber: tracking, ownerless, takenOffUsd, keptUsd, freightCostUsd };
}

/** Ownerless parcels still waiting for somebody: how many, and what carrying them cost. */
export async function getOwnerlessFreight(): Promise<{ count: number; freightCostUsd: number; unknownCost: number }> {
  const db = await getDb();
  if (!db) return { count: 0, freightCostUsd: 0, unknownCost: 0 };
  const rows = await db
    .select({ id: packages.id, batchId: packages.batchId, weightKg: packages.weightKg, lengthCm: packages.lengthCm, widthCm: packages.widthCm, heightCm: packages.heightCm, volumeCbm: packages.volumeCbm })
    .from(packages)
    .where(and(eq(packages.isUnclaimed, true), sql`${packages.status} NOT IN ('returned', 'cancelled')`))
    .limit(2000);
  if (rows.length === 0) return { count: 0, freightCostUsd: 0, unknownCost: 0 };
  const costs = await getBatchCostsByRule(Array.from(new Set(rows.map((r) => Number(r.batchId)).filter((id) => id > 0))));
  const divisor = await getVolumetricDivisor();
  let total = 0;
  let unknown = 0;
  for (const r of rows) {
    const cost = r.batchId ? costs.get(Number(r.batchId)) : undefined;
    const usd = cost ? parcelFreightCostUsd({ unit: cost.unit, ratePerUnit: cost.effectiveRate, weightKg: num(r.weightKg), lengthCm: num(r.lengthCm), widthCm: num(r.widthCm), heightCm: num(r.heightCm), volumeCbm: num(r.volumeCbm), divisor }) : 0;
    if (usd > 0) total += usd;
    else unknown += 1;
  }
  return { count: rows.length, freightCostUsd: cents(total), unknownCost: unknown };
}

/**
 * Refuse pieces of an order: off the customer's account, some of the
 * customer's money kept if the main admin says so, and the pieces into the
 * company's stock at what they cost. Each step is a line somebody can read.
 */
export async function refuseOrderGoods(
  input: { orderId: number; refuseQuantity: number; reason: RefusalReason; keepUsd: number; note?: string; trackingNumber?: string },
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
    trackingNumber: (input.trackingNumber ?? "").trim() || order.trackingNumber || null,
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
      trackingNumber: companyStock.trackingNumber,
      customerId: companyStock.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      productName: companyStock.productName,
      productImage: companyStock.productImage,
      quantity: companyStock.quantity,
      packageId: companyStock.packageId,
      costUsd: companyStock.costUsd,
      freightCostUsd: companyStock.freightCostUsd,
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
      freightCostUsd: num(r.freightCostUsd),
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
 * What refused goods did to profit in a window (owner, 2026-10-07: goods
 * nobody took are a LOSS from the day they are refused — "dead goods that
 * have taken money" — off the refusing customer's account and onto the
 * company's own loss; whatever a sale brings back comes off that loss).
 *
 *   the day of the refusal:  − what the goods cost  + the customer's money kept
 *   the day of the sale:     + the price it sold for
 *
 * A write-off adds nothing: the cost was already counted. Read by the one
 * profit rule (reports.db getProfitForPeriod).
 */
export async function getStockProfitBetween(start: Date, end: Date): Promise<{ lostUsd: number; keptUsd: number; recoveredUsd: number; profitUsd: number }> {
  const db = await getDb();
  if (!db) return { lostUsd: 0, keptUsd: 0, recoveredUsd: 0, profitUsd: 0 };
  const [[refused], [sold]] = await Promise.all([
    db
      .select({ cost: sql<string>`COALESCE(SUM(${companyStock.costUsd}), 0)`, kept: sql<string>`COALESCE(SUM(${companyStock.keptUsd}), 0)` })
      .from(companyStock)
      .where(and(gte(companyStock.createdAt, start), lte(companyStock.createdAt, end))),
    db
      .select({ usd: sql<string>`COALESCE(SUM(COALESCE(${companyStock.soldPriceUsd}, 0)), 0)` })
      .from(companyStock)
      .where(and(eq(companyStock.status, "sold"), gte(companyStock.closedAt, start), lte(companyStock.closedAt, end))),
  ]);
  const lostUsd = num(refused?.cost);
  const keptUsd = num(refused?.kept);
  const recoveredUsd = num(sold?.usd);
  return { lostUsd, keptUsd, recoveredUsd, profitUsd: cents(keptUsd + recoveredUsd - lostUsd) };
}

/** Goods still on our hands and what they cost — shown, already counted as a loss. */
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
