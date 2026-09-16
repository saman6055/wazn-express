import { describe, expect, it } from "vitest";
import {
  batchScore,
  bestScore,
  compactKey,
  customerScore,
  looksLikeCustomerCode,
  looksLikeTracking,
  matchScore,
  normalizeSearch,
  rankBatches,
  rankCustomers,
} from "./commandMatch";

describe("what was typed is folded to one form", () => {
  it("Arabic keyboard letters find Kurdish words", () => {
    // ي and ك typed on an Arabic keyboard, ی and ک in the label.
    expect(matchScore("كڕيار", "کڕیارەکان")).toBe(100);
  });

  it("Eastern digits and full-width letters read as plain ones", () => {
    expect(normalizeSearch("٠٧٥٠ ＡＺ")).toBe("0750 az");
    expect(compactKey("AZ-002 ")).toBe("az002");
  });
});

describe("how well a label matches", () => {
  it("prefix beats word prefix beats anywhere beats letters in order", () => {
    expect(matchScore("quick", "Quick register")).toBe(100);
    expect(matchScore("reg", "Quick register")).toBe(80);
    expect(matchScore("ick", "Quick register")).toBe(60);
    expect(matchScore("qkrg", "Quick register")).toBe(20);
    expect(matchScore("zzz", "Quick register")).toBe(0);
  });

  it("every word of a query found anywhere still counts", () => {
    expect(matchScore("batch new", "New batch")).toBeGreaterThanOrEqual(50);
  });

  it("the best of several texts wins", () => {
    expect(bestScore("manifest", ["چاپی مانیفێست", "print manifest batch"])).toBe(80);
  });
});

describe("the shape of what was typed", () => {
  it("a tracking number is long and mostly digits", () => {
    expect(looksLikeTracking("YT7524601234567")).toBe(true);
    expect(looksLikeTracking("yt 7524 6012 34567")).toBe(true);
    expect(looksLikeTracking("AZ002")).toBe(false);
    expect(looksLikeTracking("quick register")).toBe(false);
  });

  it("a customer code is a few letters and digits", () => {
    expect(looksLikeCustomerCode("AZ002")).toBe(true);
    expect(looksLikeCustomerCode("az 2")).toBe(true);
    expect(looksLikeCustomerCode("YT7524601234567")).toBe(false);
  });
});

describe("customers", () => {
  const customers = [
    { id: 1, customerCode: "AZ002(Aram Karim)", fullName: "Aram Karim", mobileNumber: "07501234567" },
    { id: 2, customerCode: "AZ0021", fullName: "Dilan Omar", mobileNumber: "07709876543" },
    { id: 3, customerCode: "BK010", fullName: "Aras Aziz", mobileNumber: "07501110000", isActive: false },
  ];

  it("a code typed whole names one person, above codes that only start with it", () => {
    expect(customerScore("az002", customers[0])).toBe(130);
    expect(customerScore("az002", customers[1])).toBe(110);
    expect(rankCustomers("AZ002", customers).map((c) => c.id)).toEqual([1, 2]);
  });

  it("a phone is matched on its digits, with or without the leading zero", () => {
    expect(rankCustomers("0750 123", customers).map((c) => c.id)).toEqual([1]);
    expect(rankCustomers("750123", customers).map((c) => c.id)).toEqual([1]);
  });

  it("a name matches, and an inactive customer sorts after an active one", () => {
    expect(rankCustomers("ara", customers).map((c) => c.id)).toEqual([1, 3]);
  });

  it("nothing typed is nothing found", () => {
    expect(rankCustomers("  ", customers)).toEqual([]);
  });
});

describe("batches", () => {
  const batches = [
    { id: 1, batchCode: "AIR-2026-041", status: "delivered", createdAt: "2026-08-01" },
    { id: 2, batchCode: "AIR-2026-104", status: "preparing", createdAt: "2026-09-10" },
    { id: 3, batchCode: "SEA-2026-004", status: "in_transit", createdAt: "2026-09-01" },
  ];

  it("a whole code outranks a tracking-shaped guess", () => {
    expect(batchScore("AIR2026041", batches[0])).toBe(150);
    expect(batchScore("air-2026", batches[0])).toBe(120);
    expect(batchScore("041", batches[0])).toBe(90);
  });

  it("with nothing typed, the batches still being worked on come first", () => {
    expect(rankBatches("", batches).map((b) => b.id)).toEqual([2, 3, 1]);
  });

  it("an exact code comes first whatever its status", () => {
    expect(rankBatches("AIR-2026-041", batches)[0].id).toBe(1);
  });
});
