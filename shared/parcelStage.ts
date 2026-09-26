/**
 * Where a parcel actually is, worked out from what the system recorded.
 *
 * The owner, 2026-09-25: "the stages are very tangled and wrong and far too
 * long, and they give no real update on the state of the goods — some things
 * are in the customer's hand while it says they are in the China warehouse."
 *
 * He was right, and the cause was not any one bug. `packages.status` is a
 * stored second opinion: a dozen code paths have to remember to move it, and
 * where one forgets — or fails, as the box-delivery loop does, logging each
 * parcel's error and carrying on — the parcel stays where it was for ever.
 * Nothing notices, because nothing else knows what it should have said.
 *
 * So it is not stored here. It is read off the facts, every time, and the
 * facts are the five events he named, each of which the system already
 * records and none of which depends on anybody outside the company:
 *
 *   1. Somebody quick-registered it            → with us
 *   2. The batch was given its shipment tracking → on the way
 *   3. Its arrival was verified in Erbil        → arrived
 *   4. A box was made for the customer          → ready for them
 *   5. The box was paid for                     → delivered
 *
 * Nothing to keep in sync, so nothing can drift. What is gone is everything
 * the system could not observe: customs, which was set by a guess the morning
 * after a flight landing, from a flight number a third party often never
 * sends — and "in a batch", which for a customer is the same as "with us in
 * China", because that is where the batch is made.
 */

export const PARCEL_STAGES = [
  /** Received by us — in the China depot, or in Erbil when it starts there. */
  "received",
  /** The batch has left: it was given a shipment tracking. */
  "in_transit",
  /** Its arrival was verified in Erbil; being prepared for the customer. */
  "arrived",
  /** A box has been made for this customer — ready to send or collect. */
  "ready",
  /** The box was paid for: the goods are with the customer. */
  "delivered",
] as const;

export type ParcelStage = (typeof PARCEL_STAGES)[number];

/** Not steps on the road. Decisions, which only a person may make. */
export const PARCEL_ENDINGS = ["returned", "cancelled"] as const;
export type ParcelEnding = (typeof PARCEL_ENDINGS)[number];

export interface ParcelFacts {
  /**
   * Registered at an origin depot rather than at the destination.
   *
   * Undefined or null means China: everything registered before the location
   * was recorded went through that depot. A parcel registered in Erbil never
   * travels with us at all — it is registered, boxed and sent the same day.
   */
  registeredAtOrigin?: boolean | null;
  /** The batch it belongs to, if it has one yet. */
  batch?: {
    /**
     * The batch was given the tracking it travels under. The owner's rule:
     * the moment that is filled in, the goods have left.
     */
    hasShipmentTracking?: boolean | null;
    /** Its own status, which reaches at_depot when an arrival is verified. */
    status?: string | null;
  } | null;
  /** The delivery box it was put in, if one has been made. */
  box?: {
    status?: string | null;
    /** The payment screen says nothing is owed on it. */
    paidInFull?: boolean | null;
  } | null;
  /** Only read for the two endings; never for a step. */
  status?: string | null;
}

/**
 * A batch at or past the depot has arrived, whatever else is true.
 *
 * Exported because the counter asks the same question before stamping a
 * parcel "ready to collect" (server/routers/scanning.router): one list,
 * so the stamp and the timeline cannot disagree about where the goods are.
 */
export const BATCH_ARRIVED_STATUSES = ["arrived", "customs", "at_depot", "delivered", "closed"];
const BATCH_ARRIVED = BATCH_ARRIVED_STATUSES;

/**
 * A parcel registered at the destination has no journey to show.
 *
 * It is registered in Erbil, boxed and sent in the same day; walking it
 * through "on the way" and "arrived" would be describing a trip it never
 * took. The China stage was already dropped for these (shared/packageJourney);
 * this is the same truth, carried the rest of the way.
 */
export function stagesFor(facts: Pick<ParcelFacts, "registeredAtOrigin">): ParcelStage[] {
  if (facts.registeredAtOrigin === false) return ["received", "ready", "delivered"];
  return [...PARCEL_STAGES];
}

