/**
 * Where a parcel came from, and the one click that opens it there.
 *
 * The owner, 2026-09-21, looking at the "still in the China warehouse" alert:
 * "when it says these have not been sent — clicking should go straight to the
 * same parcel that has the problem. Whether it belongs to buy-at-cost, or to
 * a full package, or to the customer's own list: take me there, to the same
 * tracking. Make it easy."
 *
 * A parcel is one of three things:
 *
 *   commission     bought for the customer at cost — its order is the record
 *   full package   sold at one agreed price — its order is the record
 *   the customer's own parcel — no order at all, so its record is the row in
 *                  the parcels list
 *
 * Which of the three, and therefore which screen, is decided here and nowhere
 * else, so an alert, a list and a card cannot send three people to three
 * different places for the same parcel.
 *
 * Nothing here queries anything: it turns facts into an address.
 */

/** The three kinds of order a parcel can be claimed by. */
export type ParcelOrderType = "full_package" | "commission" | "purchase_request";

/** The order a parcel belongs to, as the server found it. */
export interface ParcelOrderRef {
  orderId: number;
  orderType: ParcelOrderType;
  /** The order's own code — CM-1042, FP-1042. */
  orderCode?: string | null;
  /** The number on the shop's platform, which is what staff read out loud. */
  orderNumber?: string | null;
}

export interface ParcelSourceTarget {
  /** Which screen holds this parcel's record. */
  kind: ParcelOrderType | "parcel";
  /** Where to go. */
  href: string;
  /** What to call it on the button, in each language. */
  label: { ku: string; en: string; ar: string; zh: string };
  /** The code shown beside the label, when there is one. */
  code?: string;
}

const PARCELS_PATH = "/packages/all";

/** The parcels list, already searched for this one parcel. */
export function parcelListHref(search?: string | null): string {
  const term = (search ?? "").trim();
  return term ? `${PARCELS_PATH}?search=${encodeURIComponent(term)}` : PARCELS_PATH;
}

/** A parcel's main order: its own, or the first one linked to it. */
export function mainOrderOf(orders?: readonly ParcelOrderRef[] | null): ParcelOrderRef | null {
  const list = (orders ?? []).filter((o) => o && Number.isInteger(o.orderId) && o.orderId > 0);
  return list[0] ?? null;
}

/**
 * The one place this parcel is dealt with.
 *
 * An order takes precedence over the list: a buy-at-cost parcel that is stuck
 * is a question about that purchase, and the purchase is where the answer —
 * the supplier, the money, the note — actually is. With no order, the parcel
 * is its own record and the list is opened on it alone.
 */
export function parcelSourceTarget(
  orders: readonly ParcelOrderRef[] | null | undefined,
  tracking?: string | null,
): ParcelSourceTarget {
  const order = mainOrderOf(orders);
  const code = (order?.orderCode ?? order?.orderNumber ?? "").trim() || undefined;

  if (order?.orderType === "commission") {
    return {
      kind: "commission",
      href: `/commission/${order.orderId}`,
      label: { ku: "داواکاری کڕین بە تێچوو", en: "Buy-at-cost order", ar: "طلب الشراء بالتكلفة", zh: "代购订单" },
      code,
    };
  }
  if (order?.orderType === "full_package" || order?.orderType === "purchase_request") {
    return {
      kind: order.orderType,
      href: `/full-package/${order.orderId}`,
      label: { ku: "داواکاری پاکێجی تەواو", en: "Full-package order", ar: "طلب الباكيج الكامل", zh: "整包订单" },
      code,
    };
  }
  return {
    kind: "parcel",
    href: parcelListHref(tracking),
    label: { ku: "پاکەتەکە لە لیست", en: "The parcel in the list", ar: "الطرد في القائمة", zh: "列表中的包裹" },
    code: (tracking ?? "").trim() || undefined,
  };
}
