/**
 * The vocabulary of deep links into the lists.
 *
 * The dashboard is full of figures — today's income, new customers this week,
 * active shipments, parcels delivered — and every one of them is the end of a
 * count. Asking "which ones?" meant opening the list and rebuilding the filter
 * by hand, if you could work out what the filter had been.
 *
 * The obvious fix is to make each figure a link. The trap is that a link to an
 * unfiltered list is worse than no link at all: it looks like an answer. "New
 * customers (7 days): 6" landing on all twelve hundred customers is a lie told
 * politely.
 *
 * So the query parameters are named here, once, and both ends use these
 * functions — the dashboard to build the link, the list page to read it. A
 * renamed parameter breaks the build rather than quietly emptying a filter.
 *
 * Nothing here queries anything. It is the shape of a URL, and it is shared so
 * that the two ends cannot disagree about it.
 */

/* ─── customers ─────────────────────────────────────────────────────────── */

export type CustomerStatusFilter = "all" | "active" | "inactive";
export type CustomerServiceFilter = "all" | "full_package" | "commission" | "self_order";

export interface CustomersLink {
  status?: CustomerStatusFilter;
  service?: CustomerServiceFilter;
  city?: string;
  /** Registered within this many days. The dashboard's "new customers" card. */
  createdWithin?: number;
  search?: string;
}

/* ─── parcels ───────────────────────────────────────────────────────────── */

/**
 * The tabs the parcels table already has. Named here so a link can only ask
 * for a view that exists.
 */
export type PackagesTab =
  | "all"
  | "no_batch"
  | "no_tracking"
  | "pending_delivery"
  | "delivered";

export interface PackagesLink {
  tab?: PackagesTab;
  search?: string;
  /** A batch id, as the table's own filter expects it. */
  batch?: string;
  /**
   * Registered on this day, as YYYY-MM-DD. What a point on the dashboard's
   * daily chart means — without it, clicking a bar could only ever open the
   * whole table.
   */
  day?: string;
}

/* ─── shipments ─────────────────────────────────────────────────────────── */

export const BATCH_STATUSES = [
  "preparing",
  "in_transit",
  "arrived",
  "customs",
  "at_depot",
  "delivered",
  "closed",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/**
 * What the dashboard's "active shipments" figure counts.
 *
 * "Active" is not a status a shipment has, so somebody has to decide which
 * statuses it means — and the count and the list have to decide it the same
 * way, or clicking a figure of 4 opens a list of 7 and neither number can be
 * trusted afterwards.
 *
 * Everything before the goods are handed over. It used to be the first three
 * only, which left a shipment sitting in customs or at the Erbil depot out of
 * the count — the two stages where somebody most often has work to do. The
 * office reads this figure to answer "how much is in flight", and a shipment
 * stuck at customs is very much in flight.
 *
 * Expect the number to be larger than it was. That is the correction, not a
 * fault.
 */
export const ACTIVE_BATCH_STATUSES: BatchStatus[] = [
  "preparing",
  "in_transit",
  "arrived",
  "customs",
  "at_depot",
];

export type BatchStatusFilter = "all" | "active" | BatchStatus;
export type BatchTypeFilter = "all" | "air_regular" | "air_irregular" | "sea";

export interface BatchesLink {
  status?: BatchStatusFilter;
  type?: BatchTypeFilter;
}

/** Is this shipment in the set the given filter asks for? */
export function batchMatchesStatus(status: string | null | undefined, filter?: BatchStatusFilter): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "active") return ACTIVE_BATCH_STATUSES.includes(status as BatchStatus);
  return status === filter;
}

/* ─── money ─────────────────────────────────────────────────────────────── */

export type FinanceTab = "overview" | "accounts" | "payments" | "credit-customers";

export interface FinanceLink {
  tab?: FinanceTab;
}

/* ─── building and reading ──────────────────────────────────────────────── */

