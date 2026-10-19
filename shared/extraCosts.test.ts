import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { extraCostChargeText, extraCostProblem, extraCostProfitUsd } from "./extraCosts";

/**
 * Other costs on a box (owner, 2026-10-19): customs, an inspection, a
 * repack, a service in China, or other written out. Two figures - what the
 * company paid and what the customer is charged; sometimes the company keeps
 * it. Anybody may write one; the main admin is told.
 *
 * What would undo it: a line with no reason, the price missing from the
 * account or from the box, a receipt that leaves it owed, an undone receipt
 * that forgets it, a profit that does not see it, or a line written in
 * silence.
 */
const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("a line and its money", () => {
  it("customs passed on at cost: no profit, no loss", () => {
    expect(extraCostProfitUsd({ costUsd: 12, priceUsd: 12 })).toBe(0);
  });
  it("an inspection bought at $3 and charged $5 makes $2", () => {
    expect(extraCostProfitUsd({ costUsd: 3, priceUsd: 5 })).toBe(2);
  });
  it("a cost the company keeps comes off the profit", () => {
    expect(extraCostProfitUsd({ costUsd: 4, priceUsd: 0 })).toBe(-4);
  });
  it("'other' needs its words; nothing at all is refused", () => {
    expect(extraCostProblem({ reason: "other", note: " ", costUsd: 4, priceUsd: 0 })).toContain("تر");
    expect(extraCostProblem({ reason: "other", note: "پێچانەوە", costUsd: 4, priceUsd: 0 })).toBeNull();
    expect(extraCostProblem({ reason: "customs", costUsd: 0, priceUsd: 0 })).not.toBeNull();
    expect(extraCostProblem({ reason: "customs", costUsd: -1, priceUsd: 12 })).not.toBeNull();
  });
  it("the account line says what it was and where", () => {
    const text = extraCostChargeText("customs", null, "BOX-20261019-003");
    expect(text).toContain("گومرگ");
    expect(text).toContain("BOX-20261019-003");
  });
});

describe("one money, everywhere it is counted", () => {
  const db = root("server/db/extraCosts.db.ts");
  const till = root("server/db/boxSettlement.db.ts");

  it("the price goes on the account through the one charge door", () => {
    expect(db).toContain('"SERVICE",');
    expect(db).toContain("await applyCharge(");
  });
  it("struck before a receipt: the price comes back off by the ledger's own correction; after a receipt: refused", () => {
    const fn = db.slice(db.indexOf("export async function removeExtraCost"));
    expect(fn.indexOf("if (row.settlementId)")).toBeLessThan(fn.indexOf("await reverseCharge("));
  });
  it("the till asks for the unpaid prices with the box, and marks them paid by its receipt", () => {
    expect(till).toContain("dueUsd: round2(totals.dueUsd + extrasDueUsd),");
    expect(till).toContain("await markExtraCostsSettled(tx, unpaidExtras.map((e) => e.id), settlementId);");
  });
  it("an undone receipt leaves them owed again", () => {
    expect(till).toContain("await clearExtraCostsSettlement(tx, settlementId);");
  });
  it("a box with an unpaid price is neither paid in full nor finished", () => {
    expect(till).toContain("&& (extrasOwed.get(boxId) ?? 0) <= SETTLED_SLACK_USD;");
    expect(root("server/lib/boxLifecycle.ts")).toContain("&& Number(view.extrasDueUsd ?? 0) <= SETTLED_SLACK_USD;");
  });
  it("the one profit rule sees the difference", () => {
    expect(root("server/db/reports.db.ts")).toContain("pkgs.profit + stock.profitUsd + extra.profitUsd");
  });
  it("the debt card knows where each price's money stands", () => {
    expect(root("shared/boxPaidStillOwed.ts")).toContain("if (extra) verdict = extra;");
  });
});

describe("the screens and the paper", () => {
  it("both payment screens ask for the unpaid prices", () => {
    for (const f of ["client/src/components/delivery/BoxSettlementPanel.tsx", "client/src/components/delivery/QuickSettleDialog.tsx"]) {
      expect(root(f), f).toContain("dueUsd: totals.dueUsd + Number(data?.extrasDueUsd ?? 0),");
    }
    expect(root("client/src/components/delivery/BoxSettlementPanel.tsx")).toContain("<BoxExtraCosts boxId={boxId}");
  });
  it("every printed receipt carries them as rows and in its total", () => {
    const print = root("client/src/lib/deliveryBoxPrintUtils.ts");
    expect(print).toContain("+ receiptExtrasUsd(extraLines);");
    expect(print).toContain("${extraLines.map((line) =>");
    expect(root("client/src/components/delivery/BoxTable.tsx")).toContain("extras: receiptExtraLines(");
    // Print, PDF, WhatsApp - and the copy kept in the box's history (2026-10-19).
    expect(root("client/src/components/delivery/BoxDetailPanel.tsx").split("extras: receiptExtraLines(settlementView?.extras, lang)").length - 1).toBe(4);
    expect(root("client/src/components/delivery/ReceiptDinarDialog.tsx")).toContain("const grossUsd = Math.round(((request?.totalUsd ?? 0) + extrasUsd) * 100) / 100;");
  });
  it("the main admin is told, and can see them all", () => {
    expect(root("shared/riskBell.ts")).toContain('"extra-costs": "/finance/extra-costs",');
    expect(root("server/db/reports.db.ts")).toContain("countExtraCostsSince(24)");
    expect(root("client/src/App.tsx")).toContain('path="/finance/extra-costs"');
    expect(root("server/routers/scanning.router.ts")).toContain('action: "add_extra_cost",');
  });
});
