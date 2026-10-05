import { describe, it, expect } from "vitest";
import { isFullyArrived, missingTrackingList, notArrivedCount, splitArrival } from "./arrivalCheck";

/**
 * What an arrival check found (owner, 2026-10-05): the manifest set against
 * the arrival scans, in one place, so the list of checked batches and the
 * detail of one cannot count differently.
 */
const manifest = [
  { id: 1, trackingNumber: "T-1", customerCode: "AZ001" },
  { id: 2, trackingNumber: "T-2", customerCode: "AZ002" },
  { id: 3, trackingNumber: "T-3", customerCode: "AZ003" },
  { id: 4, trackingNumber: null, customerCode: "AZ004" },
];

describe("the manifest, split by what was checked in", () => {
  it("arrived and missing, each parcel in exactly one", () => {
    const split = splitArrival(manifest, [
      { packageId: 1, scannedAt: "2026-10-04T09:00:00Z", scannedByName: "Karwan" },
      { packageId: 3, scannedAt: "2026-10-04T09:05:00Z", scannedByName: "Karwan" },
    ]);
    expect(split.arrived.map((a) => a.parcel.id)).toEqual([3, 1]);
    expect(split.missing.map((p) => p.id)).toEqual([2, 4]);
    expect(split.arrived.length + split.missing.length).toBe(manifest.length);
  });

  it("says who checked it in and when", () => {
    const split = splitArrival(manifest, [{ packageId: 2, scannedAt: "2026-10-04T10:30:00Z", scannedByName: "Shadan" }]);
    expect(split.arrived[0].checkedBy).toBe("Shadan");
    expect(split.arrived[0].checkedAt?.toISOString()).toBe("2026-10-04T10:30:00.000Z");
  });

  it("a parcel scanned twice arrived once, at the first scan", () => {
    const split = splitArrival(manifest, [
      { packageId: 1, scannedAt: "2026-10-05T12:00:00Z", scannedByName: "Second" },
      { packageId: 1, scannedAt: "2026-10-04T09:00:00Z", scannedByName: "First" },
    ]);
    expect(split.arrived).toHaveLength(1);
    expect(split.arrived[0].checkedAt?.toISOString()).toBe("2026-10-04T09:00:00.000Z");
    expect(split.arrived[0].checkedBy).toBe("First");
  });

  it("a scan of a parcel that is no longer on the batch is not an arrival here", () => {
    const split = splitArrival(manifest, [{ packageId: 99, scannedAt: "2026-10-04T09:00:00Z" }]);
    expect(split.arrived).toEqual([]);
    expect(split.missing).toHaveLength(4);
  });

  it("nothing checked: everything is missing; nothing on the batch: nothing at all", () => {
    expect(splitArrival(manifest, []).missing).toHaveLength(4);
    expect(splitArrival([], [{ packageId: 1 }])).toEqual({ arrived: [], missing: [] });
  });

  it("a scan with no readable date still counts as an arrival", () => {
    const split = splitArrival(manifest, [{ packageId: 2, scannedAt: "not a date" }]);
    expect(split.arrived.map((a) => a.parcel.id)).toEqual([2]);
    expect(split.arrived[0].checkedAt).toBeNull();
  });
});

describe("the figures on the list", () => {
  it("not arrived is what is left, and never below zero", () => {
    expect(notArrivedCount({ totalParcels: 84, arrived: 80 })).toBe(4);
    expect(notArrivedCount({ totalParcels: 84, arrived: 84 })).toBe(0);
    // A parcel taken off the batch after it was scanned must not make -1.
    expect(notArrivedCount({ totalParcels: 3, arrived: 5 })).toBe(0);
  });

  it("complete only when the batch has parcels and all of them arrived", () => {
    expect(isFullyArrived({ totalParcels: 84, arrived: 84 })).toBe(true);
    expect(isFullyArrived({ totalParcels: 84, arrived: 83 })).toBe(false);
    expect(isFullyArrived({ totalParcels: 0, arrived: 0 })).toBe(false);
  });

  it("the missing trackings, one per line, for pasting to the carrier", () => {
    expect(missingTrackingList([manifest[1], manifest[3], manifest[2]])).toBe("T-2\nT-3");
    expect(missingTrackingList([])).toBe("");
  });
});