/** Drops empty values and anything that means "no filter". */
function query(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const s = String(value).trim();
    if (!s || s === "all") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(s)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** The query string of a URL or a bare search string, either way. */
function params(search: string): URLSearchParams {
  const q = search.includes("?") ? search.slice(search.indexOf("?")) : search;
  return new URLSearchParams(q.startsWith("?") ? q.slice(1) : q);
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function customersHref(link: CustomersLink = {}): string {
  return `/customers${query({
    status: link.status,
    service: link.service,
    city: link.city,
    createdWithin: link.createdWithin,
    search: link.search,
  })}`;
}

export function readCustomersLink(search: string): CustomersLink {
  const p = params(search);
  const days = Number(p.get("createdWithin"));
  return {
    status: oneOf(p.get("status"), ["all", "active", "inactive"] as const),
    service: oneOf(p.get("service"), ["all", "full_package", "commission", "self_order"] as const),
    city: p.get("city") || undefined,
    // A nonsense value is no filter, not a filter that hides everything.
    createdWithin: Number.isFinite(days) && days > 0 ? days : undefined,
    search: p.get("search") || undefined,
  };
}

/** The parcels table lives at /packages/all — /packages is the summary. */
export function packagesHref(link: PackagesLink = {}): string {
  return `/packages/all${query({ tab: link.tab, search: link.search, batch: link.batch, day: link.day })}`;
}

export function readPackagesLink(search: string): PackagesLink {
  const p = params(search);
  return {
    tab: oneOf(p.get("tab"), ["all", "no_batch", "no_tracking", "pending_delivery", "delivered"] as const),
    search: p.get("search") || undefined,
    batch: p.get("batch") || undefined,
    // Anything that is not a plain calendar date is no filter, rather than a
    // filter that quietly matches nothing.
    day: /^\d{4}-\d{2}-\d{2}$/.test(p.get("day") ?? "") ? p.get("day")! : undefined,
  };
}

export function batchesHref(link: BatchesLink = {}): string {
  return `/batches${query({ status: link.status, type: link.type })}`;
}

export function readBatchesLink(search: string): BatchesLink {
  const p = params(search);
  return {
    status: oneOf(p.get("status"), ["all", "active", ...BATCH_STATUSES] as const),
    type: oneOf(p.get("type"), ["all", "air_regular", "air_irregular", "sea"] as const),
  };
}

export function financeHref(link: FinanceLink = {}): string {
  return `/finance${query({ tab: link.tab })}`;
}

export function readFinanceLink(search: string): FinanceLink {
  const p = params(search);
  return {
    tab: oneOf(p.get("tab"), ["overview", "accounts", "payments", "credit-customers"] as const),
  };
}

/* ─── saying what is filtered ───────────────────────────────────────────── */

export interface Localised {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

/**
 * What a page says when it opened already filtered.
 *
 * A list that arrives short with no explanation reads as missing data. The
 * banner names the filter and offers to drop it, so nobody concludes their
 * customers have disappeared.
 */
export const FILTERED_BY: Localised = {
  ku: "ئەم لیستە فلتەر کراوە",
  en: "This list is filtered",
  ar: "هذه القائمة مُصفّاة",
  zh: "此列表已筛选",
};

export const SHOW_ALL: Localised = {
  ku: "هەمووی پیشان بدە",
  en: "Show all",
  ar: "عرض الكل",
  zh: "显示全部",
};

export const FILTER_LABEL: Record<string, Localised> = {
  active: { ku: "چالاک", en: "Active", ar: "نشط", zh: "进行中" },
  inactive: { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" },
  delivered: { ku: "گەیەنراو", en: "Delivered", ar: "تم التسليم", zh: "已送达" },
  preparing: { ku: "لە ئامادەکاریدا", en: "Preparing", ar: "قيد التحضير", zh: "准备中" },
  in_transit: { ku: "لە ڕێگادا", en: "In transit", ar: "في الطريق", zh: "运输中" },
  arrived: { ku: "گەیشتووە", en: "Arrived", ar: "وصلت", zh: "已抵达" },
  customs: { ku: "گومرگ", en: "Customs", ar: "الجمارك", zh: "海关" },
  at_depot: { ku: "لە کۆگا", en: "At depot", ar: "في المستودع", zh: "在仓库" },
  closed: { ku: "داخراو", en: "Closed", ar: "مغلقة", zh: "已关闭" },
  no_batch: { ku: "بێ باچ", en: "Not in a shipment", ar: "بدون دفعة", zh: "未装批次" },
  no_tracking: { ku: "بێ تراکینگ", en: "No tracking number", ar: "بدون رقم تتبع", zh: "无运单号" },
  pending_delivery: { ku: "چاوەڕوانی گەیاندن", en: "Awaiting delivery", ar: "بانتظار التسليم", zh: "待派送" },
  air_regular: { ku: "ئاسمانی ئاسایی", en: "Air regular", ar: "جوي عادي", zh: "普通空运" },
  air_irregular: { ku: "ئاسمانی مەترسیدار", en: "Air special", ar: "جوي خاص", zh: "特殊空运" },
  sea: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" },
  full_package: { ku: "پاکێجی تەواو", en: "Full package", ar: "الطرد الكامل", zh: "整包代购" },
  commission: { ku: "عمولە", en: "Commission", ar: "عمولة", zh: "代购佣金" },
  self_order: { ku: "تۆماری خۆی", en: "Self order", ar: "طلب ذاتي", zh: "自购订单" },
};

/** "Registered in the last 7 days", in each language. */
export function withinDaysLabel(days: number): Localised {
  return {
    ku: `لە ${days} ڕۆژی ڕابردوودا`,
    en: `In the last ${days} days`,
    ar: `خلال آخر ${days} يوماً`,
    zh: `最近 ${days} 天`,
  };
}