/** The ending a parcel has come to, or null while it is still on the road. */
export function endingOf(facts: Pick<ParcelFacts, "status">): ParcelEnding | null {
  const status = (facts.status ?? "").trim();
  return (PARCEL_ENDINGS as readonly string[]).includes(status) ? (status as ParcelEnding) : null;
}

/**
 * Could this parcel physically be in the Erbil depot?
 *
 * Exported because the portal's chip asks the same question of a row that
 * carries only its batch's status (client/src/lib/packageStatus).
 */
export function goodsCouldBeHere(
  facts: Pick<ParcelFacts, "registeredAtOrigin" | "batch">,
): boolean {
  if (facts.registeredAtOrigin === false) return true;
  const status = (facts.batch?.status ?? "").trim();
  if (!facts.batch) return true;
  return BATCH_ARRIVED.includes(status);
}

/**
 * The furthest thing that is true.
 *
 * Each fact implies a stage the parcel must be at least at; the answer is
 * the furthest of them. Read this way a late scan cannot drag anything
 * backwards and a missed write cannot hold anything back — there is no
 * write.
 */
export function parcelStage(facts: ParcelFacts): ParcelStage | ParcelEnding {
  const ending = endingOf(facts);
  if (ending) return ending;

  if (facts.box?.paidInFull) return "delivered";
  /*
   * A box means the goods are here — usually.
   *
   * Boxes are made in the Erbil depot, so one existing is normally proof
   * the parcel arrived. But a box can also be built from a batch before it
   * flies, to plan the sorting, and then it proves nothing about where the
   * goods are. The owner, 2026-09-26, looking at AIR-2026-041: the shipment
   * said «لە کۆگای چین» and every parcel inside it said
   * «ئامادەیە بۆ وەرگرتن» — a customer reading that drives to the
   * office for goods that have not left China.
   *
   * So the box counts when the goods could be here: a parcel that never
   * travelled, a parcel with no batch (somebody boxed it at the counter),
   * or a batch that has reached Erbil. Otherwise the journey below answers.
   */
  if (facts.box && goodsCouldBeHere(facts)) return "ready";

  // Only a parcel that travelled with us has the two middle stages.
  if (facts.registeredAtOrigin !== false) {
    const batchStatus = (facts.batch?.status ?? "").trim();
    if (batchStatus && BATCH_ARRIVED.includes(batchStatus)) return "arrived";
    if (facts.batch?.hasShipmentTracking) return "in_transit";
  }
  return "received";
}

/**
 * How far along, as an index into `stagesFor`. -1 for an ending: a returned
 * parcel is not on this road, and putting it at step one would say it was.
 */
export function stageIndex(facts: ParcelFacts): number {
  const stage = parcelStage(facts);
  return stagesFor(facts).indexOf(stage as ParcelStage);
}

/** What each stage is called, for the customer and for the counter. */
export const PARCEL_STAGE_LABELS: Record<
  ParcelStage | ParcelEnding,
  { ku: string; en: string; ar: string; zh: string }
> = {
  received: {
    ku: "وەرگیراوە لە کۆگای ئێمە",
    en: "Received at our warehouse",
    ar: "مستلم في مخزننا",
    zh: "已在我方仓库接收",
  },
  in_transit: {
    ku: "لە ڕێگایە",
    en: "On the way",
    ar: "في الطريق",
    zh: "运输途中",
  },
  arrived: {
    ku: "گەیشتووەتە هەولێر — ئامادەکاری بۆ دەکرێت",
    en: "Arrived in Erbil — being prepared",
    ar: "وصل إلى أربيل — قيد التجهيز",
    zh: "已抵达埃尔比勒 — 备货中",
  },
  ready: {
    ku: "ئامادەیە بۆ وەرگرتن یان ناردن",
    en: "Ready to collect or be sent",
    ar: "جاهز للاستلام أو الإرسال",
    zh: "可自取或派送",
  },
  delivered: {
    ku: "گەیشتووەتە دەست کڕیار",
    en: "Delivered",
    ar: "تم التسليم",
    zh: "已送达",
  },
  returned: {
    ku: "گەڕێنراوەتەوە",
    en: "Returned",
    ar: "مُرجع",
    zh: "已退回",
  },
  cancelled: {
    ku: "هەڵوەشێنراوەتەوە",
    en: "Cancelled",
    ar: "ملغى",
    zh: "已取消",
  },
};
