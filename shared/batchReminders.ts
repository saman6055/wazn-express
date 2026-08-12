/**
 * Batches that are travelling without the number that identifies them.
 *
 * An air waybill or a container number is never known when a batch is
 * created — the cartons are still being filled. It arrives days later, and
 * nothing asks for it. A batch can therefore reach Erbil with the field
 * still blank, which costs twice: staff cannot look the shipment up with the
 * carrier, and the customer's page in the portal shows a shipment with
 * nothing to click.
 *
 * So this is the same shape as the existing tracking alerts for orders: find
 * the records missing something, say how overdue each one is, and let the
 * screen decide how loudly to say it.
 *
 * The rule lives here rather than in the query so the server, the page and
 * the tests all read the same definition of "overdue".
 */

/** Grace period before a batch without its number is worth chasing. */
export const REMIND_AFTER_DAYS = 5;

/** Overdue by this much and it is no longer a reminder. */
export const URGENT_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses where chasing the number is pointless — it is over. */
export const SETTLED_BATCH_STATUSES = ["delivered", "closed"] as const;

export type ReminderSeverity = "none" | "due" | "urgent";

export interface BatchAwaitingDetails {
  status?: string | null;
  shippingType?: string | null;
  awbNumber?: string | null;
  containerNumber?: string | null;
  createdAt?: Date | string | null;
}

const blank = (value?: string | null) => !value || !value.trim();

/** Is this a sea batch? Everything else is treated as air. */
export function isSeaBatch(shippingType?: string | null): boolean {
  return shippingType === "sea";
}

/**
 * Which number is this batch missing, if any.
 *
 * A sea batch needs a container number; an air batch needs an air waybill.
 * Asking a sea batch for a waybill would be noise nobody can act on, which
 * is how a reminder system gets ignored.
 */
export function missingShippingNumber(
  batch: BatchAwaitingDetails
): "awb" | "container" | null {
  if (isSeaBatch(batch.shippingType)) {
    return blank(batch.containerNumber) ? "container" : null;
  }
  return blank(batch.awbNumber) ? "awb" : null;
}

/** Whole days since the batch was created. */
export function daysSinceCreated(
  batch: BatchAwaitingDetails,
  now: Date = new Date()
): number {
  if (!batch.createdAt) return 0;
  const created = new Date(batch.createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.floor((now.getTime() - created.getTime()) / DAY_MS);
}

/**
 * How loudly to ask for this batch's missing number.
 *
 * `now` is a parameter so the rule can be tested and so a list rendered once
 * does not shift under the reader.
 */
export function reminderSeverity(
  batch: BatchAwaitingDetails,
  now: Date = new Date()
): ReminderSeverity {
  // Over and done with. Whatever was or was not recorded, chasing it now
  // helps nobody.
  if (batch.status && SETTLED_BATCH_STATUSES.includes(batch.status as never)) return "none";
  if (!missingShippingNumber(batch)) return "none";

  const days = daysSinceCreated(batch, now);
  if (days >= URGENT_AFTER_DAYS) return "urgent";
  if (days >= REMIND_AFTER_DAYS) return "due";
  return "none";
}

/** Every batch worth chasing, most overdue first. */
export function batchesAwaitingShippingNumber<T extends BatchAwaitingDetails>(
  batches: readonly T[],
  now: Date = new Date()
): Array<T & { severity: Exclude<ReminderSeverity, "none">; daysWaiting: number }> {
  return batches
    .map((batch) => ({
      batch,
      severity: reminderSeverity(batch, now),
      daysWaiting: daysSinceCreated(batch, now),
    }))
    .filter((row) => row.severity !== "none")
    .map((row) => ({
      ...row.batch,
      severity: row.severity as Exclude<ReminderSeverity, "none">,
      daysWaiting: row.daysWaiting,
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
}
