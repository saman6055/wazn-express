/**
 * A batch whose cost is not below its selling price.
 *
 * Somebody once typed $299.20 into "cost per kg" on a batch sold at $11 —
 * the carrier's whole invoice, typed into the per-kilo box. Nothing stopped
 * it, and every profit figure built on that batch was wrong until someone
 * happened to notice. The close check (shared/batchCloseCheck) only warns,
 * and only at the end.
 *
 * Owner, 2026-09-29: the save itself must stop. Ordinary staff cannot save
 * such a batch at all; an admin is asked once and may save it, because a
 * batch is sometimes sent at a loss on purpose. The server asks the same
 * question as the form, so no other screen gets around it.
 *
 * Only prices that were actually typed are compared. A blank cost or price
 * is "not known yet", never zero — and tiered pricing, which has no single
 * price, is left alone.
 */

import { withFix } from "./fixAdvice";

export interface BatchCostGuardInput {
  shippingType?: string | null;
  costPerKg?: string | number | null;
  costPerCbm?: string | number | null;
  pricePerKg?: string | number | null;
  pricePerCbm?: string | number | null;
  /** Prices agreed with single customers, as typed on the batch. */
  customerPricing?: ReadonlyArray<{
    customerId: number;
    customerCode?: string | null;
    pricePerKg?: string | number | null;
    pricePerCbm?: string | number | null;
  }> | null;
}

export interface CostBreach {
  /** null = the batch's own selling price; otherwise the customer it was agreed with. */
  customerId: number | null;
  customerCode: string | null;
  costUsd: number;
  priceUsd: number;
  unit: "kg" | "cbm";
}

const amount = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Every price on this batch that the cost does not stay below. Empty = fine. */
export function batchCostBreaches(input: BatchCostGuardInput): CostBreach[] {
  const sea = input.shippingType === "sea";
  const unit = sea ? ("cbm" as const) : ("kg" as const);
  const cost = amount(sea ? input.costPerCbm : input.costPerKg);
  if (cost === null) return [];

  const out: CostBreach[] = [];
  const base = amount(sea ? input.pricePerCbm : input.pricePerKg);
  if (base !== null && cost >= base) {
    out.push({ customerId: null, customerCode: null, costUsd: cost, priceUsd: base, unit });
  }
  for (const cp of input.customerPricing ?? []) {
    const price = amount(sea ? cp.pricePerCbm : cp.pricePerKg);
    if (price !== null && cost >= price) {
      out.push({ customerId: cp.customerId, customerCode: cp.customerCode ?? null, costUsd: cost, priceUsd: price, unit });
    }
  }
  return out;
}

/** Only an admin may save a batch at or below cost, and only when asked. */
export function mayApproveCostBreach(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * How many times the price the cost is. Above this the cost is almost
 * certainly the carrier's total typed into the per-unit box, and the
 * message says so.
 */
export const LOOKS_LIKE_A_TOTAL_RATIO = 3;

const usd = (n: number) => `$${n.toFixed(2)}`;

function breachLine(b: CostBreach): string {
  const who = b.customerId === null ? "نرخی فرۆشتن" : `نرخی تایبەتی ${b.customerCode ?? `#${b.customerId}`}`;
  return `تێچووی ${b.unit} ${usd(b.costUsd)} ≥ ${who} ${usd(b.priceUsd)}`;
}

/** The refusal ordinary staff see — the cause, then the cure. */
export function costBreachRefusal(breaches: readonly CostBreach[]): string {
  const looksTotal = breaches.some((b) => b.costUsd >= b.priceUsd * LOOKS_LIKE_A_TOTAL_RATIO);
  const unit = breaches[0]?.unit ?? "kg";
  return withFix(
    `ئەم باچە سەیڤ ناکرێت: تێچوو لە نرخی فرۆشتن کەمتر نییە — ${breaches.map(breachLine).join("، ")}. بەم نرخە هەموو ${unit}ێک زیانە.`,
    [
      looksTotal ? `ئەگەر ئەمە کۆی پارەی کارگۆیە، لە خانەی «کۆی کرێی گەیاندن» بینووسە و خانەی «تێچووی ${unit}» بەتاڵ بهێڵەرەوە` : null,
      `تێچووی ${unit} و نرخی فرۆشتن بپشکنە و ڕاستیان بکەرەوە`,
      "ئەگەر ئەم باچە بە ئەنقەست بە زیان دەنێردرێت، داوا لە بەڕێوەبەر بکە سەیڤی بکات",
    ],
  );
}

/** The question an admin is asked before saving anyway. */
export function costBreachQuestion(breaches: readonly CostBreach[]): string {
  const worst = breaches.reduce((a, b) => (b.costUsd - b.priceUsd > a.costUsd - a.priceUsd ? b : a));
  const loss = worst.costUsd - worst.priceUsd;
  return (
    `${breaches.map(breachLine).join("\n")}\n\n` +
    (loss > 0 ? `زیانی هەر ${worst.unit}ێک: ${usd(loss)}.\n` : "هیچ قازانجێک نییە.\n") +
    "دڵنیایت ئەم باچە بەم نرخانە سەیڤ دەکەیت؟ ناوت وەک ڕەزامەندیدەر تۆمار دەکرێت."
  );
}
