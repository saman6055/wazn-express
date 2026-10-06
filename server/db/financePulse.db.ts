import { and, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  batches,
  boxSettlementLines,
  boxSettlements,
  customerAccounts,
  deliveryBoxes,
  expenses,
  fullPackageOrders,
  packages,
  partners,
  partnerTransactions,
} from "../../drizzle/schema";
import { customers, users } from "../../drizzle/schema/users.schema";
import { LIVE_SALE_SQL } from "@shared/orderProfit";
import { batchMissingCost } from "@shared/batchPricing";
import {
  FIXED_COSTS_KEY,
  MAX_FIXED_COSTS,
  OLD_DEBT_DAYS,
  cleanFixedCost,
  draws,
  flow,
  monthlyNeedUsd,
  parseFixedCosts,
  periodBounds,
  pulse,
  type DashboardPeriod,
  type FixedCost,
  type PartnerDraw,
} from "@shared/financePulse";
import { cacheGetOrSet, cacheInvalidate } from "./cache";
import { getDebtAges } from "./debtAge.db";
import { getFinancialSummary } from "./finance.db";
import { findUnbilledArrivedOrders } from "./orderCharging.db";
import { listUnsentPaymentWhatsApp } from "./paymentWhatsApp.db";
import { getBatchProfitRowsInPeriod, getProfitForPeriod } from "./reports.db";
import { getSetting, setSetting } from "./settings.db";
import { getMoneyReceived, getWorkingCapital } from "./workingCapital.db";

const num = (v: unknown) => Number(v ?? 0) || 0;
const cents = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;
const PULSE_CACHE_KEY = "finance:pulse";
const PULSE_TTL_MS = 10 * 60_000;

export async function getFixedCosts(): Promise<FixedCost[]> {
  return parseFixedCosts(await getSetting(FIXED_COSTS_KEY));
}

/** The owner's list of running costs, replaced whole. */
export async function saveFixedCosts(rows: unknown[], userId: number): Promise<FixedCost[]> {
  const clean = rows.map(cleanFixedCost).filter((c): c is FixedCost => c !== null).slice(0, MAX_FIXED_COSTS);
  await setSetting(FIXED_COSTS_KEY, JSON.stringify(clean), userId);
  cacheInvalidate([PULSE_CACHE_KEY]);
  return clean;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function expensesBetween(db: Db, start: Date, end: Date) {
  const [row] = await db
    .select({ usd: sql<string>`COALESCE(SUM(${expenses.amountUsd}), 0)`, count: sql<number>`COUNT(*)` })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, start), lte(expenses.expenseDate, end)));
  return { usd: num(row?.usd), count: Number(row?.count) || 0 };
}

/** How many rows a table gained in each of the last ten weeks, newest first. */
async function weeklyCounts(db: Db, table: "fullPackageOrders" | "packages"): Promise<number[]> {
  const live = table === "fullPackageOrders" ? sql.raw(`AND ${LIVE_SALE_SQL}`) : sql.raw("");
  // The database's own clock on both sides, so its time zone cannot shift a week.
  const [rows] = (await db.execute(sql`
    SELECT FLOOR(TIMESTAMPDIFF(HOUR, createdAt, NOW()) / 168) AS w, COUNT(*) AS n
    FROM ${sql.raw(table)}
    WHERE createdAt >= NOW() - INTERVAL 70 DAY AND createdAt <= NOW() ${live}
    GROUP BY w
  `)) as unknown as [Array<{ w: number | string; n: number | string }>];
  const weeks = Array.from({ length: 10 }, () => 0);
  for (const r of rows ?? []) {
    const w = Number(r.w);
    if (w >= 0 && w < 10) weeks[w] = Number(r.n) || 0;
  }
  return weeks;
}

async function partnerDraws(db: Db, now: Date): Promise<PartnerDraw[]> {
  const from30 = new Date(now.getTime() - 30 * DAY);
  const from120 = new Date(now.getTime() - 120 * DAY);
  const rows = await db
    .select({
      partnerId: partnerTransactions.partnerId,
      last30: sql<string>`COALESCE(SUM(CASE WHEN ${partnerTransactions.transactionDate} >= ${from30} THEN ${partnerTransactions.amountUsd} ELSE 0 END), 0)`,
      prior90: sql<string>`COALESCE(SUM(CASE WHEN ${partnerTransactions.transactionDate} < ${from30} THEN ${partnerTransactions.amountUsd} ELSE 0 END), 0)`,
    })
    .from(partnerTransactions)
    .where(and(eq(partnerTransactions.transactionType, "withdrawal"), gte(partnerTransactions.transactionDate, from120)))
    .groupBy(partnerTransactions.partnerId);
  const names = await db.select({ id: partners.id, name: partners.name, nameKu: partners.nameKu }).from(partners);
  return rows.map((r) => {
    const p = names.find((x) => x.id === r.partnerId);
    return { name: p?.nameKu || p?.name || `#${r.partnerId}`, last30Usd: num(r.last30), prior90Usd: num(r.prior90) };
  });
}

