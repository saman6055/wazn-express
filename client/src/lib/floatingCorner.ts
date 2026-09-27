/**
 * The bottom-right corner, shared out in slots.
 *
 * The owner, 2026-09-27: «من وتم شوێنی نامە ناردن لەلای دەستی ڕاست دروست بکە
 * نەک چەپ — سەیرکە چۆن بەژێر کەوتووە.» Two things went wrong at once, and
 * both are worth writing down because the next floating button will meet
 * them too.
 *
 * **Right means right.** These used to be pinned with `end-4`, a logical
 * edge: the right in an English page and the left in this office's Kurdish
 * ones. That was a deliberate rule once — `end` is the corner away from the
 * sidebar in either language (floating-direction.test) — but the owner asks
 * for a physical corner, because a corner is a place a thumb goes to, not a
 * reading direction. So these say `right`.
 *
 * **And right is not on top of the rail.** In Kurdish the sidebar sits on
 * the right and is 80px wide on a desktop, so a button at `right-4` would
 * cover it. From `md` up the row starts beside the rail instead; on a phone
 * the rail is off-canvas and the corner is the real corner.
 *
 * **One corner, one queue.** The chat bubble and the tips lamp both asked
 * for the same spot and landed on top of each other. Slots are handed out
 * here: slot 0 is the corner, slot 1 sits to its left, and so on, so a new
 * button takes the next free place rather than somebody else's.
 *
 * Numbers rather than a layout container because these are `fixed` elements
 * rendered from unrelated parts of the tree; a shared parent would mean
 * moving them all under one component to solve a problem that is two lines.
 */

/**
 * Where each slot sits: at the corner on a phone, clear of the 80px sidebar
 * rail from `md` up. 64px apart, which fits the widest of these buttons
 * (48px) with room either side.
 */
const SLOT_RIGHT = [
  "right-4 md:right-24",
  "right-20 md:right-40",
  "right-36 md:right-56",
  "right-52 md:right-72",
] as const;

/**
 * Where the nth floating button goes: 0 is the corner, 1 is beside it.
 *
 * Anything past the last slot stacks in the corner again — four buttons in
 * one corner is already a design problem, and hiding the fifth would only
 * hide the problem.
 */
export function cornerSlot(slot: number): string {
  return `fixed ${ROW_BOTTOM} ${SLOT_RIGHT[slot] ?? SLOT_RIGHT[0]} z-40`;
}

/**
 * On a phone the office has a tab bar along the bottom (components/mobile,
 * 2026-09-27): 4rem tall, above the home-indicator strip. The row sits just
 * over it there; on a desktop, in the corner as before.
 */
const ROW_BOTTOM = "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-4";

/**
 * A panel opened by one of those buttons: above the whole row rather than
 * beside it, so it never covers a neighbour.
 */
export const CORNER_PANEL =
  "fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-20 right-4 md:right-24 z-40";

/** Which slot each button holds. Named, so a reader can see the row. */
export const CORNER = {
  /** The office's own messages — the owner asked for this one in the corner. */
  chat: 0,
  /** The tips lamp, beside it. */
  tips: 1,
} as const;
