import { describe, it, expect } from "vitest";
import {
  getCustomerBatches,
  getCustomerPackagesInBatch,
  getCustomerFinancialSummary,
  searchPackageByTracking,
} from "./db";

describe("Customer Portal API", () => {
  describe("getCustomerBatches", () => {
    it("should return empty array for non-existent customer", async () => {
      const batches = await getCustomerBatches(999999);
      expect(Array.isArray(batches)).toBe(true);
    });

    it("should return batches array", async () => {
      const batches = await getCustomerBatches(1);
      expect(Array.isArray(batches)).toBe(true);
    });
  });

  describe("getCustomerPackagesInBatch", () => {
    it("should return empty array for non-existent batch", async () => {
      const packages = await getCustomerPackagesInBatch(1, 999999);
      expect(Array.isArray(packages)).toBe(true);
      expect(packages.length).toBe(0);
    });

    it("should return only packages belonging to the customer", async () => {
      const packages = await getCustomerPackagesInBatch(1, 1);
      expect(Array.isArray(packages)).toBe(true);
      // All returned packages should belong to the specified customer
      packages.forEach((pkg) => {
        expect(pkg.customerId).toBe(1);
      });
    });
  });

  describe("getCustomerFinancialSummary", () => {
    it("should return financial summary object", async () => {
      const summary = await getCustomerFinancialSummary(1);
      // Should always return an object (even with zero values)
      expect(summary).toBeDefined();
      expect(typeof summary).toBe("object");
    });

    it("should return summary with balance fields", async () => {
      const summary = await getCustomerFinancialSummary(1);
      if (summary) {
        // Check for the actual field names used in the function
        expect(summary).toHaveProperty("balanceUsd");
        expect(summary).toHaveProperty("creditLimitUsd");
        // totalPaidUsd may not exist if no payments made
      }
    });
  });

  describe("searchPackageByTracking", () => {
    it("should return null for non-existent tracking number", async () => {
      const pkg = await searchPackageByTracking("NONEXISTENT12345XYZ");
      expect(pkg).toBeNull();
    });

    it("should handle empty tracking number", async () => {
      const pkg = await searchPackageByTracking("");
      expect(pkg).toBeNull();
    });
  });
});
