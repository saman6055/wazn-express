/**
 * A box held at the customer's request.
 *
 * The owner, 2026-10-28: «هەندێ بۆکس هەیە دروست کراوە زیاتر لە سێ ڕۆژە
 * خاوەنەکەی دەڵێ جارێ مەنێرە بۆم». Such a box is not late; it is waiting on
 * its owner's word. So it stays ready, no reminder chases it, and the box
 * says why — until an admin lets it go, which is also what happens by itself
 * the moment it is sent.
 *
 * Only a box still with us can be held: open or sealed. One already sent or
 * handed over has nothing left to hold.
 */

export const HOLDABLE_BOX_STATUSES = ["open", "ready"] as const;

export function boxMayBeHeld(status: string | null | undefined): boolean {
  return (HOLDABLE_BOX_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export const HOLD_NOTE_MAX = 200;

export const BOX_HELD_LABEL = {
  ku: "ڕاگیراوە بە داوای کڕیار",
  en: "Held at the customer's request",
  ar: "محجوز بطلب العميل",
  zh: "应客户要求暂存",
} as const;
