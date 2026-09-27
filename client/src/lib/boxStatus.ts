/**
 * What each box status is called. The chip used to know two states —
 * received, or "on its way" — so a box still being packed, a box waiting to
 * leave and a cancelled box all told the customer it was out for delivery.
 */
export const BOX_STATUS_LABEL: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
  open: { ku: "ئامادە دەکرێت", en: "Being packed", ar: "قيد التجهيز", zh: "打包中" },
  ready: { ku: "ئامادەیە بۆ ناردن", en: "Ready to send", ar: "جاهز للإرسال", zh: "待发出" },
  in_transit: { ku: "لە ڕێی گەیاندنە", en: "Out for delivery", ar: "خرج للتسليم", zh: "派送中" },
  delivered: { ku: "گەیشتە دەستت", en: "Received", ar: "تم الاستلام", zh: "已签收" },
  cancelled: { ku: "هەڵوەشێنرایەوە", en: "Cancelled", ar: "أُلغي", zh: "已取消" },
};
