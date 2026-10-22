/**
 * The yuan rate's history (owner, 2026-10-22: "every change and every earlier
 * price must stay in the archive"). Each RMB rate set in Settings opens a
 * period that lasts until the next one; the orders entered in it are counted
 * there - how many, their dollars and their yuan.
 *
 * An order's yuan is the amount the form saved with it (itemPriceCny for a
 * commission, purchasePriceCny for a full package, per unit). Orders entered
 * before the forms saved it have only dollars: their yuan is estimated at the
 * period's rate and counted as estimated, never shown as if it was typed.
 *
 * Read-only: nothing here re-prices an order (owner: never re-price old ones).
 */

export interface YuanRateRow {
  id: number;
  rate: number;
  effectiveFrom: string;
  createdByName: string | null;
}

export interface YuanOrderRow {
  orderType: string;
  quantity: number;
  itemPriceUsd: number | null;
  itemPriceCny: number | null;
  purchasePriceUsd: number | null;
  purchasePriceCny: number | null;
  createdAt: string;
}

export interface YuanRatePeriod {
  rateId: number | null;
  rate: number;
  from: string | null;
  to: string | null;
  setBy: string | null;
  orders: number;
  usd: number;
  yuan: number;
  /** Orders whose yuan had to be estimated at the period's rate. */
  estimatedOrders: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Dollars and yuan of one order line (all units). Null when it has no price. */
export function orderYuan(o: YuanOrderRow, periodRate: number): { usd: number; yuan: number; estimated: boolean } | null {
  const qty = Math.max(1, Number(o.quantity) || 1);
  const commission = o.orderType === "commission";
  const usdUnit = Number(commission ? o.itemPriceUsd : o.purchasePriceUsd) || 0;
  const cnyUnit = Number(commission ? o.itemPriceCny : o.purchasePriceCny) || 0;
  if (usdUnit <= 0 && cnyUnit <= 0) return null;
  if (cnyUnit > 0) return { usd: usdUnit * qty, yuan: cnyUnit * qty, estimated: false };
  return { usd: usdUnit * qty, yuan: usdUnit * qty * periodRate, estimated: true };
}

/**
 * Newest period first. Orders older than the first rate fall into a period
 * with no rate of its own; their yuan is estimated at the first rate known.
 */
export function buildYuanRateHistory(ratesIn: YuanRateRow[], orders: YuanOrderRow[]): YuanRatePeriod[] {
  const rates = [...ratesIn].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.id - b.id);
  const periods: YuanRatePeriod[] = rates.map((r, i) => ({
    rateId: r.id,
    rate: r.rate,
    from: r.effectiveFrom,
    to: rates[i + 1]?.effectiveFrom ?? null,
    setBy: r.createdByName,
    orders: 0,
    usd: 0,
    yuan: 0,
    estimatedOrders: 0,
  }));
  const before: YuanRatePeriod = { rateId: null, rate: rates[0]?.rate ?? 0, from: null, to: rates[0]?.effectiveFrom ?? null, setBy: null, orders: 0, usd: 0, yuan: 0, estimatedOrders: 0 };
  for (const o of orders) {
    let p = before;
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].from! <= o.createdAt) { p = periods[i]; break; }
    }
    const v = orderYuan(o, p.rate);
    if (!v) continue;
    p.orders += 1;
    p.usd += v.usd;
    p.yuan += v.yuan;
    if (v.estimated) p.estimatedOrders += 1;
  }
  const all = before.orders > 0 ? [before, ...periods] : periods;
  return all.map((p) => ({ ...p, usd: cents(p.usd), yuan: cents(p.yuan) })).reverse();
}

/**
 * What a period earned or lost on the rate, given the yuan's real buying rate:
 * the customers were charged its dollars; the yuan cost yuan ÷ real rate.
 */
export function rateGainUsd(p: Pick<YuanRatePeriod, "usd" | "yuan">, realRate: number): number | null {
  if (!(realRate > 0)) return null;
  return cents(p.usd - p.yuan / realRate);
}
