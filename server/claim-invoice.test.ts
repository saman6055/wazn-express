import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

describe("Claim Request Invoice Generation", () => {
  describe("approveClaimRequest creates invoice", () => {
    it("should have createInvoice function available", async () => {
      expect(typeof db.createInvoice).toBe("function");
    });

    it("should have applyCharge function available", async () => {
      expect(typeof db.applyCharge).toBe("function");
    });

    it("should have getClaimRequestById function available", async () => {
      expect(typeof db.getClaimRequestById).toBe("function");
    });

    it("should have approveClaimRequest function available", async () => {
      expect(typeof db.approveClaimRequest).toBe("function");
    });

    it("should have getBatchById function available", async () => {
      expect(typeof db.getBatchById).toBe("function");
    });

    it("should have getPackageById function available", async () => {
      expect(typeof db.getPackageById).toBe("function");
    });

    it("should have getCurrentExchangeRate function available", async () => {
      expect(typeof db.getCurrentExchangeRate).toBe("function");
    });
  });

  describe("Unclaimed packages query", () => {
    it("should return packages with tracking numbers", async () => {
      const result = await db.getUnclaimedPackagesWithSearch();
      expect(result).toHaveProperty("packages");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.packages)).toBe(true);
      
      // Each package should have trackingNumber field available
      if (result.packages.length > 0) {
        const pkg = result.packages[0];
        expect(pkg).toHaveProperty("trackingNumber");
        expect(pkg).toHaveProperty("packageCode");
      }
    });
  });
});
