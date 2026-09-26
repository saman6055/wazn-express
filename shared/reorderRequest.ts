/**
 * "Can you order this for me again?"
 *
 * The owner, 2026-09-26: on a commission or full-package order in the portal
 * there must be a button called دووبارە داواکردنەوە, and pressing it opens
 * Wazn's WhatsApp carrying the picture, the tracking and the platform's own
 * order number, with the sentence already written.
 *
 * It is the cheapest repeat sale there is. The customer liked the thing, they
 * are looking at it, and the alternative is them describing a pair of
 * sunglasses they bought in July down a phone line. What the office needs to
 * buy it again is exactly three facts — which shop's order it was, which
 * parcel it came in, and what it looked like — so the message carries those
 * and nothing else.
 *
 * The picture travels as a link, not as a file: a wa.me message is text. A
 * link is only included when there is a real one to send — an image stored as
 * base64 has no address, and a broken link in a customer's message is worse
 * than no picture at all.
 */

export interface ReorderSubject {
  /** The order's own code: CM-1042, FP-MRRV5259. */
  orderCode?: string | null;
  /** The number on the shop's platform — what the office searches with. */
  orderNumber?: string | null;
  productName?: string | null;
  trackingNumber?: string | null;
  quantity?: number | null;
  /** Whatever the row carries: a path, a URL, or base64. */
  image?: unknown;
}

export const REORDER_WORDS = {
  button: {
    ku: "دووبارە داواکردنەوە",
    en: "Order this again",
    ar: "اطلبها مرة أخرى",
    zh: "再次订购",
  },
  intent: {
    ku: "سڵاو بەڕێزم، دەتوانن ئەم کاڵایە دووبارە بۆم داوا بکەنەوە؟",
    en: "Hello, could you order this item for me again?",
    ar: "مرحباً، هل يمكنكم طلب هذه البضاعة لي مرة أخرى؟",
    zh: "您好，可以帮我再订购一次这件商品吗？",
  },
  section: {
    ku: "دووبارە داواکردنەوەی کاڵا",
    en: "Re-order a product",
    ar: "إعادة طلب بضاعة",
    zh: "再次订购商品",
  },
  labels: {
    order: { ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" },
    orderNumber: { ku: "ژمارەی ئۆردەری پلاتفۆرم", en: "Platform order number", ar: "رقم الطلب في المنصة", zh: "平台订单号" },
    product: { ku: "کاڵا", en: "Product", ar: "البضاعة", zh: "商品" },
    tracking: { ku: "تراک", en: "Tracking", ar: "التتبع", zh: "运单号" },
    quantity: { ku: "دانە", en: "Quantity", ar: "الكمية", zh: "数量" },
    photo: { ku: "وێنەی کاڵاکە", en: "Photo", ar: "صورة البضاعة", zh: "商品图片" },
  },
} as const;

/**
 * A picture the office can actually open.
 *
 * An `/uploads/...` path is ours and becomes absolute against the site it was
 * served from. An https URL travels as it is. Anything else — base64 above
 * all — has no address, and is left out.
 */
export function reorderPhotoUrl(image: unknown, origin: string): string | null {
  const base = (origin ?? "").replace(/\/+$/, "");

  /** One candidate, or nothing. A value with no address is not a picture. */
  const asUrl = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const url = value.trim();
    if (!url || url.startsWith("data:")) return null;
    if (url.startsWith("https://")) return url;
    if (url.startsWith("/uploads/")) return base ? `${base}${url}` : null;
    return null;
  };

  /*
   * The first candidate that has an address, not the first candidate.
   *
   * A row carries its photos in several columns at once and the earliest is
   * often base64 — stopping there would send no picture while a perfectly
   * good `/uploads/` one sat in the next field. Nested because the caller
   * passes [productImage, productImages] and the second is itself an array.
   */
  const find = (value: unknown, depth = 0): string | null => {
    if (Array.isArray(value)) {
      if (depth > 3) return null;
      for (const item of value) {
        const found = find(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    return asUrl(value);
  };

  return find(image);
}

/**
 * The lines of the message, in the order the office reads them.
 *
 * Shaped for lib/waznChat's detail list: a label and a value, and a line with
 * nothing to say is left out rather than sent as "Tracking: ".
 */
export function reorderDetails(
  subject: ReorderSubject,
  origin: string,
): Array<readonly [{ ku: string; en: string; ar: string; zh: string }, string | null]> {
  const L = REORDER_WORDS.labels;
  const text = (v: unknown): string | null => {
    const s = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
    return s ? s : null;
  };
  return [
    [L.product, text(subject.productName)],
    [L.order, text(subject.orderCode)],
    [L.orderNumber, text(subject.orderNumber)],
    [L.tracking, text(subject.trackingNumber)],
    [L.quantity, subject.quantity && subject.quantity > 1 ? String(subject.quantity) : null],
    [L.photo, reorderPhotoUrl(subject.image, origin)],
  ];
}

/** Is there enough to ask with? A button on a row that says nothing helps nobody. */
export function canReorder(subject: ReorderSubject): boolean {
  return Boolean(
    (subject.orderCode && String(subject.orderCode).trim()) ||
      (subject.orderNumber && String(subject.orderNumber).trim()) ||
      (subject.productName && String(subject.productName).trim()),
  );
}