/**
 * Will the month cover its costs, are orders drying up, is a partner taking
 * too much — everything shared/financePulse judges, read once and kept ten
 * minutes: the bell asks often and none of this moves by the minute.
 */
export async function getFinancePulse(now: Date = new Date()) {
  return cacheGetOrSet(PULSE_CACHE_KEY, PULSE_TTL_MS, async () => {
    const db = await getDb();
    const costs = await getFixedCosts();
    const needMonthlyUsd = monthlyNeedUsd(costs);
    const month = periodBounds("month", now);
    // A day past now: a row stamped by a database on local time must not fall
    // outside the window (see workingCapital.db).
    const until = new Date(now.getTime() + DAY);
    const since = (days: number) => new Date(now.getTime() - days * DAY);
    if (!db) {
      const p = pulse({ needMonthlyUsd, profit7Usd: 0, profit14Usd: 0, profit30Usd: 0, monthProfitSoFarUsd: 0, dayOfMonth: month.dayOfMonth, daysInMonth: month.daysInMonth });
      return { costs, needMonthlyUsd, actualMonthlyUsd: 0, pulse: p, orders: flow([]), parcels: flow([]), draws: draws([], 0, 0), monthExpensesUsd: 0 };
    }

    const threeMonthsAgo = new Date(month.start.getTime() - 92 * DAY);
    const [p7, p14, p30, pMonth, spent30, spentMonth, spent3, orderWeeks, parcelWeeks, partnerRows] = await Promise.all([
      getProfitForPeriod(since(7), until),
      getProfitForPeriod(since(14), until),
      getProfitForPeriod(since(30), until),
      getProfitForPeriod(month.start, until),
      expensesBetween(db, since(30), until),
      expensesBetween(db, month.start, until),
      expensesBetween(db, threeMonthsAgo, new Date(month.start.getTime() - 1)),
      weeklyCounts(db, "fullPackageOrders"),
      weeklyCounts(db, "packages"),
      partnerDraws(db, now),
    ]);

    return {
      costs,
      needMonthlyUsd,
      /** What was really spent in an average month of the last three. */
      actualMonthlyUsd: cents(spent3.usd / 3),
      pulse: pulse({
        needMonthlyUsd,
        profit7Usd: num(p7.total.profit),
        profit14Usd: num(p14.total.profit),
        profit30Usd: num(p30.total.profit),
        monthProfitSoFarUsd: num(pMonth.total.profit),
        dayOfMonth: month.dayOfMonth,
        daysInMonth: month.daysInMonth,
      }),
      orders: flow(orderWeeks),
      parcels: flow(parcelWeeks),
      draws: draws(partnerRows, num(p30.total.profit), spent30.usd),
      monthExpensesUsd: spentMonth.usd,
    };
  });
}

/** What the bell needs of it: three numbers, each zero when there is nothing to say. */
export async function getFinancePulseRisks(): Promise<{ lossForecastUsd: number; ordersThisWeek: number; ordersSlow: boolean; partnerOverdrawUsd: number }> {
  const p = await getFinancePulse();
  return {
    // How far short: of the month when the forecast is a loss, otherwise of
    // the fortnight that tripped it.
    lossForecastUsd: p.pulse.level !== "danger"
      ? 0
      : Math.max(1, Math.round(p.pulse.forecastResultUsd < 0 ? -p.pulse.forecastResultUsd : (p.pulse.needDailyUsd - p.pulse.avg14Usd) * 14)),
    ordersThisWeek: p.orders.thisWeek,
    ordersSlow: p.orders.slow,
    partnerOverdrawUsd: p.draws.eatingCapital ? Math.max(1, Math.round(p.draws.fromCapitalUsd)) : 0,
  };
}

