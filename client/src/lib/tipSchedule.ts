/**
 * When a tip is allowed to appear.
 *
 * It used to appear on every app load, and again every time somebody came back
 * to their desk after ten minutes away. On a normal day that is a card in the
 * corner a dozen times or more — which is not a tip, it is an interruption,
 * and the reader stops reading them entirely. A teaching feature that trains
 * people to dismiss it without looking has done worse than nothing.
 *
 * Two a day now, at fixed hours: one mid-morning, one mid-afternoon.
 *
 * Fixed hours rather than "every N hours" because the point is to be
 * predictable. Somebody who has read the morning tip knows there is not
 * another until three, and can ignore the corner of their screen until then.
 */

export const TIP_HOURS = [10, 15] as const;

export type TipSlot = "morning" | "afternoon";

const SLOTS: readonly { slot: TipSlot; hour: number }[] = [
  { slot: "morning", hour: TIP_HOURS[0] },
  { slot: "afternoon", hour: TIP_HOURS[1] },
];

/** A day and slot together, so a tip shown yesterday does not silence today's. */
export function slotKey(now: Date, slot: TipSlot): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}:${slot}`;
}

/**
 * Which slot is owed right now, if any.
 *
 * The latest slot whose hour has passed and which has not been shown today.
 * Latest rather than earliest: somebody who opens the system for the first
 * time at four in the afternoon should get the afternoon tip, not a morning
 * one shown six hours late and then a second one straight after it.
 *
 * A missed slot is missed. Catching up is how two tips a day becomes two tips
 * at once, which is the crowding this is here to end.
 */
export function dueSlot(now: Date, shownKeys: readonly string[]): TipSlot | null {
  const hour = now.getHours();

  for (let i = SLOTS.length - 1; i >= 0; i--) {
    const { slot, hour: at } = SLOTS[i];
    if (hour < at) continue;
    if (shownKeys.includes(slotKey(now, slot))) return null;
    return slot;
  }

  return null;
}

/**
 * Yesterday's keys, dropped.
 *
 * Only today's matter, and an unbounded list in localStorage is a slow leak
 * that nobody would ever notice or clear.
 */
export function pruneKeys(now: Date, shownKeys: readonly string[]): string[] {
  const today = slotKey(now, "morning").split(":")[0];
  return shownKeys.filter((k) => k.startsWith(`${today}:`));
}

/**
 * How long until it is worth looking again.
 *
 * Used to set a timer rather than polling every second. Capped at a minute so
 * a machine left open across a slot boundary still notices within a minute,
 * and never returns zero, which would spin.
 */
export function msUntilNextCheck(now: Date): number {
  const MINUTE = 60 * 1000;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  return Math.max(1000, Math.min(MINUTE, next.getTime() - now.getTime()));
}
