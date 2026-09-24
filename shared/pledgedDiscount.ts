/**
 * A discount promised on a printed receipt.
 *
 * The owner, 2026-09-24: "add a discount to the receipt printing, in dollars,
 * in step with the dinar rate chosen above. The box payment screen must be in
 * step with it too — write, for example, '10 dollars discount given' on the
 * receipt, and the reason for the discount must be written as well." And
 * then: "the discount at receipt printing is fixed in the box payment. You
 * cannot lower it — only raise it, if you want to give more."
 *
 * And, the same day: "the discount has to line up with every accounting part.
 * It must be possible for the receipt to carry a discount on one particular
 * tracking as well — for example on the whole total, or on one tracking — and
 * it must exist as data. I have sent parcels and after the box was closed the
 * customer said one was broken, so I had to give twenty dollars on it: that
 * discount was for one tracking, not for the total."
 *
 * So a pledge is: an amount, a reason, and what it was given on — the whole
 * box, or one parcel in it. It is written down when the receipt is printed,
 * because at that moment the paper in the customer's hand becomes a promise,
 * and a promise the system does not hold is a promise the next person at the
 * counter will unknowingly break.
 *
 * The money itself still moves only at settlement. This is the floor that
 * settlement has to meet.
 *
 * Pure: no database, no React. The dialog reads it, the payment screen reads
 * it, and the server reads it before it writes anything — three readings of
 * one rule.
 */

import { withFix, type FixLanguage } from "./fixAdvice";
import { DISCOUNT_REASON_LABELS, type DiscountReason } from "./boxSettlement";

/** One promise, as the receipt made it. */
export interface DiscountPledge {
  /** The box item it was given on; null means the box as a whole. */
  lineId: number | null;
  usd: number;
  reason: DiscountReason;
  note?: string | null;
  /** What the receipt named, so a refusal can name it back. */
  trackingNumber?: string | null;
}

/** What is still promised, gathered by what it was promised on. */
export interface PledgeFloors {
  /** On the box as a whole. */
  boxUsd: number;
  /** On one parcel: lineId → dollars. */
  byLine: Map<number, number>;
  totalUsd: number;
}

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;
const positive = (n: unknown): number => Math.max(0, round2(Number(n) || 0));

/**
 * The floor each target now carries.
 *
 * Every printing of a receipt writes its own row, so one parcel can have
 * several — a receipt printed at ten dollars and reprinted at twenty. They
 * do not add up: the second receipt replaced the first in the customer's
 * hand, it did not promise thirty. The largest promise still open is the one
 * that has to be kept.
 */
export function pledgeFloors(pledges: readonly DiscountPledge[]): PledgeFloors {
  const byLine = new Map<number, number>();
  let boxUsd = 0;
  for (const p of pledges) {
    const usd = positive(p.usd);
    if (usd <= 0) continue;
    if (p.lineId === null || p.lineId === undefined) boxUsd = Math.max(boxUsd, usd);
    else byLine.set(p.lineId, Math.max(byLine.get(p.lineId) ?? 0, usd));
  }
  let totalUsd = boxUsd;
  byLine.forEach((usd) => { totalUsd = round2(totalUsd + usd); });
  return { boxUsd, byLine, totalUsd };
}

/**
 * How far short of a promise an offer falls. Zero when the promise is kept —
 * and kept is "at least", never "exactly": giving more was always allowed.
 */
export function shortOfPledge(promisedUsd: number, offeredUsd: number): number {
  const short = round2(positive(promisedUsd) - positive(offeredUsd));
  return short > 0 ? short : 0;
}

/** One promise that the screen is about to break. */
export interface PledgeBreach {
  /** The tracking, or the box code — whatever the customer's paper says. */
  what: string;
  promisedUsd: number;
  offeredUsd: number;
}

/**
 * Every promise this settlement would break.
 *
 * `offered` is what the counter has typed: the box-wide discount and each
 * parcel's own. Like is compared with like — a promise made on one parcel is
 * not kept by a discount spread across all of them, because the receipt named
 * that parcel.
 */
export function pledgeBreaches(
  floors: PledgeFloors,
  offered: { boxUsd?: number; byLine?: Map<number, number> | Record<number, number> },
  name: (lineId: number | null) => string,
): PledgeBreach[] {
  const read = (lineId: number): number => {
    const from = offered.byLine;
    if (!from) return 0;
    return positive(from instanceof Map ? from.get(lineId) : from[lineId]);
  };
  const breaches: PledgeBreach[] = [];
  const boxShort = shortOfPledge(floors.boxUsd, offered.boxUsd ?? 0);
  if (boxShort > 0) {
    breaches.push({ what: name(null), promisedUsd: floors.boxUsd, offeredUsd: positive(offered.boxUsd) });
  }
  floors.byLine.forEach((promised, lineId) => {
    const got = read(lineId);
    if (shortOfPledge(promised, got) > 0) {
      breaches.push({ what: name(lineId), promisedUsd: promised, offeredUsd: got });
    }
  });
  return breaches;
}

