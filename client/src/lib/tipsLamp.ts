/**
 * Asking for a tip, from wherever the lamp happens to be drawn.
 *
 * The lamp used to be a button the tips card drew for itself, floating in the
 * bottom corner of every page. The owner, 2026-10-07: «ئەو دوو ئایکۆنە زۆر
 * بەکەڵکن بەڵام جێگا دەگرن، دەکەونە سەر نووسین و شت لە سیستەمدا». So the lamp
 * moved into the furniture - the foot of the menu rail on a desktop, a row in
 * «زیاتر» on a phone (lib/floatingCorner tells the whole story) - and the card,
 * which is loaded lazily and lives outside the layout, no longer draws it.
 *
 * A window event rather than a shared store or an import: the card is one
 * lazy chunk with every tip's text in it, and whatever draws a lamp must not
 * pull that chunk into the first paint just to ask it a question. Nothing in
 * this file imports anything, on purpose.
 */

const ASKED = "wazn:tip-asked";

/** The name on the lamp, wherever it is drawn. */
export const TIP_WORD = { ku: "ئامۆژگاری", en: "Tip", ar: "نصيحة", zh: "提示" } as const;

/** Somebody pressed a lamp: show the next tip. */
export function askForTip(): void {
  window.dispatchEvent(new Event(ASKED));
}

/** The tips card listens here. Returns the way to stop listening. */
export function onTipAsked(show: () => void): () => void {
  window.addEventListener(ASKED, show);
  return () => window.removeEventListener(ASKED, show);
}
