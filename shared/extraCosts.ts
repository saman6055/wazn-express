/**
 * Other costs on a box or a parcel - customs, an inspection, a repack, a
 * service in China, or anything else written out.
 *
 * Owner, 2026-10-19: he paid $12 more at customs for a box and had no place
 * for it on the receipt but his pen. "Sometimes money is spent on a parcel
 * in China, or an extra service is done for it, or it is checked - that is
 * our money spent for the customer." His rules for it:
 *
 *   - two figures: what the company paid (cost) and what the customer is
 *     charged (price). The customer sees the price, as a cost; what is
 *     between the two is the company's profit. They may be equal.
 *   - sometimes nothing is taken back: then it is on the company and comes
 *     off the profit.
 *   - any member of staff may write one; the main admin is told and can
 *     watch every one.
 *
 * So each line is money twice over, and both are kept: the customer's price
 * is a debt on the account the moment it is written (as every order is),
 * and the company's cost is money out. Profit sees the difference.
 */

export const EXTRA_COST_REASONS = ["customs", "inspection", "repack", "china_service", "other"] as const;
export type ExtraCostReason = (typeof EXTRA_COST_REASONS)[number];

type Words = { ku: string; en: string; ar: string; zh: string };

export const EXTRA_COST_REASON_LABELS: Record<ExtraCostReason, Words> = {
  customs: { ku: "گومرگ", en: "Customs", ar: "الجمرك", zh: "海关" },
  inspection: { ku: "پشکنینی کاڵا", en: "Inspection", ar: "فحص البضاعة", zh: "验货" },
  repack: { ku: "پێچانەوە / پاکێجی زیادە", en: "Repacking", ar: "إعادة التغليف", zh: "重新包装" },
  china_service: { ku: "خزمەتگوزاریی زیادە لە چین", en: "Extra service in China", ar: "خدمة إضافية في الصين", zh: "中国额外服务" },
  other: { ku: "تر", en: "Other", ar: "أخرى", zh: "其他" },
};

/** "Other" means nothing to anybody a month later without its words. */
export const EXTRA_COST_NEEDS_TEXT: ExtraCostReason = "other";

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export interface ExtraCostInput {
  reason: ExtraCostReason;
  note?: string | null;
  /** What the company paid. */
  costUsd: number;
  /** What the customer is charged; 0 when it stays on the company. */
  priceUsd: number;
}

/** Why a line cannot be written, in words the office can act on - or null. */
export function extraCostProblem(input: ExtraCostInput): string | null {
  if (!EXTRA_COST_REASONS.includes(input.reason)) return "هۆکارێک هەڵبژێرە.";
  if (input.reason === EXTRA_COST_NEEDS_TEXT && !(input.note ?? "").trim()) return "بۆ «تر» دەبێت بنووسیت تێچووەکە هی چییە.";
  const cost = cents(input.costUsd);
  const price = cents(input.priceUsd);
  if (cost < 0 || price < 0) return "بڕەکان ناتوانن کەمتر لە سفر بن.";
  if (cost === 0 && price === 0) return "بڕێک بنووسە: تێچوو یان نرخ.";
  if (cost > 100_000 || price > 100_000) return "ئەم بڕە لۆژیکی نییە — دووبارە بیپشکنە.";
  return null;
}

/** What one line does to the profit: the price taken less the cost paid. */
export function extraCostProfitUsd(line: { costUsd: number; priceUsd: number }): number {
  return cents(cents(line.priceUsd) - cents(line.costUsd));
}

/** The words written on the customer's account for the price. */
export function extraCostChargeText(reason: ExtraCostReason, note: string | null | undefined, where: string | null): string {
  const label = EXTRA_COST_REASON_LABELS[reason].ku;
  const text = (note ?? "").trim();
  return `تێچووی تر — ${label}${text ? `: ${text}` : ""}${where ? ` — ${where}` : ""}`;
}
