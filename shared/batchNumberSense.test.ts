import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  oddBatchNumbers, newlyOdd, usualRates, medianOf, oddNumberQuestion, isOddNumberQuestion,
  oddNumberText, FALLBACK_USUAL, ODD_NUMBER_MARK,
} from "./batchNumberSense";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * Owner, 2026-10-04: "next time a number that is not logical is typed, warn
 * and say confirm it again." Every case below is a real batch from the
 * 2026-10-03 sweep of the live data.
 */
const usual = { costPerKg: 9, pricePerKg: 11, costPerCbm: 260, pricePerCbm: 300 };

describe("numbers that are not logical are found", () => {
  it("SEA-125: 215 CBM paid for, 1.63 CBM in the batch", () => {
    const odd = oddBatchNumbers(
      { shippingType: "sea", chargedCbm: "215", costPerCbm: "215", shippingCost: "353", pricePerCbm: "300" },
      usual,
      { count: 1, weightKg: 0, cbm: 1.63 },
    );
    expect(odd.map((o) => o.key)).toContain("chargedCbm:above");
    expect(odd.find((o) => o.key === "chargedCbm:above")?.line).toContain("215");
    expect(odd.find((o) => o.key === "chargedCbm:above")?.line).toContain("1.63");
    // 215 × 215 = $46,225 against the $353 typed as the total.
    expect(odd.map((o) => o.key)).toContain("rateTimesBase:total");
  });

  it("AIR-2026-064: $299.20 typed into cost per kilo", () => {
    const odd = oddBatchNumbers({ shippingType: "air_regular", costPerKg: "299.20", pricePerKg: "11" }, usual, null);
    expect(odd.map((o) => o.key)).toEqual(["costPerKg:high"]);
    expect(odd[0].line).toContain("کۆی کرێی گەیاندن");
  });

  it("SEA-2026-010: $15.40 per CBM — a per-kilo price in the CBM box", () => {
    const odd = oddBatchNumbers({ shippingType: "sea", costPerCbm: "15.4" }, usual, null);
    expect(odd.map((o) => o.key)).toEqual(["costPerCbm:low"]);
    expect(odd[0].line).toContain("نرخی کیلۆ");
  });

  it("AIR-2026-036: 220 kg charged, 24.2 kg of parcels", () => {
    const odd = oddBatchNumbers({ shippingType: "air_regular", chargedWeightKg: "220" }, usual, { count: 22, weightKg: 24.19, cbm: 0 });
    expect(odd.map((o) => o.key)).toEqual(["chargedWeightKg:above"]);
  });

  it("AIR-2026-023: rate × weight $295, total typed $1,180", () => {
    const odd = oddBatchNumbers({ shippingType: "air_regular", costPerKg: "15.5", chargedWeightKg: "19", shippingCost: "1180" }, usual, null);
    expect(odd.map((o) => o.key)).toEqual(["rateTimesBase:total"]);
  });
});

describe("ordinary numbers are left alone", () => {
  it("a normal air batch asks nothing", () => {
    expect(oddBatchNumbers(
      { shippingType: "air_regular", costPerKg: "8.5", pricePerKg: "11", chargedWeightKg: "130", shippingCost: "1105" },
      usual,
      { count: 120, weightKg: 126, cbm: 0 },
    )).toEqual([]);
  });

  it("a normal sea batch asks nothing", () => {
    expect(oddBatchNumbers(
      { shippingType: "sea", costPerCbm: "250", pricePerCbm: "300", chargedCbm: "1.7" },
      usual,
      { count: 30, weightKg: 0, cbm: 1.63 },
    )).toEqual([]);
  });

  it("the carrier billing less than our parcels is normal, not asked (owner, 2026-10-04)", () => {
    // AIR-2026-016: billed 1.18 kg, our parcels 1.94 kg — it charged the
    // weight, we charged the volume.
    expect(oddBatchNumbers({ shippingType: "air_regular", chargedWeightKg: "1.18" }, usual, { count: 11, weightKg: 1.94, cbm: 0 })).toEqual([]);
    expect(oddBatchNumbers({ shippingType: "air_regular", chargedWeightKg: "35" }, usual, { count: 45, weightKg: 48.28, cbm: 0 })).toEqual([]);
  });

  it("a blank is not known yet, never zero", () => {
    expect(oddBatchNumbers({ shippingType: "sea", costPerCbm: "", chargedCbm: null }, usual, { count: 1, weightKg: 0, cbm: 1 })).toEqual([]);
  });

  it("a small batch is not judged on a few kilos", () => {
    // 4 kg charged for 1.4 kg: the carrier's minimum, not a typo (under the 5 kg slack).
    expect(oddBatchNumbers({ shippingType: "air_regular", chargedWeightKg: "4" }, usual, { count: 2, weightKg: 1.4, cbm: 0 })).toEqual([]);
  });
});

describe("only what this save made odd is asked", () => {
  it("an oddness already on the stored batch is not asked again", () => {
    const before = oddBatchNumbers({ shippingType: "air_regular", costPerKg: "30" }, usual, null);
    const after = oddBatchNumbers({ shippingType: "air_regular", costPerKg: "30", chargedWeightKg: "50" }, usual, null);
    expect(newlyOdd(after, before)).toEqual([]);
  });

  it("a new batch is asked about everything", () => {
    const odd = oddBatchNumbers({ shippingType: "air_regular", costPerKg: "30" }, usual, null);
    expect(newlyOdd(odd, null)).toEqual(odd);
  });
});

describe("what is usual comes from the company's own batches", () => {
  it("the median of past batches, once there are enough", () => {
    const past = [7, 8, 9, 10, 11].map((c) => ({ shippingType: "air_regular", costPerKg: String(c) }));
    expect(usualRates(past).costPerKg).toBe(9);
  });

  it("too few past batches fall back to the stand-in", () => {
    expect(medianOf([1, 2])).toBeNull();
    expect(usualRates([]).costPerCbm).toBe(FALLBACK_USUAL.costPerCbm);
  });
});

describe("the question", () => {
  it("is marked, says why, and asks to confirm again", () => {
    const q = oddNumberQuestion([{ key: "x", line: "قەبارەی حسابکراو 215 CBMە" }]);
    expect(isOddNumberQuestion(q)).toBe(true);
    expect(q.startsWith(ODD_NUMBER_MARK)).toBe(true);
    expect(oddNumberText(q)).toContain("لۆجیکی نین");
    expect(oddNumberText(q)).toContain("دووبارە دڵنیا بەرەوە");
    expect(isOddNumberQuestion("something else")).toBe(false);
  });
});

describe("both batch doors ask it, and the form answers it", () => {
  const router = read("server/routers/batches.router.ts");
  const page = read("client/src/pages/Batches.tsx");

  it("create and update ask before saving", () => {
    expect(router.match(/await guardOddNumbers\(/g)?.length).toBe(2);
    expect(router.match(/approveOddNumbers: z\.boolean\(\)\.optional\(\)/g)?.length).toBe(2);
    // Asked before the cost question, so the typo is caught first.
    const create = router.slice(router.indexOf("    create: staffProcedure"));
    expect(create.indexOf("await guardOddNumbers(")).toBeLessThan(create.indexOf("await guardBatchCost("));
  });

  it("the form turns the question into a confirm and sends the yes", () => {
    expect(page).toContain("isOddNumberQuestion(err.message)");
    expect(page).toContain("approveOddNumbers: true");
    expect(page.match(/saveAnswering\((create|update)Mutation\.mutate, /g)?.length).toBe(2);
  });
});
