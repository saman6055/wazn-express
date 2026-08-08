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
  registered: { ku: "لە کۆگای چین", en: "At China depot", ar: "في مستودع الصين", zh: "在中国仓库" },
  in_batch: { ku: "لە باچدایە", en: "In batch", ar: "في الدفعة", zh: "已入批次" },
  in_transit: { ku: "لە ڕێگادایە", en: "In transit", ar: "في الطريق", zh: "运输中" },
  customs_processing: { ku: "لە گومرگ", en: "At customs", ar: "في الجمارك", zh: "清关中" },
  ready_for_delivery: { ku: "ئامادەیە بۆ وەرگرتن", en: "Ready for pickup", ar: "جاهز للاستلام", zh: "可取件" },
  out_for_delivery: { ku: "لە ڕێگای گەیاندن", en: "Out for delivery", ar: "خرج للتسليم", zh: "派送中" },
  delivered: { ku: "گەیەندرا", en: "Delivered", ar: "تم التسليم", zh: "已送达" },
  returned: { ku: "گەڕێندراوەتەوە", en: "Returned", ar: "مُرتجع", zh: "已退回" },
  cancelled: { ku: "هەڵوەشێنراوە", en: "Cancelled", ar: "ملغى", zh: "已取消" },
};
