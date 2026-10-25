import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { billLooksPartial, carrierPartsVerdict, profitWaitsForParts, sumCarrierParts } from "./carrierParts";

/**
 * The owner's rule, 2026-10-25, in his own examples: a carrier bill far under
 * our weight is part of the batch only - under 90% of it, or 15 kg or more
 * short ("a carton is 20 kg"). Small gaps are ordinary. An admin may say why
 * and the batch stops waiting.
 */

describe("when a carrier bill is only part of the batch", () => {
  it("AIR-2026-069GZ: 233.35 kg ours, 74 kg billed - partial", () => {
    expect(billLooksPartial(233.35, 74)).toBe(true);
  });

  it("233 ours, 225 billed - 8 kg and 96%: ordinary", () => {
    expect(billLooksPartial(233, 225)).toBe(false);
  });

  it("120 ours, 105 billed - 15 kg short: partial though it is 87.5%", () => {
    expect(billLooksPartial(120, 105)).toBe(true);
  });

  it("60 ours, 50 billed - 83%: partial though only 10 kg", () => {
    expect(billLooksPartial(60, 50)).toBe(true);
  });

  it("the carrier billing more than ours is never 'partial'", () => {
    expect(billLooksPartial(100, 130)).toBe(false);
  });

  it("no bill or no weight: nothing to judge", () => {
    expect(carrierPartsVerdict({ shippingType: "air_regular", oursKg: 233, carrierKg: 0, accepted: false })).toBe("none");
    expect(carrierPartsVerdict({ shippingType: "air_regular", oursKg: 0, carrierKg: 74, accepted: false })).toBe("none");
  });

  it("sea batches are reckoned as before", () => {
    expect(carrierPartsVerdict({ shippingType: "sea", oursKg: 233, carrierKg: 74, accepted: false })).toBe("none");
  });

  it("profit waits while partial, not once an admin said why", () => {
    const partial = carrierPartsVerdict({ shippingType: "air_regular", oursKg: 233.35, carrierKg: 74, accepted: false });
    const accepted = carrierPartsVerdict({ shippingType: "air_regular", oursKg: 233.35, carrierKg: 74, accepted: true });
    expect(partial).toBe("partial");
    expect(profitWaitsForParts(partial)).toBe(true);
    expect(accepted).toBe("accepted");
    expect(profitWaitsForParts(accepted)).toBe(false);
  });

  it("the second load closes the gap", () => {
    const sum = sumCarrierParts([{ billedKg: "74", costUsd: "518" }, { billedKg: "152", costUsd: "1064" }]);
    expect(sum).toEqual({ billedKg: "226.00", billedCbm: null, costUsd: "1582.00" });
    expect(carrierPartsVerdict({ shippingType: "air_regular", oursKg: 233.35, carrierKg: 226, accepted: false })).toBe("whole");
  });
});

describe("wired where the money is", () => {
  const root = path.resolve(__dirname, "..");
  const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

  it("the batch summary holds the profit and hides the false gain while partial", () => {
    const src = read("server/db/batches.db.ts");
    expect(src).toContain('profitWaitsForParts(partsVerdict)\n        ? ("parts" as const)');
    expect(src).toContain("carrierDifference: profitWaitsForParts(partsVerdict) ? null");
  });

  it("loads reach the batch only through updateBatch (price history kept)", () => {
    const src = read("server/db/carrierParts.db.ts");
    expect(src).toContain("await updateBatch(batchId, {");
    expect(src).toContain("shippingCost: sum.costUsd");
  });

  it("admins only, and the delivered-batch lock applies", () => {
    const src = read("server/routers/batches.router.ts");
    const block = src.slice(src.indexOf("carrierParts: router({"), src.indexOf("getFinancialSummary: staffProcedure"));
    expect(block.length).toBeGreaterThan(500);
    expect(block).not.toContain("staffProcedure");
    expect(block.match(/assertCarrierPartsEditable/g)?.length).toBe(3);
  });

  it("the edit form does not save the summed fields over the loads", () => {
    const src = read("client/src/pages/Batches.tsx");
    expect(src).toContain('editLoads.length > 0\n                                ? <Input type="number" readOnly value={editFinancialQ.data?.chargedWeight');
    expect(src).toContain("<CarrierPartsCard");
  });
});
