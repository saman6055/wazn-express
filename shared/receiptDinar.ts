/**
 * A box receipt's closing figures in Iraqi dinars.
 *
 * Owner, 2026-09-17: the counter used to convert the dollar total to dinars
 * by hand, take off any advance the customer had handed over, and write the
 * result on the receipt with a pen. Now the person printing gives the day's
 * rate (and the advance, if there was one) just before printing, and the
 * receipt carries the figures.
 *
 * His rules, from the mockups he approved (example 4):
 *
 *  - The advance here is money received by hand and never entered. It
 *    changes the printed receipt only — not the box's price, not the
 *    customer's account. The system keeps no "advance" of its own on a
 *    receipt: what a customer has paid in is account credit, and the account
 *    deals with it.
 *  - An advance in dinars is taken off in dinars: the total is converted
 *    once, rounded once, and the advance subtracted exactly as it was
 *    received, so the lines on the paper add up by hand.
 *  - An advance in dollars is taken off in dollars; what remains is then
 *    converted and rounded once.
 *
 * Pure — no database, no React, no printing. The dialog previews with it and
 * the receipt prints with it, so the two cannot disagree. Digits stay 0-9.
 */

export type AdvanceCurrency = "IQD" | "USD";

/** Round the dinars to: exactly, the nearest 250, or the nearest 1,000. */
export const DINAR_ROUND_STEPS = [1, 250, 1000] as const;
export type DinarRoundStep = (typeof DINAR_ROUND_STEPS)[number];
export const DEFAULT_DINAR_ROUND_STEP: DinarRoundStep = 250;

/**
 * Which way the step is taken (owner, 2026-09-21): to the nearer of the two,
 * or downwards — the remainder dropped, never asking the customer for more
 * than the sum. "Without a remainder": 150,250 becomes 150,000.
 */
export const DINAR_ROUND_MODES = ["nearest", "down"] as const;
export type DinarRoundMode = (typeof DINAR_ROUND_MODES)[number];
export const DEFAULT_DINAR_ROUND_MODE: DinarRoundMode = "nearest";

/** What the person printing chooses. */
export interface ReceiptDinarInput {
  /** Dinars per dollar. */
  rate: number;
  step?: DinarRoundStep;
  mode?: DinarRoundMode;
  /** Received by hand, never entered. Empty or zero means none. */
  advanceAmount?: number | null;
  advanceCurrency?: AdvanceCurrency;
}

/** The figures the receipt prints. */
export interface ReceiptDinar {
  rate: number;
  step: DinarRoundStep;
  mode: DinarRoundMode;
  /** The dollar figure the receipt asks for. */
  totalUsd: number;
  /** That total in dinars, rounded once. */
  totalIqd: number;
  advance: { amount: number; currency: AdvanceCurrency } | null;
  /** Dollars still owed — only when the advance was in dollars. */
  dueUsd: number | null;
  /** Dinars still owed: the receipt's last line. */
  dueIqd: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function isStep(value: unknown): value is DinarRoundStep {
  return (DINAR_ROUND_STEPS as readonly unknown[]).includes(value);
}

function isMode(value: unknown): value is DinarRoundMode {
  return (DINAR_ROUND_MODES as readonly unknown[]).includes(value);
}

export function roundDinars(
  amount: number,
  step: DinarRoundStep = DEFAULT_DINAR_ROUND_STEP,
  mode: DinarRoundMode = DEFAULT_DINAR_ROUND_MODE,
): number {
  if (!Number.isFinite(amount)) return 0;
  // Downwards is a floor, not a rounding: 150,250 at a step of 1,000 is
  // 150,000, and so is 150,999 — the remainder is dropped, whatever it was.
  const steps = mode === "down" ? Math.max(0, Math.floor(amount / step)) : Math.round(amount / step);
  return steps * step;
}

/** Null when there is no usable rate: the receipt then prints without dinars. */
export function receiptDinar(totalUsd: number, input: ReceiptDinarInput | null | undefined): ReceiptDinar | null {
  const rate = Number(input?.rate);
  if (!input || !Number.isFinite(rate) || rate <= 0) return null;

  const step = isStep(input.step) ? input.step : DEFAULT_DINAR_ROUND_STEP;
  const mode = isMode(input.mode) ? input.mode : DEFAULT_DINAR_ROUND_MODE;
  const total = Math.max(0, round2(Number(totalUsd) || 0));
  const currency: AdvanceCurrency = input.advanceCurrency === "USD" ? "USD" : "IQD";
  const raw = Number(input.advanceAmount);
  const amount = Number.isFinite(raw) && raw > 0 ? (currency === "USD" ? round2(raw) : Math.round(raw)) : 0;
  const advance = amount > 0 ? { amount, currency } : null;
  const totalIqd = roundDinars(total * rate, step, mode);

  if (advance?.currency === "USD") {
    // Never below zero: an advance bigger than the box is the account's
    // business, not change to hand back at the door.
    const dueUsd = Math.max(0, round2(total - advance.amount));
    return { rate, step, mode, totalUsd: total, totalIqd, advance, dueUsd, dueIqd: roundDinars(dueUsd * rate, step, mode) };
  }
  return {
    rate,
    step,
    mode,
    totalUsd: total,
    totalIqd,
    advance,
    dueUsd: null,
    dueIqd: Math.max(0, totalIqd - (advance?.amount ?? 0)),
  };
}

/** A rate and when it was used (ms since epoch). */
export interface DatedRate {
  rate: number;
  at: number;
}

/**
 * The rate to offer when the window opens: the newer of the last one printed
 * on this device and the last one a payment used. The dollar sits still for a
 * week at a time, so either is usually right; whichever is newer is likelier.
 */
export function offeredRate(device: DatedRate | null | undefined, lastPayment: DatedRate | null | undefined): number | null {
  const usable = [device, lastPayment].filter(
    (r): r is DatedRate => !!r && Number.isFinite(r.rate) && r.rate > 0 && Number.isFinite(r.at),
  );
  if (usable.length === 0) return null;
  return usable.sort((a, b) => b.at - a.at)[0].rate;
}

/** 1465 → "1,465 IQD"; digits stay 0-9 whatever the page's language. */
export function formatIqd(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-GB")} IQD`;
}

/** 1465 → "1,465"; a rate may carry decimals. */
export function formatRate(rate: number): string {
  return rate.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}
