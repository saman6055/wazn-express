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
  closed: { ku: "تەواو بوو", en: "Completed", ar: "مكتمل", zh: "已完成" },
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
  // Grouped with delivered, so coloured like it — not like "not started".
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

/** The chip classes for a status, or the neutral chip for one nobody knows. */
export function batchStatusTone(status: string | null | undefined): string {
  return BATCH_STATUS_TONE[status as BatchStatus] ?? BATCH_STATUS_TONE.preparing;
}

/* ─── the order they are read in ──────────────────────────────────────── */

/**
 * Where a shipment stands on the road, for sorting and for grouping.
 *
 * The owner, 2026-09-26: «قۆناغەکان زۆر تێکەلن — سەرەتا ئەوانە نیشان بدات
 * کە تازە گەیشتوونەتە مەخزەن، بە گوێرەی تایم لاین، یەکەم ستێپەکان، پاشان
 * دووەم، تا کۆتایی.»
 *
 * The list was sorted by the date the batch was created, which mixes a box
 * waiting to be collected in with goods that landed in China this morning.
 * A customer does not think in dates; they think in "where is it now", and
 * the road has an order of its own.
 *
 * Five steps, because five is what the parcel timeline already has
 * (shared/parcelStage) and two answers to "how far along is it" is one too
 * many. The seven raw statuses fold into them: customs and arrived are both
 * "it is in Iraq", closed is delivered.
 */
export const JOURNEY_STEPS = ["in_china", "on_way", "in_iraq", "in_erbil", "delivered"] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

const JOURNEY_OF: Record<BatchStatus, JourneyStep> = {
  preparing: "in_china",
  in_transit: "on_way",
  arrived: "in_iraq",
  customs: "in_iraq",
  at_depot: "in_erbil",
  delivered: "delivered",
  closed: "delivered",
};

/** Which step a raw status stands on. An unknown status is treated as new. */
export function journeyOf(status: string | null | undefined): JourneyStep {
  return JOURNEY_OF[(status ?? "") as BatchStatus] ?? "in_china";
}

/** 0 for the first step, 4 for the last — the order the list is read in. */
export function journeyRank(status: string | null | undefined): number {
  return JOURNEY_STEPS.indexOf(journeyOf(status));
}

/** What each step is called at the head of its group. */
export const JOURNEY_LABEL: Record<JourneyStep, { ku: string; en: string; ar: string; zh: string }> = {
  in_china: {
    ku: "تازە گەیشتوونەتە کۆگای چین",
    en: "Just arrived at the China warehouse",
    ar: "وصلت للتو إلى مستودع الصين",
    zh: "刚到中国仓库",
  },
  on_way: { ku: "لە ڕێگان", en: "On the way", ar: "في الطريق", zh: "运输途中" },
  in_iraq: { ku: "گەیشتوونەتە عێراق", en: "Arrived in Iraq", ar: "وصلت العراق", zh: "已抵达伊拉克" },
  in_erbil: {
    ku: "لە کۆگای هەولێر — ئامادە بۆ وەرگرتن",
    en: "In the Erbil depot — ready to collect",
    ar: "في مستودع أربيل — جاهزة للاستلام",
    zh: "埃尔比勒仓库 — 可自取",
  },
  delivered: { ku: "گەیشتوونەتە دەستت", en: "In your hands", ar: "في يدك", zh: "已在您手中" },
};

/** One quiet line under the heading: what is happening, in plain words. */
export const JOURNEY_HINT: Record<JourneyStep, { ku: string; en: string; ar: string; zh: string }> = {
  in_china: {
    ku: "وەرمانگرتوون — چاوەڕێی ناردنن",
    en: "We have them — waiting to be sent",
    ar: "استلمناها — بانتظار الشحن",
    zh: "已收到 — 等待发运",
  },
  on_way: { ku: "بەڕێکەوتوون بۆ عێراق", en: "On their way to Iraq", ar: "في طريقها إلى العراق", zh: "正在运往伊拉克" },
  in_iraq: { ku: "ئامادەکارییان بۆ دەکرێت", en: "Being prepared for you", ar: "يجري تجهيزها لك", zh: "正在为您备货" },
  in_erbil: { ku: "دەتوانیت وەریانبگریت", en: "You can collect them", ar: "يمكنك استلامها", zh: "您可以领取" },
  delivered: { ku: "", en: "", ar: "", zh: "" },
};

/**
 * The shipments in the order they are read: along the road, newest first
 * inside each step.
 *
 * Empty steps are left out rather than shown empty — a heading with nothing
 * under it is a question ("why is that there?"), not information.
 */
export function groupByJourney<T extends { status?: string | null; createdAt?: unknown }>(
  rows: readonly T[],
): Array<{ step: JourneyStep; rows: T[] }> {
  const newestFirst = (a: T, b: T) =>
    new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime();
  return JOURNEY_STEPS
    .map((step) => ({ step, rows: rows.filter((r) => journeyOf(r.status) === step).sort(newestFirst) }))
    .filter((group) => group.rows.length > 0);
}
