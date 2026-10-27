import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { oddOrderNumbers } from "./orderNumberSense";

/* Real cases from the 2026-10-03 data sweep. */
describe("order prices that are not logical", () => {
  it("a commission larger than the goods, or below zero", () => {
    expect(oddOrderNumbers({ orderType: "commission", quantity: 1, itemPriceUsd: 24.82, commissionFeeUsd: 67.18 })).toHaveLength(1);
    expect(oddOrderNumbers({ orderType: "commission", quantity: 1, itemPriceUsd: 3, commissionFeeUsd: -1.28 }).join()).toContain("سالبە");
  });

  it("a zero too many, a near-zero sale, a huge quantity", () => {
    expect(oddOrderNumbers({ orderType: "commission", quantity: 1, itemPriceUsd: 2000, commissionFeeUsd: 5 })).toHaveLength(1);
    expect(oddOrderNumbers({ orderType: "full_package", quantity: 1, purchasePriceUsd: 3.77, sellingPriceUsd: 0.01 }).join()).toContain("سفرە");
    expect(oddOrderNumbers({ orderType: "commission", quantity: 4800, itemPriceUsd: 1, commissionFeeUsd: 0.3 })).toHaveLength(1);
  });

  it("ordinary orders ask nothing", () => {
    expect(oddOrderNumbers({ orderType: "commission", quantity: 2, itemPriceUsd: 18.98, commissionFeeUsd: 3 })).toEqual([]);
    expect(oddOrderNumbers({ orderType: "full_package", quantity: 3, purchasePriceUsd: 7, sellingPriceUsd: 10 })).toEqual([]);
  });

  it("both order forms ask before saving", () => {
    for (const f of ["CommissionForm.tsx", "FullPackageForm.tsx"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "..", "client/src/pages", f), "utf8");
      expect(src, f).toContain("oddOrderQuestion(oddNumbers)");
    }
  });
});

describe("the bulk order form asks too (owner, 2026-10-27)", () => {
  it("CM-MPC9AGUF's numbers are asked about: $19 a unit on $0.51 goods", async () => {
    const { oddOrderNumbers } = await import("./orderNumberSense");
    expect(oddOrderNumbers({ orderType: "commission", quantity: 100, itemPriceUsd: 0.51, commissionFeeUsd: 19 }).length).toBe(1);
  });
  it("the bulk form runs the same question before saving", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.resolve(__dirname, "..", "client/src/pages/BulkOrderForm.tsx"), "utf8");
    expect(src).toContain('import { oddOrderNumbers, oddOrderQuestion } from "@shared/orderNumberSense";');
    expect(src).toContain("message: oddOrderQuestion(odd),");
    expect(src.indexOf("oddOrderQuestion(odd)")).toBeLessThan(src.indexOf("bulkCreateMutation.mutate({"));
  });
});
