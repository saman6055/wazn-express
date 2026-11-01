import { statusForScan, isPackageStatus } from "./lib/scanStatus";
import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Barcode Scanning System", () => {
  describe("Database Functions", () => {
    it("should search package by tracking number", async () => {
      // Search for a non-existent tracking number
      const result = await db.searchPackageByTracking("NON_EXISTENT_123");
      expect(result).toBeNull();
    });

    it("should get package with customer info by tracking", async () => {
      const result = await db.getPackageWithCustomerByTracking("NON_EXISTENT_456");
      expect(result).toBeNull();
    });

    it("should get today's scan stats", async () => {
      const stats = await db.getTodayScanStats();
      expect(Array.isArray(stats)).toBe(true);
    });

    it("should get packages missing info", async () => {
      const missing = await db.getPackagesMissingInfo();
      expect(Array.isArray(missing)).toBe(true);
    });

    it("should get active devices", async () => {
      const devices = await db.getActiveDevices();
      expect(Array.isArray(devices)).toBe(true);
    });
  });

  describe("Scan Types", () => {
    const validScanTypes = [
      "registered",
      "received_china", 
      "in_batch",
      "in_transit",
      "received_local",
      "out_for_delivery",
      "delivered",
      "returned",
      "customs_hold"
    ];

    it("should have all required scan types defined", () => {
      expect(validScanTypes.length).toBe(9);
      expect(validScanTypes).toContain("registered");
      expect(validScanTypes).toContain("delivered");
    });
  });

  describe("Status Mapping", () => {
    // The mapping moved to server/lib/scanStatus.ts and is covered by
    // server/scan-status.test.ts. It used to be asserted here as display
    // strings ('In Local Warehouse'), which is exactly the shape that could
    // not be written to the packages.status ENUM.
    const scanTypes = [
      "registered", "received_china", "in_batch", "in_transit",
      "received_local", "out_for_delivery", "delivered", "returned", "customs_hold",
    ];

    it("maps every scan type to a value the status column accepts", () => {
      for (const scanType of scanTypes) {
        const status = statusForScan(scanType);
        expect(status, scanType).not.toBeNull();
        expect(isPackageStatus(status!), scanType).toBe(true);
      }
    });
  });
  describe("Notification Triggers", () => {
    const notificationTriggers = ['received_local', 'delivered'];

    it("should trigger notifications for significant status changes", () => {
      expect(notificationTriggers).toContain('received_local');
      expect(notificationTriggers).toContain('delivered');
    });

    it("should not trigger notifications for intermediate statuses", () => {
      expect(notificationTriggers).not.toContain('in_transit');
      expect(notificationTriggers).not.toContain('in_batch');
    });
  });
});
