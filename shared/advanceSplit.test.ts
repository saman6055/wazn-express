import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { advanceSplit } from "./boxSettlement";

describe("the advance at the till (AZ234, owner 2026-10-24)", () => {
  it("$300 ahead, a $183.59 box: $183.59 goes to it, $116.41 is left", () => {
    // Sinan: goods owed $321.49, balance $21.49 → $300 advance.
    expect(advanceSplit({ openUsd: 321.49, balanceUsd: 21.49, coveredUsd: 183.59 })).toEqual({ advanceUsd: 300, usedUsd: 183.59, leftUsd: 116.41 });
  });
  it("a box bigger than the advance takes all of it", () => {
    expect(advanceSplit({ openUsd: 500, balanceUsd: 200, coveredUsd: 300 })).toEqual({ advanceUsd: 300, usedUsd: 300, leftUsd: 0 });
  });
  it("no advance, nothing shown", () => {
    expect(advanceSplit({ openUsd: 100, balanceUsd: 100, coveredUsd: 0 })).toBeNull();
    expect(advanceSplit({ openUsd: undefined, balanceUsd: -50, coveredUsd: 0 })).toBeNull();
  });
  it("both tills show it", () => {
    for (const f of ["client/src/components/delivery/BoxSettlementPanel.tsx", "client/src/components/delivery/QuickSettleDialog.tsx"]) {
      expect(readFileSync(f, "utf8")).toContain("<AdvanceSplitNote openUsd={data?.openChargesUsd} balanceUsd={data?.accountBalanceUsd} coveredUsd={cover.coveredUsd} />");
    }
  });
});
