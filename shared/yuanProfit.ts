/**
 * What selling yuan earns — for the office to see before it saves a rate
 * (owner, 2026-09-18, Portal Center phase 4).
 *
 * The company sells yuan at its rate: yuan per 1 dollar, so the customer pays
 * $1 and receives `sellRate` yuan. It buys yuan at the market's rate, also
 * yuan per 1 dollar. Handing over `sellRate` yuan therefore costs it
 * sellRate / marketRate dollars, and each dollar sold earns what is left.
 *
 * A display only: nothing is charged, stored or sent from these figures. The
 * market rate is not kept by the system either — the office types it.
 */

const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** What one dollar sold earns, in dollars; negative is a loss. Null without both rates. */
export function yuanProfitPerUsd(sellRate: number, marketRate: number): number | null {
  if (!positive(sellRate) || !positive(marketRate)) return null;
  return 1 - sellRate / marketRate;
}

/**
 * What orders already taken earn at today's market rate: the dollars they
 * brought in, less what their yuan cost today. Each order kept the rate it
 * was taken at, so this reads their totals rather than a rate.
 */
export function yuanOrdersProfit(totals: { usd: number; cny: number }, marketRate: number): number | null {
  if (!positive(marketRate)) return null;
  const usd = Number(totals.usd) || 0;
  const cny = Number(totals.cny) || 0;
  if (usd === 0 && cny === 0) return 0;
  return usd - cny / marketRate;
}

/** Statuses of an order still to be handed over. */
export const OPEN_YUAN_STATUSES = ["pending", "processing"] as const;
