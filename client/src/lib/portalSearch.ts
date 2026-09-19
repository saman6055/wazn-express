/**
 * The customer's one search box — what it finds, and where each answer leads.
 *
 * The centre button of the portal's bottom bar opens it. A customer types
 * whatever they have to hand: the whole tracking number, the last four digits
 * of it, an order number, a box code, the name of the thing they bought. The
 * answer comes from the lists the portal has already loaded — parcels, orders,
 * shipments, boxes, registrations — so typing costs the server nothing. Only
 * when none of those holds the number does the screen ask the server, once,
 * for the older parcel or the unclaimed one.
 *
 * Pure: no React, no network. The screen builds the index once per data
 * change and filters it on every keystroke.
 */
import { cleanTrackingPaste } from "@/lib/entry/cleanPaste";
import { matchScore, normalizeSearch } from "@/lib/ops/commandMatch";

type L = { ku: string; en: string; ar: string; zh: string };
type When = Date | string | null | undefined;

/** The three stages a customer asks about, in the order they are asked. */
export type SearchTab = "arrived" | "onTheWay" | "registered";
export const SEARCH_TABS: readonly SearchTab[] = ["arrived", "onTheWay", "registered"];

/** The owner's three places (2026-09-19), short enough for a tab and a home card. */
export const SEARCH_TAB_LABEL: Record<SearchTab, L> = {
  arrived: { ku: "گەیشتە هەولێر", en: "In Erbil", ar: "في أربيل", zh: "已到埃尔比勒" },
  onTheWay: { ku: "لە ڕێگادایە", en: "On the way", ar: "في الطريق", zh: "运输中" },
  registered: { ku: "لە کۆگای چین", en: "In China", ar: "في الصين", zh: "在中国仓库" },
};

