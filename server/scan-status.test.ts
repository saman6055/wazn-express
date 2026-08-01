import { describe, it, expect } from "vitest";
import {
  statusForScan,
  isPackageStatus,
  PACKAGE_STATUSES,
  type ScanType,
} from "./lib/scanStatus";

/**
 * `packages.status` is an ENUM. Writing anything outside its nine members is
 * rejected outright by MySQL in strict mode — which is what the router used to
 * do for six of the nine scan types, by mapping them to display strings like
 * 'In Local Warehouse' and writing those to the column.
 *
 * These tests exist to make that class of mistake impossible to reintroduce:
 * every scan type must resolve to a value the column can hold.
 */

const ALL_SCAN_TYPES: ScanType[] = [
  "registered",
  "received_china",
  "in_batch",
  "in_transit",
  "received_local",
  "out_for_delivery",
  "delivered",
  "returned",
  "customs_hold",
];

describe("statusForScan", () => {
  it("resolves every scan type to a status the column can hold", () => {
    for (const scanType of ALL_SCAN_TYPES) {
      const status = statusForScan(scanType);
      expect(status, scanType).not.toBeNull();
      expect(isPackageStatus(status!), `${scanType} → ${status}`).toBe(true);
    }
  });

  it("never returns a display string — the bug this replaced", () => {
    for (const scanType of ALL_SCAN_TYPES) {
      const status = statusForScan(scanType)!;
      // 'In Local Warehouse' and friends: spaces and capitals are the tell.
      expect(status, scanType).toMatch(/^[a-z_]+$/);
    }
  });

  it("lights up the Erbil depot rung, which nothing ever set", () => {
    expect(statusForScan("received_local")).toBe("ready_for_delivery");
  });

  it("treats a customs hold as customs processing, not as delivered or lost", () => {
    expect(statusForScan("customs_hold")).toBe("customs_processing");
  });

  it("keeps the China depot on the first rung — there is no separate state", () => {
    expect(statusForScan("received_china")).toBe("registered");
    expect(statusForScan("registered")).toBe("registered");
  });

  it("maps the straightforward ones to their namesake", () => {
    expect(statusForScan("in_batch")).toBe("in_batch");
    expect(statusForScan("in_transit")).toBe("in_transit");
    expect(statusForScan("out_for_delivery")).toBe("out_for_delivery");
    expect(statusForScan("delivered")).toBe("delivered");
    expect(statusForScan("returned")).toBe("returned");
  });

  it("returns null for a scan type it does not know, rather than a bad write", () => {
    expect(statusForScan("teleported")).toBeNull();
    expect(statusForScan("")).toBeNull();
    // The old display strings must not sneak back in as inputs either.
    expect(statusForScan("In Local Warehouse")).toBeNull();
  });

  it("moves a package forward for every scan type except the two that don't", () => {
    // returned and customs_hold are the only ones that are not progress.
    const forward = ALL_SCAN_TYPES.filter(
      (s) => s !== "returned" && s !== "customs_hold",
    );
    for (const scanType of forward) {
      expect(statusForScan(scanType), scanType).not.toBe("returned");
      expect(statusForScan(scanType), scanType).not.toBe("cancelled");
    }
  });
});

describe("isPackageStatus", () => {
  it("accepts exactly the nine ENUM members", () => {
    expect(PACKAGE_STATUSES).toHaveLength(9);
    for (const status of PACKAGE_STATUSES) {
      expect(isPackageStatus(status), status).toBe(true);
    }
  });

  it("rejects the display strings that used to reach the column", () => {
    for (const bad of [
      "In Local Warehouse",
      "In China Warehouse",
      "In Batch",
      "In Transit",
      "Out for Delivery",
      "Customs Hold",
    ]) {
      expect(isPackageStatus(bad), bad).toBe(false);
    }
  });

  it("rejects a capitalised version of a real member", () => {
    // MySQL would accept these (ENUM lookups ignore case), which is exactly
    // why 'Registered' and 'Delivered' masked the bug for so long.
    expect(isPackageStatus("Registered")).toBe(false);
    expect(isPackageStatus("Delivered")).toBe(false);
  });
});
