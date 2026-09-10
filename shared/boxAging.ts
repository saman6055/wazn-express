/**
 * When an unpaid box counts as old.
 *
 * The red "N days without payment" badge on a box-list row flags a box
 * opened more than five whole days ago (the owner's own figure for how long
 * open → handover normally takes). The "old and unpaid" chip above the list
 * must name exactly the same boxes, so both read this one rule: the badge on
 * the client, the chip's SQL on the server.
 */

export const BOX_UNPAID_ALERT_DAYS = 5;

const DAY_MS = 86_400_000;

/** Whole days since the box was opened. */
export function boxAgeDays(createdAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / DAY_MS));
}

/** Opened more than BOX_UNPAID_ALERT_DAYS whole days ago. */
export function isBoxOld(createdAt: Date, now: Date = new Date()): boolean {
  return boxAgeDays(createdAt, now) > BOX_UNPAID_ALERT_DAYS;
}

/**
 * The same rule as a moment, for SQL: a box opened at or before this is old.
 * floor(age / day) > 5 is age ≥ 6 whole days.
 */
export function boxOldCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - (BOX_UNPAID_ALERT_DAYS + 1) * DAY_MS);
}
