/**
 * A parcel that carries only its freight, in a box of orders.
 *
 * The owner, 2026-10-05: «لەناو بۆکس، ئەگەر دانەیەک بووە سێلف ئۆردەر — تەنها
 * کرێی گواستنەوەی لەسەر بوو — ئاگادارکردنەوەیەک بێت». A customer who buys
 * through us buys everything through us. So when a box is orders — buy-at-
 * cost, full package — and one parcel in it is asking for its freight and
 * nothing else, the likeliest explanation is not that they bought that one
 * themselves: it is that its order was never typed in. Then the goods are in
 * the customer's hands, the box says a few dollars of shipping, and the price
 * of the goods is owed by nobody (the AZ295 case, in a quieter form).
 *
 * A warning and nothing more. It may be right as it stands — people do buy
 * one thing themselves — so nothing is refused and nothing is charged. It
 * only makes the person at the box look once before the money is taken.
 *
 * Said only for a MIXED box. A box that is all self-order parcels is a
 * customer who buys for themselves, and telling them so on every box is how
 * a warning stops being read.
 */

export interface BoxItemOrderFacts {
  itemType?: string | null;
  /** The item was scanned as an order. */
  fullPackageOrderId?: number | null;
  /** Some order claims its tracking number, whichever way it was scanned. */
  hasOrder?: boolean | null;
}

/** Nothing ordered through us is behind it: the box asks only its freight. */
export function isShippingOnly(item: BoxItemOrderFacts): boolean {
  if (item.fullPackageOrderId) return false;
  if (item.hasOrder) return false;
  return !item.itemType || item.itemType === "regular";
}

/**
 * The shipping-only parcels of a box that also holds orders — the ones worth
 * a second look. Empty when the box is all of one kind.
 */
export function shippingOnlyAmongOrders<T extends BoxItemOrderFacts>(items: readonly T[]): T[] {
  const alone = items.filter(isShippingOnly);
  if (alone.length === 0 || alone.length === items.length) return [];
  return alone;
}

export interface ShippingOnlyWords {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

/** The notice above the box's parcels. */
export function shippingOnlyNotice(count: number): { title: ShippingOnlyWords; body: ShippingOnlyWords } {
  return {
    title: {
      ku: count === 1
        ? "1 پاکەت لەم بۆکسەدا تەنها کرێی گواستنەوەی لەسەرە"
        : `${count} پاکەت لەم بۆکسەدا تەنها کرێی گواستنەوەیان لەسەرە`,
      en: count === 1
        ? "1 parcel in this box carries only its shipping"
        : `${count} parcels in this box carry only their shipping`,
      ar: count === 1
        ? "طرد واحد في هذا الصندوق عليه أجرة الشحن فقط"
        : `${count} طرود في هذا الصندوق عليها أجرة الشحن فقط`,
      zh: `此箱中有 ${count} 件包裹只收运费`,
    },
    body: {
      ku: "پاکەتەکانی تری ئەم بۆکسە ئۆردەرن (کڕین بە تێچوو یان پاکێجی تەواو). ئەگەر کاڵای ئەمانیش لە ڕێگای ئێمەوە کڕدراوە، ئۆردەرەکەیان لەبیر کراوە و نرخی کاڵاکە حیساب نەکراوە — پێش وەرگرتنی پارە بیپشکنە. ئەگەر کڕیار خۆی کڕیویەتی، هیچ پێویست نییە.",
      en: "The other parcels in this box are orders (buy-at-cost or full package). If these goods were bought through us too, their order was forgotten and the goods have not been charged — check before taking the money. If the customer bought them themselves, nothing is needed.",
      ar: "بقية طرود هذا الصندوق طلبات (شراء بالتكلفة أو حزمة كاملة). إن كانت هذه البضاعة اشتُريت عن طريقنا أيضاً فقد نُسي طلبها ولم يُحتسب ثمنها — تحقق قبل استلام المبلغ. وإن اشتراها الزبون بنفسه فلا شيء مطلوب.",
      zh: "此箱中其他包裹都是订单（成本代购或完整套餐）。如果这些货物也是通过我们购买的，说明订单漏录、货款未计 — 请在收款前核对。如果是客户自己购买的，则无需处理。",
    },
  };
}

/** The mark on the row itself. */
export const SHIPPING_ONLY_CHIP: ShippingOnlyWords = {
  ku: "تەنها کرێ",
  en: "Shipping only",
  ar: "شحن فقط",
  zh: "仅运费",
};
