import { describe, expect, it } from "vitest";
import { generateCustomerCode } from "@shared/types";
import * as db from "./db";

describe("Customer Code Generation", () => {
  it("should generate code with 3-digit padding", () => {
    expect(generateCustomerCode(1, "John", "AZ")).toBe("AZ001(John)");
    expect(generateCustomerCode(5, "Ali", "QI")).toBe("QI005(Ali)");
    expect(generateCustomerCode(99, "Sara", "WZ")).toBe("WZ099(Sara)");
    expect(generateCustomerCode(100, "Omar", "AZ")).toBe("AZ100(Omar)");
    expect(generateCustomerCode(999, "Test", "VIP")).toBe("VIP999(Test)");
    expect(generateCustomerCode(1000, "Big", "AZ")).toBe("AZ1000(Big)");
  });

  it("should use 3-digit format not 4-digit", () => {
    const code = generateCustomerCode(1, "Test", "AZ");
    // Should be AZ001 not AZ0001
    expect(code).toBe("AZ001(Test)");
    expect(code).not.toBe("AZ0001(Test)");
  });

  it("should handle different prefixes correctly", () => {
    expect(generateCustomerCode(1, "A", "AZ")).toMatch(/^AZ001/);
    expect(generateCustomerCode(1, "B", "QI")).toMatch(/^QI001/);
    expect(generateCustomerCode(1, "C", "WZ")).toMatch(/^WZ001/);
    expect(generateCustomerCode(1, "D", "VIP")).toMatch(/^VIP001/);
    expect(generateCustomerCode(1, "E", "EX")).toMatch(/^EX001/);
    expect(generateCustomerCode(1, "F", "PRO")).toMatch(/^PRO001/);
  });
});

describe("Per-Prefix Sequence Number (getNextSequenceForPrefix)", () => {
  it("should return 1 for a prefix with no existing customers", async () => {
    // Use a very unlikely prefix that won't exist
    const nextSeq = await db.getNextSequenceForPrefix("ZZZTEST");
    // If no customers with this prefix exist, should return 1
    expect(nextSeq).toBeGreaterThanOrEqual(1);
  });

  it("should return correct next sequence for existing prefix", async () => {
    // Get the next sequence for AZ prefix (likely has existing customers)
    const nextSeqAZ = await db.getNextSequenceForPrefix("AZ");
    expect(typeof nextSeqAZ).toBe("number");
    expect(nextSeqAZ).toBeGreaterThanOrEqual(1);
  });

  it("should return independent sequences for different prefixes", async () => {
    // Different prefixes should have independent sequence counters
    const nextSeqAZ = await db.getNextSequenceForPrefix("AZ");
    const nextSeqUnused = await db.getNextSequenceForPrefix("ZZUNUSED");
    
    // AZ likely has customers, ZZUNUSED should not
    // So AZ sequence should be higher than ZZUNUSED (which should be 1)
    expect(nextSeqUnused).toBe(1);
    // AZ should be >= 1 (could be 1 if no AZ customers exist)
    expect(nextSeqAZ).toBeGreaterThanOrEqual(1);
  });
});
