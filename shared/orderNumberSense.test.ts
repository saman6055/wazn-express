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
