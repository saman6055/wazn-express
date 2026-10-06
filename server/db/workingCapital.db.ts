import { and, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { expenses, fullPackageOrders, partners, partnerTransactions, paymentRecords } from "../../drizzle/schema";
import { LIVE_SALE_SQL } from "@shared/orderProfit";
import {
  WORKING_CAPITAL_CHECK_KEY,
  cashCheck,
  parseStoredCashCheck,
  receivedWindows,
  workingCapital,
  type MoneyReceived,
  type StoredCashCheck,
  type WorkingCapitalFacts,
} from "@shared/workingCapital";
import { getFinancialSummary } from "./finance.db";
import { getProfitForPeriod } from "./reports.db";
import { getStockHeld } from "./refusedGoods.db";
import { getSetting, setSetting } from "./settings.db";

const num = (v: unknown) => Number(v ?? 0) || 0;

/**
 * Everything shared/workingCapital needs, read from where each thing is
 * already written. Read only — nothing here is typed and nothing moves.
 */
export async function getWorkingCapitalFacts(): Promise<WorkingCapitalFacts> {
  const empty: WorkingCapitalFacts = {
    capitalUsd: 0, profitUsd: 0, expensesUsd: 0, withdrawals: [],
    debtUsd: 0, debtors: 0, creditUsd: 0,
    goodsOnRoadUsd: 0, goodsOnRoadCostUsd: 0, goodsOnRoadCount: 0,
    stockUsd: 0, stockCount: 0,
  };
  const db = await getDb();
  if (!db) return empty;

  const [partnerRows, moves, [spent], [goods], ledger, profit, stock] = await Promise.all([
    db.select({ id: partners.id, name: partners.name, nameKu: partners.nameKu, initialCapital: partners.initialCapital }).from(partners),
    db
      .select({
        partnerId: partnerTransactions.partnerId,
        type: partnerTransactions.transactionType,
        usd: sql<string>`COALESCE(SUM(${partnerTransactions.amountUsd}), 0)`,
      })
      .from(partnerTransactions)
      .groupBy(partnerTransactions.partnerId, partnerTransactions.transactionType),
    db.select({ usd: sql<string>`COALESCE(SUM(${expenses.amountUsd}), 0)` }).from(expenses),
    // The same per-unit rule the profit report prices an order by
    // (getProfitForPeriod): a commission order is item + fee, the rest sell.
    db
      .select({
        count: sql<number>`COUNT(*)`,
        sell: sql<string>`COALESCE(SUM(CASE WHEN orderType = 'commission' THEN (itemPriceUsd + commissionFeeUsd) * quantity ELSE sellingPriceUsd * quantity END), 0)`,
        cost: sql<string>`COALESCE(SUM(CASE WHEN orderType = 'commission' THEN itemPriceUsd * quantity ELSE purchasePriceUsd * quantity END), 0)`,
      })
      .from(fullPackageOrders)
      .where(and(sql`COALESCE(${fullPackageOrders.isCharged}, 0) = 0`, sql.raw(LIVE_SALE_SQL))),
    getFinancialSummary(),
    // A day past now: a row stamped by a database on local time must not
    // fall outside "all time".
    getProfitForPeriod(new Date("2000-01-01T00:00:00Z"), new Date(Date.now() + 86_400_000)),
    getStockHeld(),
  ]);

  const sumOf = (partnerId: number, type: string) =>
    moves.filter((m) => m.partnerId === partnerId && m.type === type).reduce((s, m) => s + num(m.usd), 0);

  return {
    // Corrections count: a contribution entered under the wrong partner is
    // undone by a negative adjustment (shared/partnerLedger), never deleted.
    capitalUsd: partnerRows.reduce((s, p) => s + num(p.initialCapital) + sumOf(p.id, "capital_contribution") + sumOf(p.id, "adjustment"), 0),
    profitUsd: num(profit.total.profit),
    expensesUsd: num(spent?.usd),
    withdrawals: partnerRows
      .map((p) => ({ name: p.nameKu || p.name, usd: sumOf(p.id, "withdrawal") }))
      .filter((w) => w.usd > 0),
    debtUsd: ledger.totalDebtUsd,
    debtors: Number(ledger.debtorsCount) || 0,
    creditUsd: ledger.totalCreditUsd,
    goodsOnRoadUsd: num(goods?.sell),
    goodsOnRoadCostUsd: num(goods?.cost),
    goodsOnRoadCount: Number(goods?.count) || 0,
    stockUsd: stock.usd,
    stockCount: stock.count,
  };
}

/**
 * Money customers paid — today, this week, this month — less whatever was
 * undone of it (the same net the payments page shows). One read: the month
 * holds the week and the week holds the day, except in a month's first days,
 * when the week reaches back before it.
 */
export async function getMoneyReceived(now: Date = new Date()): Promise<{ today: MoneyReceived; week: MoneyReceived; month: MoneyReceived }> {
  const none = { count: 0, usd: 0 };
  const db = await getDb();
  if (!db) return { today: none, week: none, month: none };
  const w = receivedWindows(now);
  const earliest = w.week < w.month ? w.week : w.month;
  const net = sql`GREATEST(COALESCE(${paymentRecords.amountUsd}, 0) - COALESCE(${paymentRecords.reversedAmountUsd}, 0), 0)`;
  const since = (from: Date) => ({
    count: sql<number>`COALESCE(SUM(CASE WHEN ${paymentRecords.createdAt} >= ${from} AND ${net} > 0 THEN 1 ELSE 0 END), 0)`,
    usd: sql<string>`COALESCE(SUM(CASE WHEN ${paymentRecords.createdAt} >= ${from} THEN ${net} ELSE 0 END), 0)`,
  });
  const t = since(w.today), k = since(w.week), m = since(w.month);
  const [row] = await db
    .select({ tc: t.count, tu: t.usd, kc: k.count, ku: k.usd, mc: m.count, mu: m.usd })
    .from(paymentRecords)
    .where(sql`${paymentRecords.createdAt} >= ${earliest}`);
  return {
    today: { count: Number(row?.tc) || 0, usd: num(row?.tu) },
    week: { count: Number(row?.kc) || 0, usd: num(row?.ku) },
    month: { count: Number(row?.mc) || 0, usd: num(row?.mu) },
  };
}

export async function getWorkingCapital() {
  const [facts, received, check] = await Promise.all([getWorkingCapitalFacts(), getMoneyReceived(), getSetting(WORKING_CAPITAL_CHECK_KEY)]);
  return { facts, ...workingCapital(facts), received, lastCheck: parseStoredCashCheck(check) };
}

/**
 * A count, kept as "last check" beside the figure it was measured against.
 * It is never added to anything: tomorrow that money is somewhere else.
 */
export async function recordWorkingCapitalCheck(haveUsd: number, oweUsd: number, userId: number): Promise<StoredCashCheck> {
  const { netCashUsd } = workingCapital(await getWorkingCapitalFacts());
  const { unwrittenUsd } = cashCheck(netCashUsd, haveUsd, oweUsd);
  const stored: StoredCashCheck = { haveUsd, oweUsd, netCashUsd, unwrittenUsd, at: new Date().toISOString() };
  await setSetting(WORKING_CAPITAL_CHECK_KEY, JSON.stringify(stored), userId);
  return stored;
}
