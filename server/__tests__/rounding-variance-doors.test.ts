import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * The dinar rounding is forgiven in one shared rule (differenceOf + its
 * tolerance). Both doors — the till and the screen that previews it — must
 * pass the tolerance, or the screen would say "rounding" and the till would
 * post a debt, or the other way round.
 */
describe("rounding variance is applied at both doors", () => {
  it("the till derives the tolerance from the rate and passes it in", () => {
    const src = read("server/db/boxSettlement.db.ts");
    expect(src).toContain("roundingToleranceUsd(rate)");
    expect(src).toMatch(/differenceOf\(cashDueUsd, handedOverUsd, input\.treatShortAs \?\? "debt", tolerance\)/);
    // The reason written is the shared constant, never a typed string.
    expect(src).toContain("ROUNDING_VARIANCE_REASON");
    expect(src).not.toContain('differenceReason: input.differenceReason ?? null');
  });

  it("the quick-settle screen applies the same tolerance", () => {
    const src = read("client/src/components/delivery/QuickSettleDialog.tsx");
    expect(src).toContain("roundingToleranceUsd(rateNum)");
    expect(src).toMatch(/differenceOf\(cashDue, paid, treatShortAs, tolerance\)/);
    expect(src).toContain('data-testid="quick-rounding"');
  });
});

/**
 * One thing is never receipted twice (owner, 2026-10-01): the till and both
 * screens that preview it ask only for what the account still owes.
 */
describe("the account covers what it already settled, at every door", () => {
  it("the till measures the box against the account before taking money", () => {
    const src = read("server/db/boxSettlement.db.ts");
    expect(src).toContain("balanceUsd: view.accountBalanceUsd");
    expect(src).toContain("toChargeUsd: unbilledOnReceiptUsd(parcels, intents)");
    expect(src).toContain("unbackedUsd: unbackedOnReceiptUsd(parcels, totals.lines)");
    expect(src).toContain("dueUsd: cashDueUsd.toFixed(2)");
    // The payment recorded is what was handed over against the cash due,
    // never the box's own due.
    expect(src).not.toMatch(/differenceOf\(totals\.dueUsd/);
  });

  it.each([
    "client/src/components/delivery/QuickSettleDialog.tsx",
    "client/src/components/delivery/BoxSettlementPanel.tsx",
  ])("%s asks for the cash due and says what was covered", (file) => {
    const src = read(file);
    expect(src).toContain("balanceUsd: data?.accountBalanceUsd ?? 0");
    expect(src).toContain("cover.coveredUsd > 0");
    expect(src).toContain("unbackedUsd: unbackedOnReceiptUsd(parcels, totals.lines)");
    const afterCover = src.slice(src.indexOf("const cashDue = cover.cashDueUsd;"));
    expect(afterCover.length).toBeGreaterThan(1000);
    expect(afterCover, "nothing after the cover may ask for the box's own due").not.toContain("totals.dueUsd");
  });
});
