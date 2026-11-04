/**
 * Where the expenses could come down, read from the period's own figures
 * (owner, 2026-11-05: «پێشنیاری تازەش بۆ چۆنیەتی کەم کردنەوەی خەرجی»).
 * Pure: the same rows the expenses dashboard already shows, nothing guessed.
 */
export interface CategoryTotal { categoryId: number; categoryName: string; total: number }
export interface VendorTotal { vendor: string; total: number; count: number }

export interface ExpenseTip {
  kind: "grew" | "new" | "vendor" | "heavy" | "good";
  categoryId?: number;
  ku: string;
  en: string;
}

/** A rise worth a look: at least this share and this many dollars. */
export const TIP_GROWTH_PERCENT = 25;
export const TIP_GROWTH_MIN_USD = 20;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function expenseTips(
  current: { totalAmount: number; byCategory: CategoryTotal[] },
  previous: { totalAmount: number; byCategory: CategoryTotal[] },
  byVendor: VendorTotal[] = [],
): ExpenseTip[] {
  const tips: ExpenseTip[] = [];
  const before = new Map(previous.byCategory.map((c) => [c.categoryId, c.total]));
  const total = current.totalAmount;

  const grew = current.byCategory
    .map((c) => ({ c, prev: before.get(c.categoryId) ?? 0 }))
    .filter(({ c, prev }) => prev > 0 && c.total - prev >= TIP_GROWTH_MIN_USD && ((c.total - prev) / prev) * 100 >= TIP_GROWTH_PERCENT)
    .sort((a, b) => (b.c.total - b.prev) - (a.c.total - a.prev))
    .slice(0, 3);
  for (const { c, prev } of grew) {
    const pct = Math.round(((c.total - prev) / prev) * 100);
    tips.push({
      kind: "grew",
      categoryId: c.categoryId,
      ku: `«${c.categoryName}» ${pct}% زیادی کردووە (${usd(prev)} ← ${usd(c.total)}). سەیری خەرجییەکانی بکە و بزانە کامیان دەکرێت دوابخرێت یان کەم بکرێتەوە.`,
      en: `"${c.categoryName}" rose ${pct}% (${usd(prev)} → ${usd(c.total)}). Look through it for what can wait or be cut.`,
    });
  }

  for (const c of current.byCategory) {
    if ((before.get(c.categoryId) ?? 0) === 0 && c.total >= 50) {
      tips.push({
        kind: "new",
        categoryId: c.categoryId,
        ku: `«${c.categoryName}» خەرجییەکی نوێیە لەم ماوەیەدا (${usd(c.total)}). دڵنیابە کە پێویستە، یان یەکجارییە.`,
        en: `"${c.categoryName}" is new this period (${usd(c.total)}). Check it is needed, or a one-off.`,
      });
    }
  }

  const heavy = [...current.byCategory].sort((a, b) => b.total - a.total)[0];
  if (heavy && current.byCategory.length > 1 && total > 0 && heavy.total / total >= 0.4) {
    tips.push({
      kind: "heavy",
      categoryId: heavy.categoryId,
      ku: `«${heavy.categoryName}» ${Math.round((heavy.total / total) * 100)}%ی هەموو خەرجییەکانە — یەکەم شوێنە بۆ کەمکردنەوە.`,
      en: `"${heavy.categoryName}" is ${Math.round((heavy.total / total) * 100)}% of all spending — the first place to save.`,
    });
  }

  const vendor = [...byVendor].sort((a, b) => b.total - a.total)[0];
  if (vendor && total > 0 && vendor.total / total >= 0.3 && vendor.vendor.trim()) {
    tips.push({
      kind: "vendor",
      ku: `${Math.round((vendor.total / total) * 100)}%ی خەرجییەکان بۆ «${vendor.vendor}» ڕۆیشتووە (${vendor.count} جار). داوای نرخی باشتر بکە یان دابینکەرێکی دووەم تاقی بکەرەوە.`,
      en: `${Math.round((vendor.total / total) * 100)}% went to "${vendor.vendor}" (${vendor.count} times). Ask for a better price or try a second supplier.`,
    });
  }

  if (previous.totalAmount > 0 && total <= previous.totalAmount * 0.9) {
    tips.push({
      kind: "good",
      ku: `خەرجی ${Math.round((1 - total / previous.totalAmount) * 100)}% کەمتر بووە لە ماوەی پێشوو — دەستخۆش.`,
      en: `Spending is ${Math.round((1 - total / previous.totalAmount) * 100)}% lower than the previous period — well done.`,
    });
  }
  return tips;
}
