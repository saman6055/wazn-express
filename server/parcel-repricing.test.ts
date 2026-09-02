import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A weight corrected, and $0.00 still sitting there afterwards.
 *
 * That is what was reported, and the cause was plain once looked at: the edit
 * procedure wrote the weight and never asked what the weight was for. It
 * touched `calculatedCostUsd` nowhere. So a parcel registered before it was
 * weighed — or registered unclaimed, or registered with a typo somebody later
 * fixed — kept its zero for ever, through the batch, into a delivery box, and
 * onto the receipt.
 *
 * Underneath that was a second thing. The same multiplication existed in four
 * places, each consulting a different rate:
 *
 *   registration      the general route rule, only
 *   approving a claim the shipment's rate, only
 *   delivery          the shipment's rate, then the route rule
 *   editing           nothing
 *
 * so a parcel's stored price depended on which screen had last touched it.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const router = read("server/routers/packages.router.ts");
const service = read("server/services/parcelPricing.service.ts");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: start marker not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: end marker not found after start`).toBeGreaterThan(a);
  const body = src.slice(a, b);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const update = slice(router, "    update: staffProcedure", "    delete: adminProcedure", "packages.update");

describe("correcting a parcel works its price out again", () => {
  it("the edit procedure asks what the parcel now costs", () => {
    // The whole bug in one assertion: this call did not exist.
    expect(update).toContain("resolveParcelCost({");
  });

  it("feeds the resolver the corrected figures, not the ones on file", () => {
    // Reading the stored row and pricing that would recompute the same zero.
    expect(update).toContain("const merged = { ...pkg, ...updateData };");
    for (const f of ["weightKg", "lengthCm", "widthCm", "heightCm", "volumeCbm", "batchId", "customerId"]) {
      expect(update, `${f} must come from the merged view`).toContain(`${f}: merged.${f}`);
    }
  });

  it("only when a fact behind the price actually moved", () => {
    // Fixing a description must not silently reprice a parcel.
    expect(update).toContain("if (affectsCost(data as Record<string, unknown>))");
  });

  it("never after the customer has been charged", () => {
    // That figure is on an invoice in somebody's hands. It gets corrected
    // deliberately, not as a side effect of an edit.
    expect(update).toContain("!pkg.isCharged");
  });

  it("never writes zero over a price that already exists", () => {
    // A rate that has gone missing means "not known". Blanking a good figure
    // is worse than leaving it.
    expect(update).toContain("if (priced.costUsd) {");
    const write = slice(update, "if (priced.costUsd) {", "appLogger.info", "cost write");
    expect(write).toContain("updateData.calculatedCostUsd = priced.costUsd;");
  });

  it("leaves it alone for an unclaimed parcel, which has nobody to bill", () => {
    expect(update).toContain("!pkg.isUnclaimed");
  });

  it("records the change, because it is money moving on its own", () => {
    expect(update).toContain("Parcel repriced on edit");
  });
});

describe("one answer, wherever the question is asked", () => {
  it("registration uses the same resolver as the edit", () => {
    const create = slice(router, "The price, from the same resolver", "// Generate package code", "create pricing");
    expect(create).toContain("await resolveParcelCost({");
    expect(create).toContain("originWarehouseId: input.originWarehouseId");
    expect(create).toContain("const calculatedCostUsd = priced.costUsd;");
  });

  it("approving a claim uses it too", () => {
    const claim = slice(router, "const result = await db.approveClaimRequest", "await db.createAuditLog", "claim approval");
    expect(claim).toContain("resolveParcelCost({");
    expect(claim, "the hand-rolled copy must be gone").not.toContain("const volumetricKg = (lengthCm * widthCm * heightCm) / 6000");
  });

  it("registration no longer carries its own copy of the arithmetic", () => {
    const create = slice(router, "The price, from the same resolver", "// Generate package code", "create block");
    expect(create, "the route rule must not be multiplied here by hand")
      .not.toContain("pricingRule.pricePerUnit");
    expect(create, "nor the chargeable weight worked out a second time")
      .not.toContain("breakdown.chargeableKg");
  });
});

describe("the resolver answers in the order the invoice will", () => {
  it("asks the shipment's rate for this customer first", () => {
    const first = service.indexOf("getBatchRateForCustomer");
    const second = service.indexOf("getApplicablePricingRule");
    expect(first, "the batch rate must be consulted").toBeGreaterThan(-1);
    expect(second, "the route rule must remain as a fallback").toBeGreaterThan(-1);
    expect(first, "the route rule must not win over an agreed rate").toBeLessThan(second);
  });

  it("prices by the unit the shipment sells in, not the parcel's own type", () => {
    // A carton in a sea batch is sold by volume however it was registered.
    expect(service).toContain("const batchUnit = billingUnit(batch.shippingType);");
  });

  it("respects the unit the route rule states", () => {
    // A rule priced per kg multiplied by a volume is a number from nowhere.
    expect(service).toContain('const ruleUnit = rule.unit === "cbm" ? "cbm" : "kg";');
  });

  it("reads the install's divisor rather than assuming 6000", () => {
    expect(service).toContain('db.getSetting("cbm_divisor")');
  });

  it("does the multiplying in the shared rule, not for itself", () => {
    expect(service).toContain('from "@shared/parcelCost"');
    expect(service, "no second opinion about the arithmetic")
      .not.toMatch(/Math\.max\([^)]*volumetric/i);
  });

  it("says nothing rather than guessing when no rate is known", () => {
    expect(service).toContain('return answer(0, "none");');
  });
});
