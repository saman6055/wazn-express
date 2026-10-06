/**
 * The danger bell: will this month's work cover what the company costs?
 *
 * Owner, 2026-10-07: "the system should know that under about $100 of profit
 * a day the expenses are not covered — for the day, the week, the month. But
 * count the averages: the market is not the same every day, some days are
 * slow and some are busy." And: costs rise and fall (the office may move
 * somewhere cheaper), a partner taking out too much is a danger too, and few
 * orders is the early sign.
 *
 * So nothing here judges one day. Profit is read as an average over 7, 14 and
 * 30 days, and the month is forecast from what it has made so far plus the
 * usual day for the days still to come.
 *
 * The running costs are a short list the owner types — unlike cash, which is
 * somewhere else by morning, rent and salaries change a few times a year. The
 * real expenses are shown beside it so the list cannot drift from the truth
 * unnoticed.
 */

export type CostCurrency = "USD" | "IQD" | "RMB";
export type CostPer = "month" | "day";

export interface FixedCost {
  name: string;
  amount: number;
  currency: CostCurrency;
  /** Units of that currency to one dollar (1 for USD). */
  rate: number;
  per: CostPer;
}

/** A month is thirty days here: a daily need that changed with the calendar would be noise. */
export const PULSE_DAYS_IN_MONTH = 30;

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function fixedCostMonthlyUsd(c: FixedCost): number {
  const rate = c.currency === "USD" ? 1 : Number(c.rate);
  if (!(rate > 0) || !(Number(c.amount) > 0)) return 0;
  return cents((Number(c.amount) / rate) * (c.per === "day" ? PULSE_DAYS_IN_MONTH : 1));
}

export function monthlyNeedUsd(costs: readonly FixedCost[]): number {
  return cents(costs.reduce((sum, c) => sum + fixedCostMonthlyUsd(c), 0));
}

/** The owner's own figures of 2026-10-07 — what the list starts as until he edits it. */
export const DEFAULT_FIXED_COSTS: readonly FixedCost[] = [
  { name: "کرێی بینا", amount: 1200, currency: "USD", rate: 1, per: "month" },
  { name: "مووەزەف", amount: 750000, currency: "IQD", rate: 1550, per: "month" },
  { name: "مووەزەفی چین", amount: 2100, currency: "RMB", rate: 7.1, per: "month" },
  { name: "مەسارفی ڕۆژانە", amount: 10000, currency: "IQD", rate: 1550, per: "day" },
  { name: "بەنزین", amount: 100000, currency: "IQD", rate: 1550, per: "month" },
  { name: "ئەنتەرنێت", amount: 29000, currency: "IQD", rate: 1550, per: "month" },
  { name: "کارەبا", amount: 20000, currency: "IQD", rate: 1550, per: "month" },
];

export const FIXED_COSTS_KEY = "finance.fixedCosts";
export const MAX_FIXED_COSTS = 40;

/** One row as stored or typed, made safe; null when it says nothing. */
export function cleanFixedCost(raw: unknown): FixedCost | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name ?? "").trim().slice(0, 80);
  const amount = Number(r.amount);
  const currency: CostCurrency = r.currency === "IQD" || r.currency === "RMB" ? r.currency : "USD";
  const rate = currency === "USD" ? 1 : Number(r.rate);
  if (!name || !(amount > 0) || !(rate > 0)) return null;
  return { name, amount, currency, rate, per: r.per === "day" ? "day" : "month" };
}

/** The stored list; the owner's own figures when nothing has been saved yet. */
export function parseFixedCosts(raw: string | null | undefined): FixedCost[] {
  if (!raw) return [...DEFAULT_FIXED_COSTS];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [...DEFAULT_FIXED_COSTS];
    return list.map(cleanFixedCost).filter((c): c is FixedCost => c !== null).slice(0, MAX_FIXED_COSTS);
  } catch {
    return [...DEFAULT_FIXED_COSTS];
  }
}

// ---------------------------------------------------------------------------
// Will the month cover its costs?
// ---------------------------------------------------------------------------

export type PulseLevel = "ok" | "watch" | "danger";

export interface PulseInput {
  needMonthlyUsd: number;
  /** Work profit over the last 7, 14 and 30 days. */
  profit7Usd: number;
  profit14Usd: number;
  profit30Usd: number;
  /** Work profit since the first of this month. */
  monthProfitSoFarUsd: number;
  /** Which day of the month today is, and how long the month is. */
  dayOfMonth: number;
  daysInMonth: number;
}

export interface Pulse {
  needDailyUsd: number;
  avg7Usd: number;
  avg14Usd: number;
  avg30Usd: number;
  /** What the month is expected to make by its last day. */
  forecastProfitUsd: number;
  /** Forecast less the month's costs: negative is an expected loss. */
  forecastResultUsd: number;
  level: PulseLevel;
  /** Why it is not "ok" — which of the three readings tripped it. */
  reason: "none" | "week-slow" | "fortnight-slow" | "month-loss";
}

