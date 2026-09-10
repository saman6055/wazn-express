/**
 * What each package status is called, in the customer's language — one copy.
 *
 * The enum lives in drizzle/schema/packages.schema.ts and holds nine values.
 * Screens kept private partial maps of it (the batch detail knew seven, in two
 * languages), and whatever a map did not know leaked to the customer as the
 * raw column value — "customs_processing" in Latin letters on a Kurdish page.
 * portal-audit.test.ts fails if this map and the enum ever disagree again.
 */

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * The home-screen stage groups, from the customer's side of the counter.
 *
 * These exist because two skins were counting packages against BATCH statuses
 * ("arrived", "customs", "closed" — values a package row can never hold), so
 * the "arrived" tile showed 0 forever no matter what was sitting in Erbil.
 * Group membership is checked against the enum by portal-audit.test.ts.
 */
export const PACKAGE_STAGE_GROUPS = {
  /** Moving between countries. */
  inTransit: ["in_transit"],
  /** In Iraq but not yet in the customer's hands. */
  arrived: ["customs_processing", "ready_for_delivery", "out_for_delivery"],
  delivered: ["delivered"],
} as const;

export const PACKAGE_STATUS_LABEL: Record<string, L> = {
  registered: { ku: "گەیشتە کۆگاکەمان", en: "At our depot", ar: "في مستودعنا", zh: "已到我们的仓库" },
  in_batch: { ku: "خرایە ناو بار", en: "Packed into a shipment", ar: "أُضيف إلى شحنة", zh: "已装入货运" },
  in_transit: { ku: "لە ڕێگادا", en: "In transit", ar: "في الطريق", zh: "运输中" },
  customs_processing: { ku: "لە گومرگ", en: "At customs", ar: "في الجمارك", zh: "清关中" },
  ready_for_delivery: { ku: "ئامادەیە بۆ وەرگرتن", en: "Ready for pickup", ar: "جاهز للاستلام", zh: "可取件" },
  out_for_delivery: { ku: "لە ڕێی گەیاندنە", en: "Out for delivery", ar: "خرج للتسليم", zh: "派送中" },
  delivered: { ku: "گەیشتە دەستت", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
  returned: { ku: "گەڕێندراوەتەوە", en: "Returned", ar: "مُرتجع", zh: "已退回" },
  cancelled: { ku: "هەڵوەشێنراوە", en: "Cancelled", ar: "ملغى", zh: "已取消" },
};

/**
 * The colour of each package status — the twin of BATCH_STATUS_TONE in
 * shipmentFilters.ts, and for the same reason: three screens coloured these
 * chips for themselves, and a returned or cancelled parcel came out grey,
 * the colour of "nothing to see".
 */
export const PACKAGE_STATUS_TONE: Record<string, string> = {
  registered: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_batch: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_transit: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  customs_processing: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  ready_for_delivery: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  out_for_delivery: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  returned: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function packageStatusTone(status: string | null | undefined): string {
  return PACKAGE_STATUS_TONE[status ?? ""] ?? PACKAGE_STATUS_TONE.registered;
}
