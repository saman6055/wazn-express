/**
 * A customer's standing with the office: fine, a caution, or on the blacklist.
 *
 * Owner, 2026-10-07: "there should be a blacklist, so a customer who was bad
 * goes on it — and if we forget and they come back, the system knows them and
 * warns us: this one is blacklisted, and why. Nothing can be done for them
 * until we take them off it, on a condition. Some trouble us a lot, some
 * bring very little and take a lot of time, some have a foul tongue. A note
 * on them is good too, so we take care; if they do it again, then blacklist."
 *
 * So there are two steps, and both are written down with a reason:
 *
 *   caution  — a note. Shown wherever something is about to be done for the
 *              customer. Stops nothing. There can be many.
 *   blocked  — the blacklist. No new order may be bought for them, by any
 *              door. Taking them off is the main admin's, and needs the
 *              condition they come back on.
 *
 * What a block does NOT stop, on purpose: registering a parcel that has
 * physically arrived (the goods exist and must be on the books), and taking
 * the customer's money. A blacklist that stopped the office collecting a debt
 * would punish the wrong side.
 *
 * Nothing is edited or deleted: every note, block and release is a row, and
 * the standing is whatever the last row says.
 */

export const STANDING_EVENTS = ["caution", "blocked", "cleared"] as const;
export type StandingEvent = (typeof STANDING_EVENTS)[number];
export type Standing = "ok" | "caution" | "blocked";

export const STANDING_REASONS = ["refuses_goods", "pays_late", "fake", "rude", "wastes_time", "low_value", "other"] as const;
export type StandingReason = (typeof STANDING_REASONS)[number];

type Words = { ku: string; en: string; ar: string; zh: string };

export const STANDING_REASON_WORDS: Record<StandingReason, Words> = {
  refuses_goods: { ku: "کاڵا ڕەت دەکاتەوە", en: "Refuses goods", ar: "يرفض البضاعة", zh: "拒收货物" },
  pays_late: { ku: "پارە درەنگ دەدات یان نایدات", en: "Pays late or not at all", ar: "يتأخر في الدفع أو لا يدفع", zh: "拖欠或不付款" },
  fake: { ku: "کڕیاری فەیک", en: "Fake customer", ar: "عميل وهمي", zh: "虚假客户" },
  rude: { ku: "زمانی پیسە / بێڕێزی دەکات", en: "Abusive or disrespectful", ar: "لسانه بذيء / غير محترم", zh: "言语粗鲁/不尊重" },
  wastes_time: { ku: "کاتی زۆر دەگرێت و ئەزیەت دەدات", en: "Takes a lot of time and trouble", ar: "يأخذ وقتاً كثيراً ويتعب", zh: "耗时费力" },
  low_value: { ku: "خێری زۆر کەمە", en: "Brings very little", ar: "عائده قليل جداً", zh: "收益很低" },
  other: { ku: "هۆکارێکی تر — بینووسە", en: "Another reason — write it", ar: "سبب آخر — اكتبه", zh: "其他 — 请写明" },
};

export const STANDING_WORDS: Record<Standing, Words> = {
  ok: { ku: "ئاسایی", en: "Fine", ar: "عادي", zh: "正常" },
  caution: { ku: "ئاگاداری لەسەرە", en: "Caution", ar: "عليه تنبيه", zh: "需注意" },
  blocked: { ku: "لە لیستی ڕەشدایە", en: "Blacklisted", ar: "في القائمة السوداء", zh: "黑名单" },
};

export interface StandingRow {
  /** The row's own number — what decides between two rows written in the same second. */
  id?: number | null;
  event: StandingEvent;
  createdAt: Date | string;
}

/**
 * The standing is whatever the last row says; no rows at all is fine.
 *
 * "Last" is by time and then by the row's number. Time alone is not enough: a
 * note and a block written in the same second share a timestamp, and on time
 * alone the block could lose to the note — a blacklisted customer reading as
 * a caution, and their order saving.
 */
export function standingOf(rows: readonly StandingRow[]): Standing {
  if (rows.length === 0) return "ok";
  let last = rows[0];
  for (const row of rows) {
    const dt = new Date(row.createdAt).getTime() - new Date(last.createdAt).getTime();
    if (dt > 0 || (dt === 0 && (Number(row.id) || 0) > (Number(last.id) || 0))) last = row;
  }
  return last.event === "cleared" ? "ok" : last.event;
}

/** May a new order be bought for this customer? Only the blacklist says no. */
export function mayOrderFor(standing: Standing): boolean {
  return standing !== "blocked";
}

/** The text every event needs: a reason always; "other" and a release also need words. */
export function standingTextFault(event: StandingEvent, reason: StandingReason | null | undefined, text: string | null | undefined): "reason" | "text" | null {
  const said = (text ?? "").trim();
  if (event === "cleared") return said.length >= 5 ? null : "text";
  if (!reason) return "reason";
  if (reason === "other" && said.length < 3) return "text";
  return null;
}

/** How many cautions before the office is told it is time to decide. */
export const CAUTIONS_BEFORE_BLOCK = 2;
