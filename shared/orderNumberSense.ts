/**
 * Order prices that are not logical (owner, 2026-10-04: the same question as
 * batches and parcels, for orders too). Found in the data: a commission four
 * times the goods price (CM-MOODGR4W), $67 on $24 of goods (CM-MQ7VU6CW),
 * negative commissions, a hundred units at $0.51 with a $19 fee. A question,
 * never a refusal: some of these were deliberate.
 */

const n = (v: unknown) => {
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

export const ORDER_MAX_UNIT_USD = 1000;
export const ORDER_MAX_QUANTITY = 500;

export interface OrderNumbers {
  orderType: "commission" | "full_package" | "purchase_request" | string;
  quantity?: string | number | null;
  itemPriceUsd?: string | number | null;
  commissionFeeUsd?: string | number | null;
  purchasePriceUsd?: string | number | null;
  sellingPriceUsd?: string | number | null;
}

/** Each odd number in plain Sorani; empty when everything looks right. */
export function oddOrderNumbers(o: OrderNumbers): string[] {
  const out: string[] = [];
  const q = n(o.quantity);
  if (q > ORDER_MAX_QUANTITY) out.push(`ژمارەی دانە ${q}ـە — زۆر زیاترە لە ئۆردەرێکی ئاسایی.`);
  if (o.orderType === "commission") {
    const item = n(o.itemPriceUsd);
    const fee = n(o.commissionFeeUsd);
    if (item > ORDER_MAX_UNIT_USD) out.push(`نرخی یەک دانە $${item}ـە — لەوانەیە سفرێک زیاد بێت.`);
    if (fee < 0) out.push(`عمولە سالبە ($${fee}) — واتە کاڵاکە بە کەمتر لە نرخی کڕین دەفرۆشرێت.`);
    if (item > 0 && fee > item && fee > 5) out.push(`عمولەی یەک دانە ($${fee}) لە نرخی کاڵاکە ($${item}) زیاترە.`);
  } else {
    const buy = n(o.purchasePriceUsd);
    const sell = n(o.sellingPriceUsd);
    if (sell > ORDER_MAX_UNIT_USD || buy > ORDER_MAX_UNIT_USD) out.push(`نرخی یەک دانە لە $${ORDER_MAX_UNIT_USD} زیاترە — لەوانەیە سفرێک زیاد بێت.`);
    if (buy > 0 && sell > 0 && sell > buy * 4 && sell - buy > 20) out.push(`نرخی فرۆشتن ($${sell}) ${Math.round(sell / buy)} ئەوەندەی نرخی کڕینە ($${buy}).`);
    if (sell > 0 && sell < 0.05) out.push(`نرخی فرۆشتن $${sell}ـە — نزیکەی سفرە.`);
  }
  return out;
}

export function oddOrderQuestion(lines: readonly string[]): string {
  return `ئەم ژمارانە لۆجیکی نین:\n\n${lines.map((l) => `• ${l}`).join("\n")}\n\nتکایە دووبارە دڵنیا بەرەوە.`;
}
