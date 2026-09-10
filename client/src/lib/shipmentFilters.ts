/**
 * Grouping the six batch statuses into the three stages a customer recognises.
 *
 * The database tracks preparing → in_transit → arrived → customs → delivered →
 * closed. A customer does not think in six steps; they want to know whether
 * their goods are still in China, on the way, or in their hands.
 *
 * The old grouping put "arrived" and "customs" — goods already in Iraq — in the
 * same bucket as "preparing". That was wrong, and only went unnoticed because
 * the bucket was vaguely labelled "preparing". Naming it "in the China
 * warehouse" made the error impossible to miss.
 */

export type BatchStatus =
  | "preparing"
  | "in_transit"
  | "arrived"
  | "customs"
  // Cleared customs, waiting in the Erbil depot to be collected.
  | "at_depot"
  | "delivered"
  | "closed";

/** "" is no filter — what the removed "All" chip used to mean. */
export type ShipmentStage = "" | "in_china" | "in_transit" | "delivered";

const STAGE_OF: Record<BatchStatus, Exclude<ShipmentStage, "">> = {
  preparing: "in_china",
  // In Iraq, but not yet handed over — from the customer's side, still coming.
  in_transit: "in_transit",
  arrived: "in_transit",
  customs: "in_transit",
  // In Erbil, but still not handed over — from the customer's side, coming.
  at_depot: "in_transit",
  delivered: "delivered",
  closed: "delivered",
};

/** Which of the three stages a raw status belongs to. */
export function stageOf(status: string): Exclude<ShipmentStage, ""> | null {
  return STAGE_OF[status as BatchStatus] ?? null;
}

/** Does this batch belong under the chosen stage? No stage means everything. */
export function matchesStage(status: string, stage: ShipmentStage): boolean {
  if (!stage) return true;
  return stageOf(status) === stage;
}

/**
 * What each status is called, in one place.
 *
 * Two screens used to name these independently, and both had "گەیشتووە" for
 * `arrived` and again for `delivered` — the same word for "it reached Iraq"
 * and "you have it", which is the difference a customer most wants to know.
 * The wording also matches the stage filters, so the list and the detail page
 * speak the same language.
 */
export const STATUS_LABEL: Record<
  BatchStatus,
  { ku: string; en: string; ar: string; zh: string }