/** Green for arrived, blue for on the way, grey for registered — the owner's three colours. */
export const SEARCH_TAB_TONE: Record<SearchTab, string> = {
  arrived: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  onTheWay: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  registered: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

/** The dot beside each tab's name, in the same three colours. */
export const SEARCH_TAB_DOT: Record<SearchTab, string> = {
  arrived: "bg-emerald-500",
  onTheWay: "bg-sky-500",
  registered: "bg-slate-400",
};

/**
 * Which tab a parcel belongs under — where the goods are now. The owner's
 * decisions of 2026-09-19:
 *
 *  - arrived: in Erbil and not yet collected — ready, or out with the
 *    courier. A delivered parcel has left the tab: the green words say
 *    "ready to collect", and it was collected. It is found by searching, and
 *    in the shipments' history.
 *  - onTheWay: on the plane or the ship, and through customs, which the
 *    owner kept on the way.
 *  - registered: at the China depot — including packed into a shipment that
 *    has not left yet. It is grey until the plane or ship leaves: the server
 *    moves every parcel of a shipment to in_transit at departure.
 *
 * Returned and cancelled parcels belong under none of them either: they are
 * found by searching for them, and say what happened in red.
 */
export function parcelTab(parcel: { status?: string | null; batchId?: number | null }): SearchTab | null {
  switch (String(parcel.status ?? "")) {
    case "ready_for_delivery":
    case "out_for_delivery":
      return "arrived";
    case "in_transit":
    case "customs_processing":
      return "onTheWay";
    case "registered":
    case "in_batch":
      return "registered";
    default:
      return null;
  }
}

/**
 * The same three places for an order that has no parcel of its own yet, by
 * the same decisions: packed into a shipment still in China is grey, one that
 * reached Iraq is on the way until it says ready, and a delivered one has
 * left the tabs. Orders not yet bought or shipped have no tab.
 */
export function orderTab(status: string | null | undefined): SearchTab | null {
  switch (String(status ?? "")) {
    case "in_china_warehouse":
    case "quality_check":
    case "in_batch":
      return "registered";
    case "in_transit":
    case "arrived":
      return "onTheWay";
    case "ready_for_delivery":
      return "arrived";
    default:
      return null;
  }
}

/** Orders that ended without goods: nothing to find. */
const ORDER_GONE = new Set(["cancelled", "rejected", "refunded"]);

// ---------------------------------------------------------------------------
// The rows the portal already has. Loose on purpose: each list's own type is
// wider, and the search reads only these fields.
// ---------------------------------------------------------------------------

export interface ParcelRow {
  id: number;
  packageCode?: string | null;
  trackingNumber?: string | null;
  description?: string | null;
  photos?: unknown;
  status?: string | null;
  shippingType?: string | null;
  weightKg?: string | number | null;
  volumeCbm?: string | number | null;
  batchId?: number | null;
  fullPackageOrderId?: number | null;
  registeredAt?: When;
  deliveredAt?: When;
  createdAt?: When;
  sizeConcealed?: boolean;
  /** Where it was registered — see registeredInChina in lib/packageStatus. */
  registeredInCountryId?: number | null;
}

export interface OrderRow {
  id: number;
  orderCode?: string | null;
  status?: string | null;
  productName?: string | null;
  productImage?: string | null;
  trackingNumber?: string | null;
  batchId?: number | null;
  createdAt?: When;
  deliveredAt?: When;
}

export interface BatchRow {
  id: number;
  batchCode?: string | null;
  shippingType?: string | null;
  estimatedArrival?: When;
  actualArrival?: When;
  statusDates?: Partial<Record<string, When>> | null;
}

export interface BoxRow {
  id: number;
  boxCode?: string | null;
  status?: string | null;
  totalPackages?: number | null;
  createdAt?: When;
  deliveredAt?: When;
  /** The parcels packed in it — see getCustomerVisibleBoxes. */
  packageIds?: readonly number[] | null;
}

export interface DeclaredRow {
  id: number;
  trackingNumber?: string | null;
  productName?: string | null;
  status?: string | null;
  createdAt?: When;
}

export interface SearchSources {
  parcels?: readonly ParcelRow[] | null;
  orders?: readonly OrderRow[] | null;
  batches?: readonly BatchRow[] | null;
  boxes?: readonly BoxRow[] | null;
  declared?: readonly DeclaredRow[] | null;
}

export type SearchKind = "parcel" | "order" | "box" | "declared";

/** Which date a card shows, and so which word stands before it. */
export type SearchDateKind = "registered" | "reachedErbil" | "delivered" | "ordered" | "declared" | "packed";

export const SEARCH_DATE_LABEL: Record<SearchDateKind, L> = {
  registered: { ku: "تۆمارکرا", en: "Registered", ar: "سُجّلت", zh: "登记" },
  reachedErbil: { ku: "گەیشتە هەولێر", en: "Reached Erbil", ar: "وصلت أربيل", zh: "到达埃尔比勒" },
  delivered: { ku: "گەیشتە دەستت", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
  ordered: { ku: "داواکرا", en: "Ordered", ar: "طُلبت", zh: "下单" },
  declared: { ku: "تۆمارت کرد", en: "You registered it", ar: "سجّلتها", zh: "您已登记" },
  packed: { ku: "سندوق کرا", en: "Boxed", ar: "عُبّئت", zh: "装箱" },
};

export interface SearchItem {
  /** Unique across kinds: "parcel:12", "order:5". */
  key: string;
  kind: SearchKind;
  id: number;
  tab: SearchTab | null;
  status: string;
  /** The large line: the tracking number, else the code. */
  title: string;
  /** What it is: the product, the parcel's description, the order number. */
  subtitle: string | null;
  date: When;
  dateKind: SearchDateKind;
  /** For ordering the list: newest movement first. */
  sortAt: number;
  image: string | null;
  orderId: number | null;
  batchId: number | null;
  boxId: number | null;
  // What the box matches against, folded once.
  trackingKeys: string[];
  codeKeys: string[];
  names: string[];
  // The rows behind the card, for the detail sheet.
  parcel?: ParcelRow;
  order?: OrderRow;
  batch?: BatchRow;
  box?: BoxRow;
  declared?: DeclaredRow;
}

/** A tracking number or code as it is compared: capitals and digits, nothing else. */
export function searchKey(text: string | null | undefined): string {
  return cleanTrackingPaste(String(text ?? "")).replace(/-/g, "");
}

const time = (when: When): number => {
  if (!when) return 0;
  const t = new Date(when).getTime();
  return Number.isFinite(t) ? t : 0;
};

const clean = (text: string | null | undefined): string | null => {
  const t = String(text ?? "").trim();
  return t ? t : null;
};

const keys = (...values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(values.map(searchKey).filter(Boolean)));

const names = (...values: Array<string | null | undefined>): string[] =>
  values.map((v) => normalizeSearch(v)).filter(Boolean);

/**
 * Everything the customer can find, joined once.
 *
 * A parcel carries its order (the product's name and picture, the order
 * number), its shipment's code and its box, so any of those numbers finds
 * the parcel. An order appears on its own only while no parcel stands for it
 * — otherwise the same goods would be listed twice. A registration appears
 * only while it waits for its parcel.
 */
export function buildSearchIndex(src: SearchSources): SearchItem[] {
  const orders = src.orders ?? [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const orderByTracking = new Map<string, OrderRow>();
  for (const o of orders) {
    const k = searchKey(o.trackingNumber);
    if (k && !orderByTracking.has(k)) orderByTracking.set(k, o);
  }
  const batchById = new Map((src.batches ?? []).map((b) => [b.id, b]));
  // Boxes arrive newest first; a parcel moved between boxes belongs to the newer.
  const boxByParcel = new Map<number, BoxRow>();
  for (const box of src.boxes ?? []) {
    for (const parcelId of box.packageIds ?? []) {
      if (!boxByParcel.has(parcelId)) boxByParcel.set(parcelId, box);
    }
  }

  const items: SearchItem[] = [];
  const ordersShown = new Set<number>();
  const parcelTrackings = new Set<string>();

  for (const p of src.parcels ?? []) {
    const tracking = searchKey(p.trackingNumber);
    if (tracking) parcelTrackings.add(tracking);
    const order =
      (p.fullPackageOrderId != null ? orderById.get(p.fullPackageOrderId) : undefined) ??
      (tracking ? orderByTracking.get(tracking) : undefined);
    if (order) ordersShown.add(order.id);
    const batch = p.batchId != null ? batchById.get(p.batchId) : undefined;
    const box = boxByParcel.get(p.id);
    const status = String(p.status ?? "");
    const tab = parcelTab(p);

    let date: When = p.registeredAt ?? p.createdAt;
    let dateKind: SearchDateKind = "registered";
    if (status === "delivered" && p.deliveredAt) {
      date = p.deliveredAt;
      dateKind = "delivered";
    } else if (tab === "arrived") {
      const reached = batch?.statusDates?.at_depot ?? batch?.actualArrival;
      if (reached) {
        date = reached;
        dateKind = "reachedErbil";
      }
    }

    items.push({
      key: `parcel:${p.id}`,
      kind: "parcel",
      id: p.id,
      tab,
      status,
      title: clean(p.trackingNumber) ?? clean(p.packageCode) ?? `#${p.id}`,
      subtitle: clean(order?.productName) ?? clean(p.description) ?? clean(order?.orderCode),
      date,
      dateKind,
      sortAt: Math.max(time(date), time(p.createdAt)),
      image: clean(order?.productImage),
      orderId: order?.id ?? null,
      batchId: p.batchId ?? null,
      boxId: box?.id ?? null,
      trackingKeys: keys(p.trackingNumber, order?.trackingNumber),
      codeKeys: keys(p.packageCode, order?.orderCode, batch?.batchCode, box?.boxCode),
      names: names(order?.productName, p.description),
      parcel: p,
      order,
      batch,
      box,
    });
  }

  for (const o of orders) {
    if (ordersShown.has(o.id)) continue;
    const status = String(o.status ?? "");
    if (ORDER_GONE.has(status)) continue;
    const delivered = status === "delivered" && !!o.deliveredAt;
    const date = delivered ? o.deliveredAt : o.createdAt;
    items.push({
      key: `order:${o.id}`,
      kind: "order",
      id: o.id,
      tab: orderTab(status),
      status,
      title: clean(o.trackingNumber) ?? clean(o.orderCode) ?? `#${o.id}`,
      subtitle: clean(o.productName) ?? clean(o.orderCode),
      date,
      dateKind: delivered ? "delivered" : "ordered",
      sortAt: time(date),
      image: clean(o.productImage),
      orderId: o.id,
      batchId: o.batchId ?? null,
      boxId: null,
      trackingKeys: keys(o.trackingNumber),
      codeKeys: keys(o.orderCode, o.batchId != null ? batchById.get(o.batchId)?.batchCode : null),
      names: names(o.productName),
      order: o,
      batch: o.batchId != null ? batchById.get(o.batchId) : undefined,
    });
  }

  for (const d of src.declared ?? []) {
    if (d.status !== "pending") continue;
    const tracking = searchKey(d.trackingNumber);
    if (!tracking || parcelTrackings.has(tracking)) continue;
    items.push({
      key: `declared:${d.id}`,
      kind: "declared",
      id: d.id,
      tab: null,
      status: "pending",
      title: clean(d.trackingNumber) ?? `#${d.id}`,
      subtitle: clean(d.productName),
      date: d.createdAt,
      dateKind: "declared",
      sortAt: time(d.createdAt),
      image: null,
      orderId: null,
      batchId: null,
      boxId: null,
      trackingKeys: [tracking],
      codeKeys: [],
      names: names(d.productName),
      declared: d,
    });
  }

  for (const b of src.boxes ?? []) {
    const delivered = !!b.deliveredAt;
    const date = delivered ? b.deliveredAt : b.createdAt;
    items.push({
      key: `box:${b.id}`,
      kind: "box",
      id: b.id,
      tab: null,
      status: String(b.status ?? ""),
      title: clean(b.boxCode) ?? `#${b.id}`,
      subtitle: null,
      date,
      dateKind: delivered ? "delivered" : "packed",
      sortAt: time(date),
      image: null,
      orderId: null,
      batchId: null,
      boxId: b.id,
      trackingKeys: [],
      codeKeys: keys(b.boxCode),
      names: [],
      box: b,
    });
  }

  return items;
}

export interface ParsedSearch {
  /** Capitals and digits: how numbers and codes are compared. */
  key: string;
  /** The words as typed, for names. */
  text: string;
  /** Short enough to mean "show me everything". */
  active: boolean;
}

export function parseSearch(raw: string): ParsedSearch {
  const key = searchKey(raw);
  const text = normalizeSearch(raw);
  return { key, text, active: key.length >= 2 || text.length >= 2 };
}

/**
 * How well one item answers the query, 0 when it does not.
 *
 *   100  the whole tracking number
 *    95  a whole code — order, box, parcel or shipment
 *    90  the tracking number's last digits (from four)
 *    80  its first characters (from four)
 *    75  a code's last characters (from three) — "005" for BOX-…-005
 *    72  a code's first characters (from three)
 *    70  anywhere inside the tracking number (from five)
 *    60  anywhere inside a code (from four)
 *  ≤ 50  the product's name — below every number, which is more exact
 */
export function searchScore(q: ParsedSearch, item: SearchItem): number {
  let best = 0;
  const k = q.key;
  if (k) {
    for (const t of item.trackingKeys) {
      if (t === k) best = Math.max(best, 100);
      else if (k.length >= 4 && t.endsWith(k)) best = Math.max(best, 90);
      else if (k.length >= 4 && t.startsWith(k)) best = Math.max(best, 80);
      else if (k.length >= 5 && t.includes(k)) best = Math.max(best, 70);
    }
    for (const c of item.codeKeys) {
      if (c === k) best = Math.max(best, 95);
      else if (k.length >= 3 && c.endsWith(k)) best = Math.max(best, 75);
      else if (k.length >= 3 && c.startsWith(k)) best = Math.max(best, 72);
      else if (k.length >= 4 && c.includes(k)) best = Math.max(best, 60);
    }
  }
  if (q.text.length >= 2) {
    for (const name of item.names) {
      // A prefix, a word, a substring, or every word somewhere — never the
      // letters-in-order guess, which finds half the catalogue on a phone.
      const s = matchScore(q.text, name);
      if (s >= 50) best = Math.max(best, s / 2);
    }
  }
  return best;
}

/**
 * The answers, best first.
 *
 * With nothing typed, it is the customer's goods — everything under one of
 * the three tabs — newest movement first. Boxes, registrations, returned
 * parcels and orders not yet bought are found by searching for them.
 */
export function searchItems(index: readonly SearchItem[], q: ParsedSearch): SearchItem[] {
  if (!q.active) {
    return index.filter((i) => i.tab !== null).sort((a, b) => b.sortAt - a.sortAt);
  }
  const scored: Array<{ item: SearchItem; score: number }> = [];
  for (const item of index) {
    const score = searchScore(q, item);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || b.item.sortAt - a.item.sortAt);
  return scored.map((s) => s.item);
}

/** How many answers sit under each tab — the live counts on the tabs. */
export function countByTab(items: readonly SearchItem[]): Record<SearchTab, number> {
  const counts: Record<SearchTab, number> = { arrived: 0, onTheWay: 0, registered: 0 };
  for (const item of items) if (item.tab) counts[item.tab]++;
  return counts;
}

/**
 * Where tapping a card goes, or null for the detail sheet.
 *
 * A place of its own wins when one exists: goods bought through an order open
 * that order; a parcel packed in a box opens the box's receipt, for a customer
 * whose money page shows boxes. Everything else opens the sheet in place.
 */
export function searchTarget(item: SearchItem, opts: { boxReceipts: boolean }): string | null {
  switch (item.kind) {
    case "order":
      return `/portal/full-package?order=${item.id}`;
    case "declared":
      return "/portal/declare";
    case "box":
      return opts.boxReceipts ? `/portal/financial?tab=boxes&box=${item.id}` : null;
    case "parcel":
      if (item.orderId != null) return `/portal/full-package?order=${item.orderId}`;
      if (item.boxId != null && opts.boxReceipts) return `/portal/financial?tab=boxes&box=${item.boxId}`;
      return null;
  }
}

/** Should the server be asked? Only when nothing loaded holds a number worth asking about. */
export function shouldAskServer(q: ParsedSearch, localMatches: number): boolean {
  return localMatches === 0 && q.key.length >= 5;
}

/**
 * What happens next, per parcel status — the line under the facts in the
 * detail sheet. Where to collect it once it is ready; what it is waiting for
 * before that. Nothing here names China: a parcel registered in Erbil never
 * went there.
 */
export const PARCEL_NEXT_STEP: Record<string, L> = {
  registered: {
    ku: "بارەکەت لە کۆگاکەمانە و چاوەڕوانی ناردنە لەگەڵ باری داهاتوو.",
    en: "Your parcel is at our depot, waiting to leave with the next shipment.",
    ar: "طردك في مستودعنا، بانتظار الشحنة القادمة.",
    zh: "您的包裹在我们的仓库，等待随下一批货物发出。",
  },
  in_batch: {
    ku: "خرایە ناو بار و بەم زووانە بەڕێ دەکرێت.",
    en: "Packed into a shipment that leaves soon.",
    ar: "أُضيف إلى شحنة تغادر قريباً.",
    zh: "已装入即将发出的货运。",
  },
  in_transit: {
    ku: "لە ڕێگادایە. کاتێک گەیشتە کۆگای هەولێر ئاگادارت دەکەینەوە.",
    en: "On its way. We will let you know when it reaches the Erbil depot.",
    ar: "في الطريق. سنبلغك عند وصوله إلى مستودع أربيل.",
    zh: "运输途中。到达埃尔比勒仓库后我们会通知您。",
  },
  customs_processing: {
    ku: "لە گومرگدایە. دوای دەرچوون دەگاتە کۆگای هەولێر.",
    en: "At customs. It goes to the Erbil depot once cleared.",
    ar: "في الجمارك. يُنقل إلى مستودع أربيل بعد التخليص.",
    zh: "清关中。清关后将运往埃尔比勒仓库。",
  },
  ready_for_delivery: {
    ku: "ئامادەیە بۆ وەرگرتن لە کۆگای هەولێر. ئەگەر پرسیارێکت هەیە، پێش هاتن لە واتسئەپ پەیوەندیمان پێوە بکە.",
    en: "Ready to collect at the Erbil depot. Questions before you come? Message us on WhatsApp.",
    ar: "جاهز للاستلام من مستودع أربيل. لديك سؤال قبل الحضور؟ راسلنا على واتساب.",
    zh: "可在埃尔比勒仓库领取。来之前有疑问？请通过 WhatsApp 联系我们。",
  },
  out_for_delivery: {
    ku: "لە ڕێی گەیاندنە بۆ لات. تەلەفۆنەکەت بە کراوەیی بهێڵەرەوە.",
    en: "Out for delivery to you. Keep your phone on.",
    ar: "خرج للتسليم إليك. أبقِ هاتفك مفتوحاً.",
    zh: "正在派送给您，请保持电话畅通。",
  },
  delivered: {
    ku: "گەیشتە دەستت.",
    en: "Delivered to you.",
    ar: "تم تسليمه إليك.",
    zh: "已交付给您。",
  },
  returned: {
    ku: "ئەم بارە گەڕێندراوەتەوە. بۆ زانیاری لە واتسئەپ پەیوەندیمان پێوە بکە.",
    en: "This parcel was returned. Message us on WhatsApp for details.",
    ar: "أُعيد هذا الطرد. راسلنا على واتساب للتفاصيل.",
    zh: "此包裹已退回。详情请通过 WhatsApp 联系我们。",
  },
  cancelled: {
    ku: "ئەم بارە هەڵوەشێنراوەتەوە. بۆ زانیاری لە واتسئەپ پەیوەندیمان پێوە بکە.",
    en: "This parcel was cancelled. Message us on WhatsApp for details.",
    ar: "أُلغي هذا الطرد. راسلنا على واتساب للتفاصيل.",
    zh: "此包裹已取消。详情请通过 WhatsApp 联系我们。",
  },
};

/** An order that is not yet bought or shipped. */
export const ORDER_NOT_SHIPPED_LABEL: L = {
  ku: "هێشتا نەنێردراوە",
  en: "Not shipped yet",
  ar: "لم تُشحن بعد",
  zh: "尚未发货",
};

/** A registration still waiting for its parcel. */
export const DECLARED_PENDING_LABEL: L = {
  ku: "چاوەڕوانی گەیشتنە",
  en: "Awaiting arrival",
  ar: "بانتظار الوصول",
  zh: "等待到货",
};

// ---------------------------------------------------------------------------
// Recent searches — kept on the phone, one tap to run again.
// ---------------------------------------------------------------------------

export const RECENT_SEARCHES_KEY = "wazn_portal_recent_searches";
const RECENT_SEARCHES_MAX = 8;

export function loadRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string").slice(0, RECENT_SEARCHES_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string, current: readonly string[]): string[] {
  const q = query.trim();
  if (q.length < 2) return [...current];
  const next = [q, ...current.filter((r) => r !== q)].slice(0, RECENT_SEARCHES_MAX);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Storage full or refused — history is a convenience, never an error.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}