export function pulse(i: PulseInput): Pulse {
  const needDailyUsd = cents(i.needMonthlyUsd / PULSE_DAYS_IN_MONTH);
  const avg7Usd = cents(i.profit7Usd / 7);
  const avg14Usd = cents(i.profit14Usd / 14);
  const avg30Usd = cents(i.profit30Usd / 30);
  const daysLeft = Math.max(0, Math.round(i.daysInMonth) - Math.round(i.dayOfMonth));
  const forecastProfitUsd = cents(i.monthProfitSoFarUsd + daysLeft * avg30Usd);
  const forecastResultUsd = cents(forecastProfitUsd - i.needMonthlyUsd);

  let level: PulseLevel = "ok";
  let reason: Pulse["reason"] = "none";
  if (i.needMonthlyUsd > 0) {
    if (forecastResultUsd < 0) {
      level = "danger";
      reason = "month-loss";
    } else if (avg14Usd < needDailyUsd) {
      level = "danger";
      reason = "fortnight-slow";
    } else if (avg7Usd < needDailyUsd) {
      // One slow week inside a month that still covers itself: worth a look,
      // not worth a bell.
      level = "watch";
      reason = "week-slow";
    }
  }
  return { needDailyUsd, avg7Usd, avg14Usd, avg30Usd, forecastProfitUsd, forecastResultUsd, level, reason };
}

// ---------------------------------------------------------------------------
// Few orders — the sign that comes before the profit drops
// ---------------------------------------------------------------------------

export interface Flow {
  thisWeek: number;
  lastWeek: number;
  /** The usual week: the average of the eight before those two. */
  usualWeek: number;
  slow: boolean;
}

/** Below this a "usual week" is too thin to call anything slow. */
export const FLOW_MIN_USUAL = 5;

/**
 * `weeks[0]` is the last seven days, `weeks[1]` the seven before, and so on.
 * Slow means two weeks running under half the usual — one quiet week is the
 * market, two is a trend.
 */
export function flow(weeks: readonly number[]): Flow {
  const at = (n: number) => Math.max(0, Number(weeks[n]) || 0);
  const earlier = weeks.slice(2, 10).map((w) => Math.max(0, Number(w) || 0));
  const usualWeek = earlier.length > 0 ? Math.round((earlier.reduce((s, w) => s + w, 0) / earlier.length) * 10) / 10 : 0;
  const thisWeek = at(0);
  const lastWeek = at(1);
  const slow = usualWeek >= FLOW_MIN_USUAL && thisWeek < usualWeek / 2 && lastWeek < usualWeek / 2;
  return { thisWeek, lastWeek, usualWeek, slow };
}

// ---------------------------------------------------------------------------
// A partner taking out too much
// ---------------------------------------------------------------------------

export interface PartnerDraw {
  name: string;
  /** Taken out in the last 30 days. */
  last30Usd: number;
  /** Taken out in the 90 days before that. */
  prior90Usd: number;
}

export interface Draws {
  totalLast30Usd: number;
  /** Work profit less expenses over the same 30 days. */
  netProfit30Usd: number;
  /** More went to partners than the company made: it came out of capital. */
  eatingCapital: boolean;
  /** How much of it came out of capital. */
  fromCapitalUsd: number;
  /** Partners who took well over their own usual month. */
  spikes: Array<{ name: string; last30Usd: number; usualMonthUsd: number }>;
}

/** Half again over the usual month, and by enough dollars to matter. */
export const DRAW_SPIKE_FACTOR = 1.5;
export const DRAW_SPIKE_MIN_USD = 100;

export function draws(partners: readonly PartnerDraw[], profit30Usd: number, expenses30Usd: number): Draws {
  const totalLast30Usd = cents(partners.reduce((s, p) => s + (Number(p.last30Usd) || 0), 0));
  const netProfit30Usd = cents(profit30Usd - expenses30Usd);
  const fromCapitalUsd = cents(Math.max(0, totalLast30Usd - Math.max(0, netProfit30Usd)));
  const spikes = partners
    .map((p) => ({ name: p.name, last30Usd: cents(p.last30Usd), usualMonthUsd: cents((Number(p.prior90Usd) || 0) / 3) }))
    .filter((p) => p.usualMonthUsd > 0 && p.last30Usd > p.usualMonthUsd * DRAW_SPIKE_FACTOR && p.last30Usd - p.usualMonthUsd >= DRAW_SPIKE_MIN_USD);
  return { totalLast30Usd, netProfit30Usd, eatingCapital: totalLast30Usd > 0 && fromCapitalUsd > 0, fromCapitalUsd, spikes };
}

// ---------------------------------------------------------------------------
// Periods the dashboard reads, on the office's clock
// ---------------------------------------------------------------------------

export type DashboardPeriod = "month" | "lastMonth" | "year";

const BAGHDAD_OFFSET_MS = 3 * 3_600_000;

export interface PeriodBounds {
  start: Date;
  end: Date;
  /** Today's day of the month and the month's length, in Baghdad. */
  dayOfMonth: number;
  daysInMonth: number;
}

export function periodBounds(period: DashboardPeriod, now: Date = new Date()): PeriodBounds {
  const local = new Date(now.getTime() + BAGHDAD_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const startOf = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) - BAGHDAD_OFFSET_MS);
  const dayOfMonth = local.getUTCDate();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  if (period === "lastMonth") return { start: startOf(y, m - 1, 1), end: new Date(startOf(y, m, 1).getTime() - 1), dayOfMonth, daysInMonth };
  if (period === "year") return { start: startOf(y, 0, 1), end: now, dayOfMonth, daysInMonth };
  return { start: startOf(y, m, 1), end: now, dayOfMonth, daysInMonth };
}

/** A debt this old is money that is stuck, not money on its way. */
export const OLD_DEBT_DAYS = 30;
