/**
 * Does the order number / tracking number pair look mixed up?
 *
 * The owner's observation (Sep 2026): an order number is LONGER than a
 * tracking number. When the two get typed into each other's boxes — or a
 * number arrives suspiciously short — the parcel later can't be matched
 * at the warehouse. The form should say something at save time.
 *
 * Warnings, never errors: these are length heuristics, and a strange but
 * real number must still be savable. Used by the full-package and
 * cost-purchase (commission) forms; pure so it can be unit-tested.
 */

/** Anything shorter than this is suspicious for either box. */
export const SHORT_ID_MIN = 8;

/** A pure-digit run at least this long smells like a shop order number. */
export const ORDER_LIKE_DIGITS = 16;

export type OrderTrackingWarning =
  /** Both filled and the tracking is the longer one — likely swapped. */
  | "swapped"
  /** The order box holds a courier-looking code (letters then digits). */
  | "orderLooksLikeTracking"
  /** The tracking box holds a long pure-digit shop-order-looking number. */
  | "trackingLooksLikeOrder"
  | "orderTooShort"
  | "trackingTooShort";

/** SF1234567890123 / YT7565…-style courier codes: letters, then digits. */
const COURIER_SHAPE = /^[A-Za-z]{2,4}\d{8,}$/;

/** A shop order id shape: nothing but digits, and a lot of them. */
const orderShape = new RegExp(`^\\d{${ORDER_LIKE_DIGITS},}$`);

export function orderTrackingWarnings(
  orderNumber: string | null | undefined,
  trackingNumber: string | null | undefined,
): OrderTrackingWarning[] {
  const order = (orderNumber ?? "").trim();
  const tracking = (trackingNumber ?? "").trim();
  const warnings: OrderTrackingWarning[] = [];

  const swapped = Boolean(order) && Boolean(tracking) && tracking.length > order.length;
  if (swapped) warnings.push("swapped");

  // Shape checks only add signal when the length comparison couldn't
  // already say "swapped" — no point scolding twice for one mistake.
  if (!swapped && order && COURIER_SHAPE.test(order)) {
    warnings.push("orderLooksLikeTracking");
  }
  if (!swapped && tracking && orderShape.test(tracking)) {
    warnings.push("trackingLooksLikeOrder");
  }

  if (order && order.length < SHORT_ID_MIN) warnings.push("orderTooShort");
  if (tracking && tracking.length < SHORT_ID_MIN) warnings.push("trackingTooShort");

  return warnings;
}

/**
 * What each warning says, in the four languages both forms speak. Lives
 * here so the two forms cannot drift into different wordings.
 */
export const ORDER_TRACKING_WARNING_TEXT: Record<
  OrderTrackingWarning,
  { ku: string; en: string; ar: string; zh: string }
> = {
  swapped: {
    ku: "ئاگاداری: پێدەچێت ژمارەی ئۆردەر و تراک ئاڵوگۆڕ کرابن — تراکەکە درێژترە لە ئۆردەرەکە",
    en: "Warning: order and tracking numbers look swapped — the tracking is longer than the order",
    ar: "تحذير: يبدو أن رقم الطلب ورقم التتبع متبادلان — التتبع أطول من الطلب",
    zh: "警告：订单号与运单号疑似互换——运单号比订单号更长",
  },
  orderLooksLikeTracking: {
    ku: "ئاگاداری: ئەوەی لە خانەی ئۆردەر نەمبەردایە لە ژمارەی تراک دەچێت",
    en: "Warning: what's in the order-number box looks like a tracking number",
    ar: "تحذير: ما في خانة رقم الطلب يشبه رقم تتبع",
    zh: "警告：订单号栏中的内容看起来像运单号",
  },
  trackingLooksLikeOrder: {
    ku: "ئاگاداری: ئەوەی لە خانەی تراکدایە لە ژمارەی ئۆردەر دەچێت",
    en: "Warning: what's in the tracking box looks like an order number",
    ar: "تحذير: ما في خانة التتبع يشبه رقم طلب",
    zh: "警告：运单号栏中的内容看起来像订单号",
  },
  orderTooShort: {
    ku: "ئاگاداری: ژمارەی ئۆردەرەکە زۆر کورتە — دڵنیابەرەوە",
    en: "Warning: the order number is very short — double-check it",
    ar: "تحذير: رقم الطلب قصير جداً — تحقق منه",
    zh: "警告：订单号过短——请再核对",
  },
  trackingTooShort: {
    ku: "ئاگاداری: ژمارەی تراکەکە زۆر کورتە — دڵنیابەرەوە",
    en: "Warning: the tracking number is very short — double-check it",
    ar: "تحذير: رقم التتبع قصير جداً — تحقق منه",
    zh: "警告：运单号过短——请再核对",
  },
};