/** Discounts given in a window, one by one: to whom, how much, why, by whom. */
async function discountsBetween(db: Db, start: Date, end: Date) {
  const rows = await db
    .select({
      lineId: boxSettlementLines.id,
      usd: boxSettlementLines.discountUsd,
      reason: boxSettlementLines.discountReason,
      note: boxSettlementLines.discountNote,
      at: boxSettlements.createdAt,
      settlementNumber: boxSettlements.settlementNumber,
      boxId: boxSettlements.boxId,
      boxCode: deliveryBoxes.boxCode,
      customerId: boxSettlements.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      by: users.name,
    })
    .from(boxSettlementLines)
    .innerJoin(boxSettlements, eq(boxSettlements.id, boxSettlementLines.settlementId))
    .leftJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .leftJoin(customers, eq(customers.id, boxSettlements.customerId))
    .leftJoin(users, eq(users.id, boxSettlements.createdById))
    .where(and(
      eq(boxSettlements.status, "confirmed"),
      gt(boxSettlementLines.discountUsd, "0"),
      gte(boxSettlements.createdAt, start),
      lte(boxSettlements.createdAt, end),
    ))
    .orderBy(desc(boxSettlements.createdAt))
    .limit(300);
  const list = rows.map((r) => ({ ...r, usd: num(r.usd) }));
  return { usd: cents(list.reduce((s, r) => s + r.usd, 0)), count: list.length, list };
}

async function oldDebt(db: Db, now: Date) {
  const ages = await getDebtAges();
  const cutoff = now.getTime() - OLD_DEBT_DAYS * DAY;
  const oldIds = ages.filter((a) => a.oldestUnpaidAt && new Date(a.oldestUnpaidAt).getTime() < cutoff).map((a) => a.accountId);
  if (oldIds.length === 0) return { usd: 0, count: 0 };
  const [row] = await db
    .select({ usd: sql<string>`COALESCE(SUM(${customerAccounts.currentBalanceUsd}), 0)`, count: sql<number>`COUNT(*)` })
    .from(customerAccounts)
    .where(and(inArray(customerAccounts.id, oldIds), gt(customerAccounts.currentBalanceUsd, "0")));
  return { usd: num(row?.usd), count: Number(row?.count) || 0 };
}

