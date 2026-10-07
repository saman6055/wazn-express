/**
 * Where the office's two helpers open - and why nothing floats over a page.
 *
 * Three notes from the owner, ten days apart, are the whole history.
 *
 * 2026-09-27 - «من وتم شوێنی نامە ناردن لەلای دەستی ڕاست دروست بکە نەک چەپ».
 * The chat bubble and the tips lamp became two round buttons floating in the
 * physical bottom-right corner of every page, beside the menu rail.
 *
 * 2026-09-30 - «کەوتوونەتە سەر یەک», of the lamp and the weight box on Quick
 * Register's form bar. The bar was taught to keep its end clear of them.
 *
 * 2026-10-07 - «ئەو دوو ئایکۆنە زۆر بەکەڵکن بەڵام جێگا دەگرن، دەکەونە سەر
 * نووسین و شت لە سیستەمدا». A third collision, and this time with everything:
 * in a right-to-left page the bottom-right corner is the FIRST column of
 * every list - the customer's code - and at the end of a page a row cannot be
 * scrolled out from under a button that does not scroll.
 *
 * The lesson is the plane, not the size. A button floating over the page will
 * sooner or later sit on something, and each fix until now moved the thing
 * underneath. So the buttons left the page:
 *
 *  - desktop: the foot of the menu rail (DashboardLayout, `rail-foot`). It is
 *    still the bottom corner on the side he asked for - in Kurdish the rail
 *    IS the right-hand edge - but it is furniture, and no page reaches under
 *    it. His first words for it, 2026-09-26, were «لە ژێرەوەی لای ڕاست -
 *    جێگایەکی بەتاڵ ماوە»: the empty place was the rail's foot all along.
 *  - phone: there is no rail. Messages sit beside the bells in the top bar;
 *    the lamp is a named row in «زیاتر» (components/mobile).
 *
 * A new helper goes into that furniture too. Never float a button over the
 * page again: the guard in floating-corner.test says so.
 *
 * What is left here is the one thing that still floats - the panel either of
 * them opens. It is opened on purpose and closed again, so it may cover the
 * page while it is up; it may not cover a form's own bar.
 */

/**
 * A panel opened by the chat or by the lamp.
 *
 * Beside the rail, on the rail's own side - `start`. In Kurdish that is the
 * right-hand corner the owner asked for. In English or Chinese the rail and
 * its two buttons are on the left, and the panel opens next to the button
 * that was pressed rather than across the screen from it.
 *
 * 5rem up from the foot of a desktop window, which clears a sticky form bar
 * (68px on Quick Register): the tips card arrives by itself twice a day and
 * must not land on the weight box. On a phone it stands the same 5rem above
 * the tab bar, for the same bar.
 */
export const CORNER_PANEL =
  "fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-20 start-4 md:start-24 z-40";
