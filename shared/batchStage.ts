/**
 * Where a batch is, read off what the system recorded — never chosen by hand.
 *
 * The owner, 2026-10-28, looking at AIR-2026-072GZ: it had its waybill, its
 * Erbil twin, nine days in the air, and the list still said «ئامادەکاری»,
 * because a batch only moved when somebody remembered to pick the next word
 * from a dropdown. «لەسەر قۆناغەکان ڕێکەوتین چۆن چۆنی بە تۆماتیکی بگۆڕێ».
 * His stages, each from one real event:
 *
 *   China batch
 *     لە کۆگای چین            quick-registered in China (or simply made)
 *     ئامادەکاری گواستنەوە    the carton check was finished (dispatchCheckedAt)
 *     لە ڕێگا                 the AWB / container number, or an Erbil twin
 *     گومرگ                   by hand only — a load held at customs
 *     لە کۆگای هەولێر         the first arrival scan in Erbil
 *     ئامادەیە بۆ دابەشکردن   40 hours after the LAST arrival scan
 *     داخراو                  by hand — the admin closes it; it goes to the archive
 *
 *   Erbil batch — quick-registered in Erbil means it is in the Erbil depot,
 *   then the same 40 hours, then closed.
 *
 * Two layers, so nothing that reads `batches.status` today has to change:
 *
 *   - the STORED status is moved forward by the server alone, from the facts
 *     (`batchStatusFloor`), and never backwards (`BATCH_STATUS_RANK`);
 *   - the two in-between stages — packed, ready to distribute — are DERIVED
 *     here from a date, because a timer that has to fire to move a row is
 *     exactly the kind of write that is forgotten.
 *
 * «گەیشت» and «گەیەنرا» are gone from the batch: the first never said where,
 * and the second belongs to a customer's box (paid = delivered), not to a
 * container. A batch stored as `arrived` reads as the Erbil depot, one stored
 * as `delivered` as ready to distribute.
 */

export const BATCH_STAGES = [
  "china_depot",
  "packed",
  "on_road",
  "customs",
  "erbil_depot",
  "ready",
  "closed",
] as const;

export type BatchStage = (typeof BATCH_STAGES)[number];

/** Owner: «لە دوایین سکان پاش 40 کاتژمێر». */
export const READY_AFTER_HOURS = 40;

/** How far along a stored status is. Only ever used to refuse going back. */
export const BATCH_STATUS_RANK: Record<string, number> = {
  preparing: 0,
  in_transit: 1,
  arrived: 2,
  customs: 2,
  at_depot: 3,
  delivered: 4,
  closed: 5,
};

/**
 * Made by the China office. A batch from before the place was recorded
 * (createdInCountryId null) went through China - the same reading the parcel
 * timeline makes (shared/parcelStage registeredAtOrigin). Reading null as
 * Erbil would send every old open batch with a parcel in it to the Erbil depot.
 */
export function batchMadeInChina(createdInCountryId: number | null | undefined, chinaIds: Set<number>): boolean {
  return createdInCountryId == null || chinaIds.has(Number(createdInCountryId));
}

/**
 * May parcels still be registered or scanned into this batch?
 *
 * The owner, 2026-10-28: an Erbil batch takes goods at every stage until it
 * is closed - it reaches «لە کۆگای هەولێر» on its first registration, and
 * the next parcel must still find it. A China batch takes them while it is
 * in China or on the road, as before.
 */
export function batchOpenForRegistration(b: { status: string | null | undefined; madeInChina?: boolean | null }): boolean {
  const status = String(b.status ?? "");
  if (b.madeInChina === false) return status !== "closed";
  return status === "preparing" || status === "in_transit";
}

/** The facts the stored status is read from. */
export interface BatchStatusFacts {
  status: string | null | undefined;
  /** Made by the China office (createdInCountryId is China). */
  madeInChina: boolean;
  /** The AWB by air, the container number by sea. */
  hasShipmentNumber: boolean;
  /** An Erbil twin was made from this batch: the goods flew. */
  hasTwin: boolean;
  /** Parcels in the batch. */
  packageCount: number;
  /** Arrival scans (received_local) on its parcels. */
  arrivalScans: number;
}

/**
 * The furthest stored status the facts prove, or null when they prove
 * nothing beyond where it already is.
 */
export function batchStatusFloor(f: BatchStatusFacts): string | null {
  if (!f.madeInChina) {
    // Erbil batch: registered here is in the depot here.
    return f.packageCount > 0 ? "at_depot" : null;
  }
  // A scan in Erbil proves the goods are here — but only of a shipment that
  // has a number to have travelled under (an empty new batch scanned by
  // mistake must not jump to Erbil; batches.db advanceBatchToDepot).
  if (f.arrivalScans > 0 && f.hasShipmentNumber) return "at_depot";
  if (f.hasShipmentNumber || f.hasTwin) return "in_transit";
  return null;
}

/** The status to store: the floor if it is ahead, else what it already is. Never back. */
export function nextStoredStatus(f: BatchStatusFacts): string | null {
  const current = String(f.status ?? "preparing");
  if (current === "delivered" || current === "closed") return null;
  const floor = batchStatusFloor(f);
  if (!floor) return null;
  return (BATCH_STATUS_RANK[floor] ?? 0) > (BATCH_STATUS_RANK[current] ?? 0) ? floor : null;
}

/**
 * The moves a person may still make: customs (a hold the system cannot see)
 * and closing. Everything else follows the facts, and nothing goes back.
 */
