import { describe, expect, it } from "vitest";
import {
  ARCHIVE_AFTER_DAYS,
  FINISHED_BATCH_STATUSES,
  FINISHED_BOX_STATUSES,
  isArchived,
  isBatchArchived,
  partitionArchived,
} from "./archive";

const NOW = new Date("2026-08-13T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("archiving", () => {
  it("leaves unfinished work alone however old it is", () => {
    // A batch stuck in preparing for a year is not archived — it is a
    // problem, and hiding it is the opposite of what anyone wants.
    for (const status of ["preparing", "in_transit", "arrived", "customs", "at_depot"]) {
      expect(isBatchArchived({ status, updatedAt: daysAgo(400) }, NOW), status).toBe(false);
    }
  });

  it("archives finished work once it has been left alone long enough", () => {
    for (const status of FINISHED_BATCH_STATUSES) {
      expect(isBatchArchived({ status, updatedAt: daysAgo(ARCHIVE_AFTER_DAYS + 1) }, NOW), status).toBe(true);
      expect(isBatchArchived({ status, updatedAt: daysAgo(ARCHIVE_AFTER_DAYS - 1) }, NOW), status).toBe(false);
    }
  });

  it("brings a record back the moment somebody touches it", () => {
    // Editing an old batch means it is current work again, whatever its
    // status says. Otherwise you edit something and it vanishes.
    const old = { status: "delivered", updatedAt: daysAgo(400) };
    expect(isBatchArchived(old, NOW)).toBe(true);
    expect(isBatchArchived({ ...old, updatedAt: daysAgo(1) }, NOW)).toBe(false);
  });

  it("treats a finished record with no timestamp as old", () => {
    // What an unstamped legacy row actually is.
    expect(isBatchArchived({ status: "closed", updatedAt: null }, NOW)).toBe(true);
    expect(isBatchArchived({ status: "closed", updatedAt: "not a date" }, NOW)).toBe(true);
    // But an unfinished one is still not archived.
    expect(isBatchArchived({ status: "preparing", updatedAt: null }, NOW)).toBe(false);
  });

  it("accepts a timestamp however the API hands it over", () => {
    const iso = daysAgo(ARCHIVE_AFTER_DAYS + 1).toISOString();
    expect(isBatchArchived({ status: "delivered", updatedAt: iso }, NOW)).toBe(true);
    expect(isBatchArchived({ status: "delivered", updatedAt: new Date(iso) }, NOW)).toBe(true);
  });

  it("is not specific to batches", () => {
    // The same rule, given a different set of finished statuses.
    expect(isArchived({ status: "completed", updatedAt: daysAgo(90) }, ["completed"], NOW)).toBe(true);
    expect(isArchived({ status: "completed", updatedAt: daysAgo(90) }, ["cancelled"], NOW)).toBe(false);
  });

  it("hands back both halves so the totals above a list stay honest", () => {
    // Hiding a delivered batch from the table must not make the "Delivered"
    // figure drop — the counts are taken from the whole set, not the visible
    // one, which is only possible if nothing is thrown away here.
    const records = [
      { id: 1, status: "preparing", updatedAt: daysAgo(400) },
      { id: 2, status: "delivered", updatedAt: daysAgo(400) },
      { id: 3, status: "delivered", updatedAt: daysAgo(1) },
      { id: 4, status: "closed", updatedAt: daysAgo(400) },
    ];
    const { current, archived } = partitionArchived(records, FINISHED_BATCH_STATUSES, NOW);
    expect(current.map((r) => r.id)).toEqual([1, 3]);
    expect(archived.map((r) => r.id)).toEqual([2, 4]);
    expect(current.length + archived.length).toBe(records.length);
  });
});

describe("archiving delivery boxes", () => {
  it("uses the same ten days as everything else", () => {
    // The point of one shared rule: a box and a batch cannot disagree about
    // what counts as old.
    for (const status of FINISHED_BOX_STATUSES) {
      expect(isArchived({ status, updatedAt: daysAgo(ARCHIVE_AFTER_DAYS + 1) }, FINISHED_BOX_STATUSES, NOW), status).toBe(true);
      expect(isArchived({ status, updatedAt: daysAgo(ARCHIVE_AFTER_DAYS - 1) }, FINISHED_BOX_STATUSES, NOW), status).toBe(false);
    }
  });

  it("counts a cancelled box as finished, not as live work", () => {
    // A box cancelled by mistake is still a record of what happened. It stops
    // crowding the list, it does not disappear.
    expect(isArchived({ status: "cancelled", updatedAt: daysAgo(30) }, FINISHED_BOX_STATUSES, NOW)).toBe(true);
  });

  it("leaves a box that is still going", () => {
    for (const status of ["open", "ready", "in_transit"]) {
      expect(isArchived({ status, updatedAt: daysAgo(400) }, FINISHED_BOX_STATUSES, NOW), status).toBe(false);
    }
  });
});
