/**
 * Which shop an order number came from, read from the number itself.
 *
 * The owner, 2026-09-30: «ئەگەر کەسێ نەمبەری ئۆردەری پیندووی داخڵ کرد،
 * یەکسەر پلاتفۆرم خۆی ببێتە پیندوودوو، بیناسێتەوە.» A person who has just
 * pasted an order number already knows which shop they bought from; asking
 * them to say it again in a dropdown is a question with the answer written in
 * the box above it.
 *
 * Two shapes, and an honest gap between them:
 *
 *   Pinduoduo   260930-434834019861958   a date, a dash, then digits
 *   Taobao      5127741900660014414      nineteen digits
 *   1688        5127802021486096433      nineteen digits
 *
 * The last two are the same shape — the owner said so himself: «زۆر بەیەک
 * دەچن ئەو دووە، ئەگەر نەتوانی کێشە نییە». So they are not guessed between.
 * The number says "one of these two" and the person picks, which is a
 * smaller question than the whole list and, unlike a guess, is never wrong.
 *
 * Pure; no database, no network. The three screens that take an order number
 * — the portal, the commission form and the full-package form — read this
 * one rule, so a number recognised on one of them is recognised on all three.
 */

/** Exactly as the platform list spells them (productAttributes, type "platform"). */
export const PLATFORM_PINDUODUO = "Pinduoduo";
export const PLATFORM_TAOBAO = "Taobao";
export const PLATFORM_1688 = "1688";

/**
 * 260930-434834019861958 — six digits of date, a dash, then a long run.
 *
 * The dash is what makes this one safe to act on: no courier code and no
 * other shop's order number in this office wears one.
 */
const PINDUODUO_SHAPE = /^\d{6}-\d{10,}$/;

/**
 * A long unbroken run of digits: a shop order number, not a courier's code
 * (those carry letters, and are shorter). Sixteen is the figure the older
 * order/tracking sanity rule already used, kept so the two agree.
 */
const LONG_DIGITS_SHAPE = /^\d{16,}$/;

export interface PlatformGuess {
  /** The platform to fill in, when the number can only be one. */
  platform: string | null;
  /**
   * Every platform the number could belong to. One entry means `platform` is
   * set; two or more means the person still has to choose, but from a short
   * list rather than the whole one.
   */
  candidates: string[];
}

const NONE: PlatformGuess = { platform: null, candidates: [] };

/** Digits and a dash are all these numbers are made of; spaces get pasted in. */
function tidy(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

/**
 * Which shop this order number is from.
 *
 * Returns nothing rather than a guess when the number says nothing — an
 * unrecognised number must leave whatever the person chose alone.
 */
export function platformFromOrderNumber(orderNumber: string | null | undefined): PlatformGuess {
  const value = tidy(orderNumber);
  if (!value) return NONE;
  if (PINDUODUO_SHAPE.test(value)) {
    return { platform: PLATFORM_PINDUODUO, candidates: [PLATFORM_PINDUODUO] };
  }
  if (LONG_DIGITS_SHAPE.test(value)) {
    // Taobao and 1688 wear the same number. Naming both is the whole truth.
    return { platform: null, candidates: [PLATFORM_TAOBAO, PLATFORM_1688] };
  }
  return NONE;
}

/**
 * Does this look like a shop's order number rather than a courier's tracking?
 *
 * The owner, 2026-09-30: «ئەگەر کەسێ لە جیاتی تراک نەمبەر، ئۆردەر نەمبەری
 * داخڵ کرد، ئاگاداری بکەوە کە ئەوە تراک نەمبەر نییە.» An order number typed
 * into a tracking box is the one mistake that cannot be caught later: nothing
 * ever arrives under that number, and the parcel sits unclaimed with the
 * customer certain they registered it.
 *
 * A warning, never a refusal — a strange but real tracking must still save.
 */
export function looksLikeOrderNumber(value: string | null | undefined): boolean {
  const v = tidy(value);
  return Boolean(v) && (PINDUODUO_SHAPE.test(v) || LONG_DIGITS_SHAPE.test(v));
}

/** What to say about it, in the four languages every screen here speaks. */
export const ORDER_NUMBER_IN_TRACKING_TEXT = {
  ku: "ئەمە لە ژمارەی ئۆردەری فرۆشگاکە دەچێت، نەک ژمارەی تراکینگ. ژمارەی تراکینگ ئەوەیە کە کۆمپانیای گەیاندن دەیدات — تکایە ئەو بنووسە.",
  en: "This looks like the shop's order number, not a tracking number. The tracking number is the one the courier gives — please enter that.",
  ar: "هذا يشبه رقم طلب المتجر وليس رقم التتبع. رقم التتبع هو الذي تعطيه شركة الشحن — أدخله من فضلك.",
  zh: "这看起来是店铺订单号，不是运单号。运单号由快递公司提供 — 请填写那个号码。",
} as const;
