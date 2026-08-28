/**
 * When a finished record stops being current work.
 *
 * The batches list had sixteen delivered shipments and four live ones, and
 * the four were the hard ones to find. That only gets worse: nothing is ever
 * removed, so every list in the system slowly fills with things nobody is
 * working on any more.
 *
 * Archiving here is derived, not stored. A batch already says it is
 * delivered or closed — a separate `archived` flag would be a second place
 * to record the same fact, and the two would eventually disagree. So the
 * rule reads the status that is already there, plus how long ago it was
 * last touched.
 *
 * Deliberately one rule in one file, shared by every section that adopts it.
 * The alternative — each page deciding for itself what counts as old — is
 * how three portal skins ended up with three different answers to the same
 * question.
 */

/** How long a finished record stays in the main list before it drops out.
 *  Ten days: long enough to still be handling the tail of a delivered
 *  shipment, short enough that the list is about this week's work. */
export const ARCHIVE_AFTER_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses that mean a batch's work is over. */
export const FINISHED_BATCH_STATUSES = ["delivered", "closed"] as const;

/** Statuses that mean a delivery box is finished with — handed over, or
 *  cancelled. A cancelled box is not deleted: the mistake is part of the
 *  record. It just stops crowding the list once it is old. */
export const FINISHED_BOX_STATUSES = ["delivered", "cancelled"] as const;

export interface ArchivableRecord {
  status?: string | null;
  /**
   * Last time anybody touched this record. Not the date it was created:
   * a batch someone edited yesterday is current work again, whatever its
   * status says, and should come back into view.
   */
  updatedAt?: Date | string | null;
}

/**
 * Has this record dropped out of the main list?
 *
 * `now` is a parameter rather than read from the clock so the rule can be
 * tested, and so a list rendered once does not shift under the reader.
 */
export function isArchived(
  record: ArchivableRecord,
  finishedStatuses: readonly string[],
  now: Date = new Date()
): boolean {
  if (!record.status || !finishedStatuses.includes(record.status)) return false;

  const touched = record.updatedAt ? new Date(record.updatedAt) : null;
  // No timestamp at all: it is finished, and there is nothing to say it is
  // recent. Treat it as old — that is what an unstamped legacy row is.
  if (!touched || Number.isNaN(touched.getTime())) return true;

  return now.getTime() - touched.getTime() > ARCHIVE_AFTER_DAYS * DAY_MS;
}

/**
 * A delivery box drops out of the list when nothing is left to do with it.
 *
 * For a box that means one thing above all: the money has been taken. A box
 * that is sealed and handed over but not paid for is not finished work — it
 * is the most important row on the screen, and the one carrying the button
 * that collects it. Archiving on the seal alone would hide exactly the boxes
 * somebody still has to chase.
 *
 * So a settled box goes immediately, whatever its age, because there is
 * genuinely nothing more to do. A cancelled one goes immediately too: there
 * was never anything to collect.
 *
 * The ten-day rule stays underneath as a floor. Every box handed over before
 * settlement existed has no receipt against it and would otherwise come
 * flooding back into the list on the day this ships.
 */
export interface ArchivableBox extends ArchivableRecord {
  /** Money taken against this box, from confirmed receipts only. */
  settledUsd?: number | null;
  /** What the box is worth. Zero or missing falls back to the age rule. */
  totalValueUsd?: string | number | null;
}

export function isBoxArchived(box: ArchivableBox, now: Date = new Date()): boolean {
  if (box.status === "cancelled") return true;

  const settled = Number(box.settledUsd ?? 0);
  if (settled > 0) {
    const worth = Number(box.totalValueUsd ?? 0);
    // Part-paid is still work: somebody is owed the rest. Only a box paid
    // for in full is done. A box worth nothing on record but with money
    // taken against it counts as done — the money is the better evidence.
    if (!(worth > 0) || settled + 0.005 >= worth) return true;
    return false;
  }

  return isArchived(box, FINISHED_BOX_STATUSES, now);
}

/** Has this batch dropped out of the main list? */
export function isBatchArchived(record: ArchivableRecord, now?: Date): boolean {
  return isArchived(record, FINISHED_BATCH_STATUSES, now);
}

/**
 * Split a list into what is still current and what has been archived.
 *
 * Returns both halves rather than filtering in place, because the summary
 * counts above a list must keep counting everything — hiding a delivered
 * batch from the table should not make the "Delivered" figure drop.
 */
export function partitionBoxes<T extends ArchivableBox>(
  boxes: readonly T[],
  now?: Date,
): { current: T[]; archived: T[] } {
  const current: T[] = [];
  const archived: T[] = [];
  for (const box of boxes) {
    (isBoxArchived(box, now) ? archived : current).push(box);
  }
  return { current, archived };
}

export function partitionArchived<T extends ArchivableRecord>(
  records: readonly T[],
  finishedStatuses: readonly string[],
  now?: Date
): { current: T[]; archived: T[] } {
  const current: T[] = [];
  const archived: T[] = [];
  for (const record of records) {
    (isArchived(record, finishedStatuses, now) ? archived : current).push(record);
  }
  return { current, archived };
}