const WORDS = {
  ku: {
    one: (b: PledgeBreach) =>
      `وەسڵێک بە داشکاندنی $${b.promisedUsd.toFixed(2)} بۆ ${b.what} چاپ کراوە و دراوە بە کڕیار، بەڵام لێرە تەنها $${b.offeredUsd.toFixed(2)} دراوە.`,
    many: (n: number) => `${n} داشکاندن لەسەر وەسڵی چاپکراو بەڵێن دراون و لێرە کەمتر دراون:`,
    line: (b: PledgeBreach) => `${b.what}: بەڵێندراو $${b.promisedUsd.toFixed(2)} · لێرە $${b.offeredUsd.toFixed(2)}`,
    steps: (b: PledgeBreach | null) => [
      b
        ? `داشکاندنی ${b.what} بگەڕێنەوە بۆ $${b.promisedUsd.toFixed(2)} یان زیاتر`
        : "هەموو داشکاندنەکان بگەڕێنەوە بۆ ئەوەی بەڵێن دراوە یان زیاتر",
      "ئەگەر بەڵێنەکە هەڵە بوو، وەسڵی چاپکراو هەڵبوەشێنەوە و وەسڵێکی نوێ چاپ بکە",
      "داشکاندنی زیاتر ڕێگەپێدراوە — تەنها کەمکردنەوەی نا",
    ],
    lower: (what: string, current: number, next: number) =>
      `پێشتر داشکاندنی $${current.toFixed(2)} بۆ ${what} لەسەر وەسڵێک چاپ کراوە. ناکرێت بکرێتە $${next.toFixed(2)} — داشکاندنی چاپکراو بەڵێنە.`,
    lowerSteps: (current: number) => [
      `بڕەکە بهێڵەرەوە لەسەر $${current.toFixed(2)} یان زیاتری بکە`,
      "ئەگەر بەڵێنەکە هەڵە بوو، وەسڵە کۆنەکە هەڵبوەشێنەوە و وەسڵێکی نوێ چاپ بکە",
    ],
    wholeBox: "کۆی گشتی",
  },
  en: {
    one: (b: PledgeBreach) =>
      `A receipt promising $${b.promisedUsd.toFixed(2)} off ${b.what} was printed and handed over, but only $${b.offeredUsd.toFixed(2)} is being given here.`,
    many: (n: number) => `${n} discounts were promised on a printed receipt and are short here:`,
    line: (b: PledgeBreach) => `${b.what}: promised $${b.promisedUsd.toFixed(2)} · here $${b.offeredUsd.toFixed(2)}`,
    steps: (b: PledgeBreach | null) => [
      b
        ? `Put the discount on ${b.what} back to $${b.promisedUsd.toFixed(2)} or more`
        : "Put every discount back to what was promised, or more",
      "If the promise was a mistake, reverse the printed receipt and print a new one",
      "Giving more is allowed — only giving less is not",
    ],
    lower: (what: string, current: number, next: number) =>
      `$${current.toFixed(2)} off ${what} has already been printed on a receipt. It cannot become $${next.toFixed(2)} — a printed discount is a promise.`,
    lowerSteps: (current: number) => [
      `Leave it at $${current.toFixed(2)}, or raise it`,
      "If the promise was a mistake, reverse that receipt and print a new one",
    ],
    wholeBox: "the whole box",
  },
} as const;

type Lang = keyof typeof WORDS;
const speak = (lang: FixLanguage): Lang => (lang === "ku" ? "ku" : "en");

/** The name a refusal uses for the whole box, rather than one parcel. */
export function wholeBoxName(lang: FixLanguage = "ku"): string {
  return WORDS[speak(lang)].wholeBox;
}

/**
 * The refusal, with the way out — the owner's standing rule that every
 * warning says the cause and the steps (shared/fixAdvice).
 */
export function pledgeRefusal(breaches: readonly PledgeBreach[], lang: FixLanguage = "ku"): string {
  if (breaches.length === 0) return "";
  const w = WORDS[speak(lang)];
  if (breaches.length === 1) return withFix(w.one(breaches[0]!), w.steps(breaches[0]!), lang);
  const cause = [w.many(breaches.length), ...breaches.map((b) => `· ${w.line(b)}`)].join("\n");
  return withFix(cause, w.steps(null), lang);
}

/** The refusal when a new receipt would promise less than an old one did. */
export function lowerPledgeRefusal(
  what: string,
  currentUsd: number,
  nextUsd: number,
  lang: FixLanguage = "ku",
): string {
  const w = WORDS[speak(lang)];
  return withFix(w.lower(what, positive(currentUsd), positive(nextUsd)), w.lowerSteps(positive(currentUsd)), lang);
}

/**
 * How the receipt names a discount: the reason, and the parcel it was given
 * on when it was not given on the box as a whole.
 *
 * One function so the paper, the window before printing and the payment
 * screen all say it the same way.
 */
export function pledgeLabel(
  pledge: Pick<DiscountPledge, "reason" | "trackingNumber" | "lineId">,
  lang: "ku" | "en" | "ar" | "zh" = "ku",
): string {
  const reason = DISCOUNT_REASON_LABELS[pledge.reason]?.[lang] ?? "";
  const tracking = (pledge.trackingNumber ?? "").trim();
  if (!tracking) return reason;
  return reason ? `${tracking} · ${reason}` : tracking;
}
