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
  it("the finance profile shows taken / gone to boxes / left", async () => {
    const { explainDebt } = await import("./boxPaidStillOwed");
    const base = { receiptedBoxCodes: new Set<string>(), receiptedPackageIds: new Set<number>(), receiptedOrderIds: new Set<number>(), receiptedTrackings: new Set<string>(), orders: [], isOrderText: () => false };
    const rows = [{ id: 1, transactionNumber: "T1", transactionType: "CREDIT_PAYMENT", amountUsd: 300, balanceAfterUsd: -300, description: "پێشەکی", referenceId: null, createdAt: "2026-10-20T10:00:00.000Z" }];
    const before = explainDebt(rows as never, base as never);
    expect([before.advanceInUsd, before.advanceUsedUsd, before.advanceUsd]).toEqual([300, 0, 300]);
    const after = explainDebt(rows as never, { ...base, accountCovered: [{ at: "2026-10-24T10:00:00.000Z", usd: 183.59 }] } as never);
    expect([after.advanceInUsd, after.advanceUsedUsd, after.advanceUsd]).toEqual([300, 183.59, 116.41]);
    expect(readFileSync("client/src/components/customers/CustomerDebtExplained.tsx", "utf8")).toContain('data-testid="advance-card"');
  });

  it("both tills and the print window show it", () => {
    expect(readFileSync("client/src/components/delivery/ReceiptDinarDialog.tsx", "utf8")).toContain("<AdvanceSplitNote openUsd={boxView.data?.openChargesUsd} balanceUsd={boxView.data?.accountBalanceUsd} coveredUsd={accountAdvanceUsd} earlierUsd={boxView.data?.advanceForEarlierBoxesUsd} />");
    for (const f of ["client/src/components/delivery/BoxSettlementPanel.tsx", "client/src/components/delivery/QuickSettleDialog.tsx"]) {
      expect(readFileSync(f, "utf8")).toContain("<AdvanceSplitNote openUsd={data?.openChargesUsd} balanceUsd={data?.accountBalanceUsd} coveredUsd={cover.coveredUsd} earlierUsd={data?.advanceForEarlierBoxesUsd} />");
    }
  });
  it("one advance is spent once: older unpaid boxes take it first (AZ018, 2026-10-24)", () => {
    const src = readFileSync("server/db/boxSettlement.db.ts", "utf8");
    expect(src).toContain("sql`${deliveryBoxes.id} < ${boxId}`");
    expect(src).toContain("const taken = round2(Math.min(advance, earlierDue));");
    expect(src).toContain("return { openChargesUsd: round2(open - taken), advanceForEarlierBoxesUsd: taken, earlierUnwrittenUsd: unwritten.totalUsd };");
  });
});