export function manualMoveAllowed(from: string | null | undefined, to: string): boolean {
  const current = String(from ?? "preparing");
  if (current === "closed") return false;
  if (to === "closed") return true;
  if (to === "customs") return current === "in_transit";
  return false;
}

type DateLike = Date | string | null | undefined;
const asTime = (v: DateLike): number | null => {
  if (!v) return null;
  const t = (v instanceof Date ? v : new Date(v)).getTime();
  return Number.isNaN(t) ? null : t;
};

export interface BatchStageFacts {
  status: string | null | undefined;
  /** The carton check in China was finished. */
  dispatchCheckedAt?: DateLike;
  /** The last arrival scan (China batch) or quick registration (Erbil batch) in Erbil. */
  lastArrivalAt?: DateLike;
}

/** The stage to show, the same on the office list and in the portal. */
export function batchStage(f: BatchStageFacts, now: Date = new Date()): BatchStage {
  switch (String(f.status ?? "preparing")) {
    case "closed":
      return "closed";
    case "delivered":
      return "ready";
    case "customs":
      return "customs";
    case "arrived":
    case "at_depot": {
      const last = asTime(f.lastArrivalAt);
      return last !== null && now.getTime() - last >= READY_AFTER_HOURS * 3600_000 ? "ready" : "erbil_depot";
    }
    case "in_transit":
      return "on_road";
    default:
      return asTime(f.dispatchCheckedAt) !== null ? "packed" : "china_depot";
  }
}

/** The stages a batch walks: an Erbil batch starts in Erbil. Customs only when it happened. */
export function stagesForBatch(madeInChina: boolean, stage: BatchStage): BatchStage[] {
  const all = madeInChina ? [...BATCH_STAGES] : (["erbil_depot", "ready", "closed"] as BatchStage[]);
  return stage === "customs" ? all : all.filter((s) => s !== "customs");
}

/**
 * The same stage, from one customer's side: once every parcel of theirs is in
 * their hands the batch is finished for them, whatever the container is still
 * doing (shared/customerBatchStage). A closed batch is not a stage a customer
 * needs - for them it is either delivered or still in Erbil.
 */
export type CustomerBatchStage = Exclude<BatchStage, "closed"> | "delivered";

export function customerBatchStage(customerStatus: string, f: Omit<BatchStageFacts, "status">, now: Date = new Date()): CustomerBatchStage {
  if (customerStatus === "delivered" || customerStatus === "closed") return "delivered";
  const s = batchStage({ ...f, status: customerStatus }, now);
  return s === "closed" ? "delivered" : s;
}

export function customerStagesFor(fromErbil: boolean, stage: CustomerBatchStage): CustomerBatchStage[] {
  const steps = stagesForBatch(!fromErbil, stage === "delivered" ? "ready" : stage).filter((s) => s !== "closed") as CustomerBatchStage[];
  return [...steps, "delivered"];
}

export const CUSTOMER_STAGE_LABEL: Record<CustomerBatchStage, { ku: string; en: string; ar: string; zh: string }> = {
  china_depot: { ku: "لە کۆگای چین", en: "China depot", ar: "في مستودع الصين", zh: "中国仓库" },
  packed: { ku: "ئامادەکاری گواستنەوە", en: "Packed to ship", ar: "تجهيز للشحن", zh: "装箱待运" },
  on_road: { ku: "لە ڕێگا", en: "On the way", ar: "في الطريق", zh: "运输中" },
  customs: { ku: "گومرگ", en: "Customs", ar: "الجمارك", zh: "清关中" },
  erbil_depot: { ku: "لە کۆگای هەولێر", en: "Erbil depot", ar: "في مستودع أربيل", zh: "埃尔比勒仓库" },
  ready: { ku: "ئامادەیە بۆ دابەشکردن", en: "Ready to distribute", ar: "جاهز للتوزيع", zh: "待派送" },
  delivered: { ku: "گەیشتە دەستت", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
};

/** Owner's words. The customer reads the same words for the same moment. */
export const BATCH_STAGE_LABEL: Record<BatchStage, { ku: string; en: string; ar: string; zh: string }> = {
  china_depot: { ku: "لە کۆگای چین", en: "China depot", ar: "في مستودع الصين", zh: "中国仓库" },
  packed: { ku: "ئامادەکاری گواستنەوە", en: "Packed to ship", ar: "تجهيز للشحن", zh: "装箱待运" },
  on_road: { ku: "لە ڕێگا", en: "On the way", ar: "في الطريق", zh: "运输中" },
  customs: { ku: "گومرگ", en: "Customs", ar: "الجمارك", zh: "清关中" },
  erbil_depot: { ku: "لە کۆگای هەولێر", en: "Erbil depot", ar: "في مستودع أربيل", zh: "埃尔比勒仓库" },
  ready: { ku: "ئامادەیە بۆ دابەشکردن", en: "Ready to distribute", ar: "جاهز للتوزيع", zh: "待派送" },
  closed: { ku: "داخراو", en: "Closed", ar: "مغلق", zh: "已关闭" },
};

/**
 * Scanned at the Erbil desk, is this registered parcel one whose arrival is
 * still to be recorded? In a batch, and not yet checked in. An unknown desk
 * answers no: the question makes no sense in China.
 */
export function arrivalDue(
  parcel: { id?: number; batchId?: number | null; status?: string | null } | null | undefined,
  deskInChina: boolean | null | undefined,
): boolean {
  if (deskInChina !== false || !parcel?.id || !parcel.batchId) return false;
  return parcel.status === "in_batch" || parcel.status === "in_transit";
}
