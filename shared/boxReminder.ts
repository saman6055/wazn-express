/**
 * A box handed over and not paid for: the office first, then the customer.
 *
 * Owner, 2026-10-06: every customer should be steering towards a debt of
 * zero, nudged softly and politely — "a gentle reminder in their own bell if
 * it passes three days". Only for a box: a box means the goods are in the
 * customer's hands; goods still travelling are never reminded.
 *
 * And 2026-10-07: "the admins must confirm, daily — the system should know
 * which box's money has not come. Sometimes the money WAS paid and the admin
 * was slow to receipt it." A reminder to somebody who has already paid is an
 * insult, so nothing reaches a customer on the system's own say-so:
 *
 *   1. three days after the hand-over the box is put in front of the office;
 *   2. an admin either receipts it, or says "no, it has not been paid";
 *   3. only that second answer sends the customer the gentle line;
 *   4. three days later, still unpaid, the office is asked again — never the
 *      customer directly.
 */

export const REMIND_AFTER_DAYS = 3;

const DAY_MS = 86_400_000;

export interface BoxAwaitingFacts {
  /** When it was handed to the customer. */
  deliveredAt: Date | string | null;
  /** The last time an admin confirmed it was still unpaid. */
  unpaidConfirmedAt: Date | string | null;
  outstandingUsd: number;
}

const at = (v: Date | string | null | undefined): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Whole days since a moment; null when there is no moment. */
export function daysSince(v: Date | string | null | undefined, now: Date = new Date()): number | null {
  const t = at(v);
  return t == null ? null : Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

/**
 * Is it time for the office to look at this box?
 *
 * Yes when it has been in the customer's hands three days with money still
 * owed, and nobody has confirmed "unpaid" within the last three.
 */
export function officeShouldLook(box: BoxAwaitingFacts, now: Date = new Date()): boolean {
  if (!(box.outstandingUsd > 0.005)) return false;
  const handed = daysSince(box.deliveredAt, now);
  if (handed == null || handed < REMIND_AFTER_DAYS) return false;
  const confirmed = daysSince(box.unpaidConfirmedAt, now);
  return confirmed == null || confirmed >= REMIND_AFTER_DAYS;
}

type Words = { ku: string; ar: string; en: string };

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What the customer reads. Soft on purpose: no date, no "overdue", no limit —
 * the amount, the box, and thanks. Never «قەرز» in the title.
 */
export function gentleReminder(name: string, boxCode: string, outstandingUsd: number): { title: Words; message: Words } {
  const who = name.trim();
  const amount = money(outstandingUsd);
  return {
    title: {
      ku: "بیرخستنەوەیەکی بچووک 🌿",
      ar: "تذكير لطيف 🌿",
      en: "A gentle reminder 🌿",
    },
    message: {
      ku: `سڵاو بەڕێز ${who}، ${amount} لە حیسابی بۆکسی ${boxCode} ماوە. هەر کاتێک بۆت گونجا دەتوانیت بیدەیت. زۆر سوپاس بۆ متمانەت 🙏`,
      ar: `مرحباً ${who}، بقي ${amount} على حساب الصندوق ${boxCode}. يمكنك تسديده في الوقت المناسب لك. شكراً جزيلاً لثقتك 🙏`,
      en: `Hello ${who}, ${amount} is still open on box ${boxCode}. You can settle it whenever suits you. Thank you for your trust 🙏`,
    },
  };
}
