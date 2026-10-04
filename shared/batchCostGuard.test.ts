import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  batchCostBreaches,
  mayApproveCostBreach,
  costBreachRefusal,
  costBreachQuestion,
} from "./batchCostGuard";

/**
 * Owner, 2026-09-29: a batch whose cost is not below its selling price does
 * not save — staff are refused, an admin is asked and may save it anyway.
 * The case that started it: $299.20 typed as cost per kg on an $11 batch.
 */
describe("which batches the cost guard stops", () => {
  it("stops the $299.20-per-kilo slip", () => {
    const b = batchCostBreaches({ shippingType: "air_regular", costPerKg: "299.20", pricePerKg: "11" });
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ customerId: null, costUsd: 299.2, priceUsd: 11, unit: "kg" });
  });

  it("stops cost equal to price — no profit is still a breach", () => {
    expect(batchCostBreaches({ shippingType: "air_regular", costPerKg: 11, pricePerKg: 11 })).toHaveLength(1);
  });

  it("lets an ordinary batch through", () => {
    expect(batchCostBreaches({ shippingType: "air_regular", costPerKg: "7", pricePerKg: "11" })).toEqual([]);
  });

  it("reads sea batches by CBM, not kg", () => {
    expect(batchCostBreaches({ shippingType: "sea", costPerKg: 50, pricePerKg: 1, costPerCbm: 180, pricePerCbm: 250 })).toEqual([]);
    expect(batchCostBreaches({ shippingType: "sea", costPerCbm: 260, pricePerCbm: 250 })[0].unit).toBe("cbm");
  });

  it("treats a blank cost or price as not known yet, never as zero", () => {
    expect(batchCostBreaches({ shippingType: "air_regular", costPerKg: "", pricePerKg: "11" })).toEqual([]);
    expect(batchCostBreaches({ shippingType: "air_regular", costPerKg: "7", pricePerKg: null })).toEqual([]);
    expect(batchCostBreaches({ shippingType: "air_regular", costPerKg: "7" })).toEqual([]);
  });

  it("also stops a customer's own price that the cost does not stay below", () => {
    const b = batchCostBreaches({
      shippingType: "air_regular", costPerKg: "7", pricePerKg: "11",
      customerPricing: [
        { customerId: 5, customerCode: "AZ005", pricePerKg: "6.5" },
        { customerId: 6, pricePerKg: "9" },
      ],
    });
    expect(b.map((x) => x.customerId)).toEqual([5]);
  });

  it("lets only an admin approve", () => {
    expect(mayApproveCostBreach("admin")).toBe(true);
    expect(mayApproveCostBreach("super_admin")).toBe(true);
    for (const role of ["staff", "accountant", "auditor", null, undefined]) {
      expect(mayApproveCostBreach(role)).toBe(false);
    }
  });
});

describe("what the guard says", () => {
  it("tells staff the cause and the cure, and spots a total typed per kilo", () => {
    const msg = costBreachRefusal(batchCostBreaches({ shippingType: "air_regular", costPerKg: "299.20", pricePerKg: "11" }));
    expect(msg).toContain("$299.20");
    expect(msg).toContain("$11.00");
    expect(msg).toContain("کۆی کرێی گەیاندن");
    expect(msg).toContain("بەڕێوەبەر");
  });

  it("does not suggest a total when the cost is only a little high", () => {
    const msg = costBreachRefusal(batchCostBreaches({ shippingType: "air_regular", costPerKg: "12", pricePerKg: "11" }));
    expect(msg).not.toContain("کۆی کرێی گەیاندن");
  });

  it("shows the admin the loss per unit before asking", () => {
    const q = costBreachQuestion(batchCostBreaches({ shippingType: "air_regular", costPerKg: "12", pricePerKg: "11" }));
    expect(q).toContain("$1.00");
    expect(q).toContain("دڵنیایت");
  });
});

describe("both doors ask the same question", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

  it("the server guards create and update, and logs an admin's yes", () => {
    const src = read("server/routers/batches.router.ts");
    expect(src.match(/await guardBatchCost\(/g)?.length, "create and update both guarded").toBe(2);
    expect(src.match(/approveCostBreach: z\.boolean\(\)\.optional\(\)/g)?.length).toBe(2);
    expect(src.match(/action: "approve_batch_cost_breach"/g)?.length).toBe(2);
  });

  it("the batch form turns the admin question into a confirm and resends approved", () => {
    const src = read("client/src/pages/Batches.tsx");
    expect(src).toContain('err.data?.code === "PRECONDITION_FAILED" && mayApproveCostBreach(userRole) && !isOddNumberQuestion(err.message)');
    // One save path for both doors answers the cost question (and the
    // "not logical" one before it — shared/batchNumberSense).
    expect(src).toContain("saveAnswering(send, { ...payload, approveCostBreach: true }, onSuccess)");
    expect(src.match(/saveAnswering\((create|update)Mutation\.mutate, /g)?.length).toBe(2);
  });
});