> = {
  preparing: { ku: "لە کۆگای چین", en: "In China", ar: "في مستودع الصين", zh: "中国仓库" },
  in_transit: { ku: "لە ڕێگادا", en: "In transit", ar: "في الطريق", zh: "运输中" },
  arrived: { ku: "گەیشتە عێراق", en: "Reached Iraq", ar: "وصلت العراق", zh: "抵达伊拉克" },
  customs: { ku: "لە گومرگ", en: "At customs", ar: "في الجمارك", zh: "清关中" },
  // Mirrors "لە کۆگای چین" at the other end of the journey: through customs,
  // in Erbil, ready to be collected.
  at_depot: { ku: "لە کۆگای هەولێر", en: "Erbil depot", ar: "في مستودع أربيل", zh: "埃尔比勒仓库" },
  delivered: { ku: "گەیشتە دەستت", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
  closed: { ku: "تەواو بوو", en: "Closed", ar: "مغلق", zh: "已完成" },
};

/** How a shipment travels, for anywhere that shows the raw column value. */
export const SHIPPING_TYPE_LABEL: Record<
  string,
  { ku: string; en: string; ar: string; zh: string }
> = {
  air_regular: { ku: "ئاسمانی ئاسایی", en: "Air · standard", ar: "جوي عادي", zh: "空运 · 标准" },
  air_irregular: { ku: "ئاسمانی نائاسایی", en: "Air · special", ar: "جوي خاص", zh: "空运 · 特殊" },
  sea: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" },
};

/**
 * Full-package and commission orders travel the same road, but the table
 * tracks them with its own vocabulary — `in_china_warehouse` rather than
 * `registered`, `arrived` rather than `customs_processing`, and so on.
 *
 * Two ladders and two pages is how the portal came to contradict itself: an
 * order sitting in the China depot said so on "My goods" and was missing
 * entirely from "Shipments". Mapping both onto the same three stages is what
 * keeps the two pages telling one story.
 *
 * Statuses before the goods physically exist — quoted, approved, ordered —
 * deliberately map to nothing. Nothing has shipped yet, so nothing belongs on
 * a shipments page.
 */
const ORDER_STAGE: Record<string, Exclude<ShipmentStage, "">> = {
  in_china_warehouse: "in_china",
  quality_check: "in_china",
  in_batch: "in_transit",
  in_transit: "in_transit",
  arrived: "in_transit",
  ready_for_delivery: "in_transit",
  delivered: "delivered",
};

/** Which stage a full-package / commission order sits in, if any. */
export function orderStageOf(status: string): Exclude<ShipmentStage, ""> | null {
  return ORDER_STAGE[status] ?? null;
}

/**
 * The status name to show for an order, in the same words the rest of the
 * portal uses. Falls back to null for anything not yet on the road.
 */
export function orderStatusLabel(
  status: string,
): { ku: string; en: string; ar: string; zh: string } | null {
  switch (status) {
    case "in_china_warehouse":
    case "quality_check":
      return STATUS_LABEL.preparing;
    case "in_batch":
    case "in_transit":
      return STATUS_LABEL.in_transit;
    case "arrived":
      return STATUS_LABEL.arrived;
    case "ready_for_delivery":
      return STATUS_LABEL.at_depot;
    case "delivered":
      return STATUS_LABEL.delivered;
    default:
      return null;
  }
}

/**
 * Landed in Iraq but not yet handed over: arrived, customs, at_depot.
 *
 * The home pipeline's third card. It is a finer cut of the "in_transit"
 * stage — stageOf stays the shipments page's three-way contract — and it
 * lives here so the card's number and the list its tap shows come from the
 * same predicate instead of two screens deciding "in Iraq" for themselves.
 */
export const IN_IRAQ_STATUSES = ["arrived", "customs", "at_depot"] as const;

export function isInIraqNotDelivered(status: string): boolean {
  return (IN_IRAQ_STATUSES as readonly string[]).includes(status);
}

/** The order ladder's twin of IN_IRAQ_STATUSES, kept beside it on purpose. */
export const ORDER_IN_IRAQ_STATUSES = ["arrived", "ready_for_delivery"] as const;

export function isOrderInIraqNotDelivered(status: string): boolean {
  return (ORDER_IN_IRAQ_STATUSES as readonly string[]).includes(status);
}

/** How many batches sit in each stage, for the filter counts. */
export function countByStage(statuses: string[]): Record<Exclude<ShipmentStage, "">, number> {
  const counts = { in_china: 0, in_transit: 0, delivered: 0 };
  for (const status of statuses) {
    const stage = stageOf(status);
    if (stage) counts[stage] += 1;
  }
  return counts;
}

/**
 * The colour of each batch status, in one place.
 *
 * Four screens kept private colour switches and they disagreed: in transit
 * was sky on the home, blue on the list; arrived, at_depot and preparing all
 * fell through to grey everywhere, so a shipment sitting in the Erbil depot
 * — the one moment a customer needs to act — looked the same as one still
 * being packed in China. The words already came from STATUS_LABEL; the
 * colours now do too.
 *
 * Owner palette: sky for moving, emerald for anything in Iraq or handed
 * over, amber for a wait the office cannot shorten, slate for not yet begun.
 * Both themes in every entry, so a screen never has to branch on the theme.
 */
export const BATCH_STATUS_TONE: Record<BatchStatus, string> = {
  preparing: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_transit: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  arrived: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  customs: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  at_depot: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

/** The chip classes for a status, or the neutral chip for one nobody knows. */
export function batchStatusTone(status: string | null | undefined): string {
  return BATCH_STATUS_TONE[status as BatchStatus] ?? BATCH_STATUS_TONE.preparing;
}
