import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { oddRate } from "./rateSense";

/*
 * Foreseen, 2026-10-04: one slipped digit in the dollar rate turns every dinar
 * at the till into the wrong dollars on the customer's account. Asked, never
 * refused — the rate does move.
 */
describe("a dollar rate that is not logical", () => {
  it("a zero too many or too few", () => {
    expect(oddRate(15600, 1560)).toContain("15,600");
    expect(oddRate(156, 1560)).toContain("156");
  });

  it("far from the last rate used", () => {
    expect(oddRate(1760, 1540)).toContain("1,540");
  });

  it("an ordinary day's rate asks nothing", () => {
    expect(oddRate(1560, 1540)).toBeNull();
    expect(oddRate(1560, null)).toBeNull();
    expect(oddRate(0, 1540)).toBeNull();
  });

  it("all three places that take a rate ask before using it", () => {
    for (const f of ["QuickSettleDialog.tsx", "BoxSettlementPanel.tsx", "ReceiptDinarDialog.tsx"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "..", "client/src/components/delivery", f), "utf8");
      expect(src, f).toContain("oddRateQuestion(why)");
    }
  });
});
