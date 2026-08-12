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

/** How long a finished record stays in the main list before it drops out. */
export const ARCHIVE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses that mean a batch's work is over. */
export const FINISHED_BATCH_STATUSES = ["delivered", "closed"] as const;

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
