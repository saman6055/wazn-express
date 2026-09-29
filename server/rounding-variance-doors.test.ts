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
    expect(src).toMatch(/differenceOf\(totals\.dueUsd, handedOverUsd, input\.treatShortAs \?\? "debt", tolerance\)/);
    // The reason written is the shared constant, never a typed string.
    expect(src).toContain("ROUNDING_VARIANCE_REASON");
    expect(src).not.toContain('differenceReason: input.differenceReason ?? null');
  });

  it("the quick-settle screen applies the same tolerance", () => {
    const src = read("client/src/components/delivery/QuickSettleDialog.tsx");
    expect(src).toContain("roundingToleranceUsd(rateNum)");
    expect(src).toMatch(/differenceOf\(totals\.dueUsd, paid, treatShortAs, tolerance\)/);
    expect(src).toContain('data-testid="quick-rounding"');
  });
});
