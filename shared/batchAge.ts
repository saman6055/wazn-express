/**
 * How long a shipment has been open, and when that stops being normal.
 *
 * A batch from China takes about a fortnight. For the first three weeks there
 * is nothing to say — it is simply travelling. Past that, an open batch is
 * either late or forgotten, and the two look identical on a list sorted by
 * date: both are just an old row somebody has stopped noticing.
 *
 * So the age wears a colour:
 *
 *   green   day 1–20    travelling, as expected
 *   amber   day 20–30   longer than usual, worth a look
 *   red     day 30+     something is wrong, or nobody closed it
 *
 * Deliberately not tied to the flight watcher or the waybill reminder. Those
 * answer "has it landed" and "do we have the number". This answers the older
 * question the office actually asks across the room: how long has that one
 * been sitting there?
 */

/** Past this many days, an open shipment is worth a second look. */
export const AMBER_AFTER_DAYS = 20;

/** Past this, it is a problem rather than a delay. */
export const RED_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A shipment that is over has no age worth colouring. */
export const CLOSED_STATUSES = ["delivered", "closed"] as const;

export type AgeBand = "settled" | "green" | "amber" | "red";

export interface AgeableBatch {
  status?: string | null;
  createdAt?: Date | string | null;
}

export interface BatchAge {
  band: AgeBand;
  /** Whole days since the batch was created. */
  days: number;
}

/**
 * How old this shipment is, and how loudly to say so.
 *
 * An unreadable or missing date reads as day zero rather than as ancient: a
 * storage fault should not paint every row red and teach the office to ignore
 * the colour.
 */
export function batchAge(batch: AgeableBatch, now: Date = new Date()): BatchAge {
  const created = batch.createdAt ? new Date(batch.createdAt) : null;
  const ms = created && !Number.isNaN(created.getTime()) ? now.getTime() - created.getTime() : 0;
  const days = Math.max(0, Math.floor(ms / DAY_MS));

  if (batch.status && (CLOSED_STATUSES as readonly string[]).includes(batch.status)) {
    return { band: "settled", days };
  }
  if (days >= RED_AFTER_DAYS) return { band: "red", days };
  if (days >= AMBER_AFTER_DAYS) return { band: "amber", days };
  return { band: "green", days };
}

/** What each colour means, for the badge's tooltip and the alert. */
export const BAND_MEANING: Record<Exclude<AgeBand, "settled">, { ku: string; en: string; ar: string; zh: string }> = {
  green: {
    ku: "لە ڕێگادایە — ماوەکەی ئاساییە",
    en: "On its way — a normal length of time",
    ar: "في الطريق — مدة طبيعية",
    zh: "在途中——时间正常",
  },
  amber: {
    ku: "لە ماوەی ئاسایی درێژترە — سەیرێکی بکە",
    en: "Longer than usual — worth a look",
    ar: "أطول من المعتاد — تستحق المتابعة",
    zh: "超过通常时长——建议查看",
  },
  red: {
    ku: "زۆر درێژ خایاندووە — یان کێشەیەکی هەیە یان کەس نەیداخستووە",
    en: "Open far too long — either something is wrong or nobody closed it",
    ar: "مفتوحة منذ وقت طويل جداً — إما أن هناك مشكلة أو لم يُغلقها أحد",
    zh: "开启时间过长——要么出了问题，要么无人关闭",
  },
};

/** How the badge reads: "٢٤ ڕۆژ". */
export function ageLabel(days: number): { ku: string; en: string; ar: string; zh: string } {
  return {
    ku: `${days} ڕۆژ`,
    en: `${days} days`,
    ar: `${days} يوم`,
    zh: `${days} 天`,
  };
}

/** Tailwind classes for each colour, so three screens cannot disagree. */
export const BAND_CLASS: Record<Exclude<AgeBand, "settled">, string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

/**
 * The shipments the office should be told about.
 *
 * Only red ones. An amber badge on the screen is enough for something that is
 * merely slower than usual — sending an alert for it as well is how alerts
 * become wallpaper.
 */
export function overdueBatches<T extends AgeableBatch>(
  batches: T[],
  now: Date = new Date(),
): Array<T & { days: number }> {
  return batches
    .map((batch) => ({ ...batch, ...batchAge(batch, now) }))
    .filter((row) => row.band === "red")
    .sort((a, b) => b.days - a.days)
    .map(({ band, ...rest }) => rest as T & { days: number });
}
