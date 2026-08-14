import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())("Package Claim Requests", () => {
  describe("getUnclaimedPackagesWithSearch", () => {
    it("should return unclaimed packages", async () => {
      const result = await db.getUnclaimedPackagesWithSearch();
      expect(result).toHaveProperty("packages");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.packages)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should filter by search term", async () => {
      const result = await db.getUnclaimedPackagesWithSearch({ search: "UNC" });
      expect(result).toHaveProperty("packages");
      expect(result).toHaveProperty("total");
    });

    it("should respect limit parameter", async () => {
      const result = await db.getUnclaimedPackagesWithSearch({ limit: 5 });
      expect(result.packages.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getNextClaimRequestNumber", () => {
    it("should return a valid claim request number", async () => {
      const number = await db.getNextClaimRequestNumber();
      expect(number).toMatch(/^CLM-\d{4}-\d{4}$/);
    });
  });

  describe("hasExistingClaimRequest", () => {
    it("should return false for non-existent claim", async () => {
      const result = await db.hasExistingClaimRequest(999999, 999999);
      expect(result).toBe(false);
    });
  });

  describe("getClaimRequestsByCustomer", () => {
    it("should return an array", async () => {
      const result = await db.getClaimRequestsByCustomer(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getAllClaimRequests with pending filter", () => {
    it("should return pending requests when filtered", async () => {
      const result = await db.getAllClaimRequests({ status: "pending" });
      expect(result).toHaveProperty("requests");
      expect(Array.isArray(result.requests)).toBe(true);
    });
  });

  describe("getAllClaimRequests", () => {
    it("should return claim requests with pagination", async () => {
      const result = await db.getAllClaimRequests();
      expect(result).toHaveProperty("requests");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.requests)).toBe(true);
    });

    it("should filter by status", async () => {
      const result = await db.getAllClaimRequests({ status: "pending" });
      expect(result).toHaveProperty("requests");
      result.requests.forEach((request: any) => {
        expect(request.status).toBe("pending");
      });
    });
  });
});
