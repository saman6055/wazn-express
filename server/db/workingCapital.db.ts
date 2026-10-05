import { and, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { expenses, fullPackageOrders, partners, partnerTransactions } from "../../drizzle/schema";
import { LIVE_SALE_SQL } from "@shared/orderProfit";
import {
  WORKING_CAPITAL_CHECK_KEY,
  cashCheck,
  parseStoredCashCheck,
  workingCapital,
  type StoredCashCheck,
  type WorkingCapitalFacts,
} from "@shared/workingCapital";
import { getFinancialSummary } from "./finance.db";
import { getProfitForPeriod } from "./reports.db";
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
  };
  const db = await getDb();
  if (!db) return empty;

  const [partnerRows, moves, [spent], [goods], ledger, profit] = await Promise.all([
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
  };
}

export async function getWorkingCapital() {
  const facts = await getWorkingCapitalFacts();
  const lastCheck = parseStoredCashCheck(await getSetting(WORKING_CAPITAL_CHECK_KEY));
  return { facts, ...workingCapital(facts), lastCheck };
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
