/**
 * How long a shipment took — or has taken so far.
 *
 * The owner, 2026-10-05: «کاتێ تاریخی دروستکردن و بەڕێکردنی دروست دەکرێ،
 * دورەیشنێکیش هەبێ، ماوەکەی بژمێرێت: بە چەند گەیشتووە». The list showed a
 * departure date and, once a batch was over, the word "arrived"; the one
 * figure the office compares carriers by — how many days door to door — had
 * to be counted on fingers from two dates, and the second of those dates was
 * not on the screen at all.
 *
 * Two moments, each read from the best record of it:
 *
 *   left     the departure date somebody typed; else the day the batch was
 *            moved to "in transit" (which the AWB or container number gates,
 *            so it is the day the goods actually went)
 *   arrived  the arrival date, if one was recorded; else the first day the
 *            batch reached Erbil in the status history — "arrived", or any
 *            status that can only come after it
 *
 * and three figures: how long it took to fill, how long it was on the way,
 * and — while it is still travelling — how long it has been on the way so
 * far. Whole days, counted the way the list already counts them.
 *
 * Pure: the status history is handed in, nothing is looked up here.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The statuses a shipment can only be in once it has reached Erbil. */
export const ARRIVED_OR_LATER = ["arrived", "customs", "at_depot", "delivered", "closed"] as const;

type DateLike = Date | string | null | undefined;

export interface BatchJourneyFacts {
  status?: string | null;
  createdAt?: DateLike;
  departureDate?: DateLike;
  actualArrival?: DateLike;
}

/** The first time the batch reached each status (batchStatusHistory). */
export type StatusReached = Partial<Record<string, DateLike>>;

const asDate = (value: DateLike): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const earliest = (dates: Array<Date | null>): Date | null => {
  const real = dates.filter((d): d is Date => d !== null);
  if (real.length === 0) return null;
  return real.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
};

export interface BatchJourneyDates {
  departedAt: Date | null;
  arrivedAt: Date | null;
}

/** When it left and when it arrived, each from the best record there is. */
export function batchJourneyDates(batch: BatchJourneyFacts, reached?: StatusReached | null): BatchJourneyDates {
  const departedAt = asDate(batch.departureDate) ?? asDate(reached?.in_transit);
  const arrivedAt =
    asDate(batch.actualArrival) ??
    earliest(ARRIVED_OR_LATER.map((status) => asDate(reached?.[status])));
  return { departedAt, arrivedAt };
}

export interface BatchDuration {
  /** "arrived": the journey is over. "travelling": it left and is not here yet. */
  state: "arrived" | "travelling";
  /** Days on the way — to the arrival, or to now while it is still travelling. */
  transitDays: number;
  /** Days from the batch being opened to its leaving. Null when not known. */
  fillingDays: number | null;
  departedAt: Date;
  arrivedAt: Date | null;
}

const wholeDays = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

/**
 * The duration, or null when there is nothing honest to say: the batch has
 * not left, or the two dates contradict each other (an arrival before the
 * departure is a typing mistake, not a journey of minus three days).
 */
export function batchDuration(
  batch: BatchJourneyFacts & Partial<{ departedAt: DateLike; arrivedAt: DateLike }>,
  now: Date = new Date(),
): BatchDuration | null {
  const departedAt = asDate(batch.departedAt) ?? asDate(batch.departureDate);
  if (!departedAt) return null;
  const arrivedAt = asDate(batch.arrivedAt) ?? asDate(batch.actualArrival);

  const created = asDate(batch.createdAt);
  const filling = created ? wholeDays(created, departedAt) : null;
  const fillingDays = filling !== null && filling >= 0 ? filling : null;

  if (arrivedAt) {
    const transitDays = wholeDays(departedAt, arrivedAt);
    if (transitDays < 0) return null;
    return { state: "arrived", transitDays, fillingDays, departedAt, arrivedAt };
  }

  // Not here yet. A departure date in the future is a plan, not a journey.
  const transitDays = wholeDays(departedAt, now);
  if (transitDays < 0) return null;
  // A batch marked as arrived with no arrival moment on record: the journey
  // is over but its length is not known, and "N days on the way" would go on
  // counting for ever.
  if (batch.status && (ARRIVED_OR_LATER as readonly string[]).includes(batch.status)) return null;
  return { state: "travelling", transitDays, fillingDays, departedAt, arrivedAt: null };
}

export interface DurationWords {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

/**
 * "بە 6 ڕۆژ گەیشت" / "4 ڕۆژە لە ڕێگا".
 *
 * Short on purpose: it sits under a date in a column the width of a date,
 * and a longer sentence widened a table that already runs to the edge.
 */
export function durationWords(duration: BatchDuration): DurationWords {
  const n = duration.transitDays;
  if (duration.state === "arrived") {
    return n === 0
      ? { ku: "هەمان ڕۆژ گەیشت", en: "Arrived the same day", ar: "وصلت في اليوم نفسه", zh: "当天到达" }
      : { ku: `بە ${n} ڕۆژ گەیشت`, en: `Arrived in ${n} days`, ar: `وصلت خلال ${n} يوم`, zh: `${n} 天到达` };
  }
  return n === 0
    ? { ku: "ئەمڕۆ بەڕێکرا", en: "Left today", ar: "غادرت اليوم", zh: "今天发出" }
    : { ku: `${n} ڕۆژە لە ڕێگا`, en: `${n} days on the way`, ar: `${n} يوم في الطريق`, zh: `在途 ${n} 天` };
}

/** How long it took to fill, for the line underneath. Null when not known. */
export function fillingWords(duration: BatchDuration): DurationWords | null {
  const n = duration.fillingDays;
  if (n === null) return null;
  return {
    ku: `${n} ڕۆژ بۆ پڕبوونەوە`,
    en: `${n} days to fill`,
    ar: `${n} يوم للتجميع`,
    zh: `集货 ${n} 天`,
  };
}
