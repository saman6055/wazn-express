/**
 * A parcel charged when it enters a priced batch keeps the price it was
 * charged, so the portal and the batch revenue report never read $0
 * beside a real ledger charge (2026-11-05).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("a parcel charged on entering a batch", () => {
  it("writes the charged amount as its price when it had none", () => {
    const src = read("server/db/batchCharging.db.ts");
    const fn = src.slice(src.indexOf("export async function chargeBatchShippingIfDue("), src.indexOf("export { batchChargesOnPricing }"));
    expect(fn).toContain("recordPackageChargeWithoutInvoice(");
    expect(fn).toContain("{ isCharged: true, calculatedCostUsd: p.amount.toFixed(2) }");
    expect(fn).not.toMatch(/updatePackage\(p\.pkg\.id, \{ isCharged: true \}\);/);
  });
});
