import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sweepRecord } from "./auditSweep";

/**
 * Each row of the morning brief carries its records, each opening where it is
 * put right (owner, 2026-11-05: «ناچێتە سەر خودی کێشەکان و پێشنیاری چارەسەر»).
 */
describe("sweepRecord", () => {
  it("an order opens the order, by its type", () => {
    expect(sweepRecord({ orderId: 12, orderType: "commission", orderCode: "CM-ABC123", chargedTo: "AZ001", parcelWith: "AZ002", packageCode: "PKG-9", standingUsd: "28.63" }))
      .toEqual({ text: "CM-ABC123 · PKG-9 · AZ001 → AZ002 · $28.63", href: "/commission/12" });
    expect(sweepRecord({ id: 7, orderCode: "FP-XYZ999", orderType: "full_package" })?.href).toBe("/full-package/7");
  });

  it("a parcel opens the parcels list searched by its tracking", () => {
    expect(sweepRecord({ packageCode: "PKG-1", trackingNumber: "SF123", chargedTo: "AZ088", ownedBy: "AZ301", standingUsd: 40 }))
      .toEqual({ text: "PKG-1 · SF123 · AZ088 → AZ301 · $40.00", href: "/packages/all?search=SF123" });
  });

  it("a batch opens the batch", () => {
    expect(sweepRecord({ id: 6, batchCode: "AIR-2026-070", status: "closed" }))
      .toEqual({ text: "AIR-2026-070 · closed", href: "/batches?find=AIR-2026-070" });
  });

  it("an account opens the customer's finance page and says what disagrees", () => {
    expect(sweepRecord({ id: 1, accountNumber: "ACC-1", customerId: 5, currentBalanceUsd: "10.00", fromHistory: "12.50" }))
      .toEqual({ text: "ACC-1 · $10.00 ≠ $12.50", href: "/finance/customer/5" });
  });

  it("nothing usable is no record", () => {
    expect(sweepRecord(null)).toBeNull();
    expect(sweepRecord({ foo: 1 })).toBeNull();
  });

  it("the brief carries the records and says when the count stopped at the sample", () => {
    const svc = readFileSync(resolve(__dirname, "../server/services/dailyBrief.service.ts"), "utf8");
    expect(svc).toContain("records: (result.sample ?? []).map(sweepRecord)");
    expect(svc).toContain("more: result.count >= SWEEP_SAMPLE_LIMIT");
    const ui = readFileSync(resolve(__dirname, "../client/src/components/DailyBrief.tsx"), "utf8");
    expect(ui).toContain('data-testid="brief-records"');
  });
});
