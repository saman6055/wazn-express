import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { batchChargesOnPricing, SHIPPING_CHARGE_ON_PRICING_FROM } from "./lib/chargePolicy";

/**
 * The owner's 2026-09-09 decision: shipping debt is born when a batch gets
 * its selling price, not when it is marked delivered — for batches created
 * from the cutoff onward (decision B: older batches finish under the old
 * rule). The engine must be idempotent, bill only self-order parcels, and
 * resolve rates and weights through the same shared rules as everything
 * else. These tests hold each of those to one copy.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, start: string, end: string, what: string): string {
  const a = src.indexOf(start);
  expect(a, `${what}: start marker not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a);
  expect(b, `${what}: end marker not found`).toBeGreaterThan(a);
  return src.slice(a, b);
}

const AFTER = new Date(SHIPPING_CHARGE_ON_PRICING_FROM.getTime() + 86_400_000);
const BEFORE = new Date(SHIPPING_CHARGE_ON_PRICING_FROM.getTime() - 86_400_000);

describe("which batches charge on pricing", () => {
  it("a new priced batch does; an old one never, however priced", () => {
    expect(batchChargesOnPricing({ createdAt: AFTER, shippingType: "air_regular", pricePerKg: "11.00" })).toBe(true);
    expect(batchChargesOnPricing({ createdAt: BEFORE, shippingType: "air_regular", pricePerKg: "11.00" })).toBe(false);
  });

  it("no price for the way it travels means no charge yet", () => {
    expect(batchChargesOnPricing({ createdAt: AFTER, shippingType: "air_regular", pricePerKg: null })).toBe(false);
    // A sea batch is sold by the cubic metre; a kg price on it prices nothing.
    expect(batchChargesOnPricing({ createdAt: AFTER, shippingType: "sea", pricePerKg: "11.00", pricePerCbm: null })).toBe(false);
    expect(batchChargesOnPricing({ createdAt: AFTER, shippingType: "sea", pricePerCbm: "260" })).toBe(true);
  });
});

describe("the charging engine keeps to the shared rules", () => {
  const engine = read("db/batchCharging.db.ts");

  it("bills only self-order parcels, through the one shared filter", () => {
    expect(engine).toContain("...selfOrderConditions()");
  });

  it("never charges a parcel twice", () => {
    expect(engine).toContain("eq(packages.isCharged, false)");
    expect(engine).toContain("updatePackage(p.pkg.id, { isCharged: true })");
  });

  it("resolves the rate and the weight where everyone else does", () => {
    expect(engine).toContain("getBatchRateForCustomer(batchId, customerId, { unit })");
    expect(engine).toContain("chargeableWeight(pkg, divisor)");
    expect(engine, "the divisor comes from settings, not a literal").toContain("getVolumetricDivisor()");
  });

  it("asks the policy before touching money", () => {
    expect(engine).toContain("batchChargesOnPricing(batch)");
  });
});

describe("every door that can make a parcel chargeable rings the bell", () => {
  it.each([
    ["batch price edit", "routers/batches.router.ts", "update: staffProcedure", "priceHistory: staffProcedure"],
    ["manual assign", "routers/packages.router.ts", "assignToBatch: staffProcedure", "updateStatus: staffProcedure"],
    ["quick register", "routers/packages.router.ts", "register: staffProcedure", "estimateCost: staffProcedure"],
    ["claim", "routers/packages.router.ts", "claimPackage: staffProcedure", "registrationSummary: staffProcedure"],
    ["scan register", "routers/scanning.router.ts", "notifyStageInApp(pkg.id, 'registered')", "// Get my recent scans"],
    ["inline assign", "routers/scanning.router.ts", "updatePackageInline: staffProcedure", "// If status changed"],
  ])("%s calls chargeBatchShippingIfDue", (_name, file, start, end) => {
    const body = slice(read(file), start, end, _name);
    expect(body).toContain("chargeBatchShippingIfDue(");
  });

  it("the delivered flow still guards with the same flag, so the two writers can never overlap", () => {
    const delivered = read("routers/batches.router.ts");
    expect(delivered).toContain("!pkg.isCharged");
  });
});