async function topDebtors(db: Db, totalDebtUsd: number) {
  const rows = await db
    .select({ customerId: customerAccounts.customerId, usd: customerAccounts.currentBalanceUsd, code: customers.customerCode, name: customers.fullName })
    .from(customerAccounts)
    .leftJoin(customers, eq(customers.id, customerAccounts.customerId))
    .where(gt(customerAccounts.currentBalanceUsd, "0"))
    .orderBy(desc(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`))
    .limit(3);
  return rows.map((r) => ({
    customerId: r.customerId,
    code: r.code,
    name: r.name,
    usd: num(r.usd),
    sharePct: totalDebtUsd > 0 ? Math.round((num(r.usd) / totalDebtUsd) * 100) : 0,
  }));
}

/** Batches that have arrived and still say nothing of what they cost. */
async function arrivedBatchesWithoutCost(db: Db): Promise<number> {
  const rows = await db
    .select({ shippingType: batches.shippingType, costPerKg: batches.costPerKg, costPerCbm: batches.costPerCbm, shippingCost: batches.shippingCost })
    .from(batches)
    .where(inArray(batches.status, ["arrived", "customs", "at_depot", "delivered", "closed"]));
  return rows.filter((b) => batchMissingCost(b)).length;
}

async function lossBatches(db: Db, start: Date, end: Date) {
  const rows = (await getBatchProfitRowsInPeriod(db, start, end)).filter((r) => !r.waiting && r.revenueInPeriod < r.allocatedCost);
  if (rows.length === 0) return [];
  const codes = await db.select({ id: batches.id, code: batches.batchCode }).from(batches).where(inArray(batches.id, rows.map((r) => r.batchId)));
  return rows
    .map((r) => ({ batchId: r.batchId, code: codes.find((c) => c.id === r.batchId)?.code ?? `#${r.batchId}`, lossUsd: cents(r.allocatedCost - r.revenueInPeriod) }))
    .sort((a, b) => b.lossUsd - a.lossUsd)
    .slice(0, 5);
}

async function withdrawalsBetween(db: Db, start: Date, end: Date) {
  const rows = await db
    .select({ partnerId: partnerTransactions.partnerId, usd: sql<string>`COALESCE(SUM(${partnerTransactions.amountUsd}), 0)` })
    .from(partnerTransactions)
    .where(and(eq(partnerTransactions.transactionType, "withdrawal"), gte(partnerTransactions.transactionDate, start), lte(partnerTransactions.transactionDate, end)))
    .groupBy(partnerTransactions.partnerId);
  return cents(rows.reduce((s, r) => s + num(r.usd), 0));
}

/**
 * The finance dashboard, whole (owner, 2026-10-06: "simple — and everything
 * on it links back to where it came from"). Each figure is read by the same
 * function its own page reads, so a number here and the list behind its link
 * cannot disagree. `mainAdmin` adds where the capital is, which is his alone.
 */
export async function getFinanceDashboard(period: DashboardPeriod, mainAdmin: boolean, now: Date = new Date()) {
  const db = await getDb();
  if (!db) return null;
  const bounds = periodBounds(period, now);
  const end = period === "lastMonth" ? bounds.end : new Date(now.getTime() + DAY);

  const settle = async <T>(work: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await work();
    } catch {
      return fallback;
    }
  };

  const [profit, spent, received, discounts, tookOut, ledger, pulseNow, unbilled, unsent, noCost, losers] = await Promise.all([
    getProfitForPeriod(bounds.start, end),
    expensesBetween(db, bounds.start, end),
    period === "month" ? getMoneyReceived(now).then((r) => r.month) : receivedBetween(db, bounds.start, end),
    discountsBetween(db, bounds.start, end),
    withdrawalsBetween(db, bounds.start, end),
    getFinancialSummary(),
    getFinancePulse(now),
    settle(async () => (await findUnbilledArrivedOrders()).filter((o) => !o.paidOnReceipt).length, 0),
    settle(async () => (await listUnsentPaymentWhatsApp()).length, 0),
    settle(() => arrivedBatchesWithoutCost(db), 0),
    settle(() => lossBatches(db, bounds.start, end), []),
  ]);
  const [stuck, top, capital] = await Promise.all([
    settle(() => oldDebt(db, now), { usd: 0, count: 0 }),
    settle(() => topDebtors(db, ledger.totalDebtUsd), []),
    mainAdmin ? settle(() => getWorkingCapital(), null) : Promise.resolve(null),
  ]);

  const freightProfitUsd = num(profit.pkgs.profit);
  const ordersProfitUsd = num(profit.fullPackage.profit) + num(profit.purchaseRequest.profit) + num(profit.commission.profit);
  const workProfitUsd = cents(freightProfitUsd + ordersProfitUsd);

  return {
    period,
    received,
    profit: {
      freightUsd: cents(freightProfitUsd),
      parcels: Number(profit.pkgs.count) || 0,
      ordersUsd: cents(ordersProfitUsd),
      orders: (Number(profit.fullPackage.count) || 0) + (Number(profit.purchaseRequest.count) || 0) + (Number(profit.commission.count) || 0),
      workUsd: workProfitUsd,
      expensesUsd: spent.usd,
      expenseCount: spent.count,
      netUsd: cents(workProfitUsd - spent.usd),
    },
    // Information, never a cost line (owner, 2026-10-07: a discount is not an expense).
    discounts,
    partnersTookOutUsd: tookOut,
    debt: { usd: ledger.totalDebtUsd, debtors: Number(ledger.debtorsCount) || 0, old: stuck, top },
    pulse: pulseNow,
    waiting: { batchesWithoutCost: noCost, unbilledArrived: unbilled, whatsappUnsent: unsent, oldDebtors: stuck.count },
    lossBatches: losers,
    capital: capital
      ? {
          shouldHoldUsd: capital.shouldHoldUsd,
          debtUsd: capital.facts.debtUsd,
          goodsOnRoadUsd: capital.facts.goodsOnRoadUsd,
          netCashUsd: capital.netCashUsd,
          /** How many days of running costs the cash in hand would pay. */
          cashDays: pulseNow.pulse.needDailyUsd > 0 ? Math.floor(Math.max(0, capital.netCashUsd) / pulseNow.pulse.needDailyUsd) : null,
        }
      : null,
  };
}

async function receivedBetween(db: Db, start: Date, end: Date) {
  const { paymentRecords } = await import("../../drizzle/schema");
  const net = sql`GREATEST(COALESCE(${paymentRecords.amountUsd}, 0) - COALESCE(${paymentRecords.reversedAmountUsd}, 0), 0)`;
  const [row] = await db
    .select({ usd: sql<string>`COALESCE(SUM(${net}), 0)`, count: sql<number>`COALESCE(SUM(CASE WHEN ${net} > 0 THEN 1 ELSE 0 END), 0)` })
    .from(paymentRecords)
    .where(and(gte(paymentRecords.createdAt, start), lte(paymentRecords.createdAt, end)));
  return { usd: num(row?.usd), count: Number(row?.count) || 0 };
}
