import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { accountCover } from "./boxSettlement";

/**
 * An advance goes to the goods that arrive (owner, 2026-10-19): "whatever
 * arrives must come off the credit; what is left becomes a debt on him,
 * paid when the box arrives." AZ018: $1,633.99 advance, three sea cartons
 * in a $2,203.31 box, $1,403.20 of goods still at sea.
 *
 * What would undo it: the till, the payment screens or the printed receipt
 * reading the account as one pool again, or any of them making a credit.
 */
const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the advance pays the box first", () => {
  const az018 = { dueUsd: 2203.31, balanceUsd: 1594.52, toChargeUsd: 378 };

  it("the whole advance comes off this box; what is left is owed for the goods at sea", () => {
    expect(accountCover({ ...az018, openUsd: 3228.51 })).toEqual({ cashDueUsd: 569.32, coveredUsd: 1633.99 });
  });

  it("read as one pool, the advance went to the goods at sea first", () => {
    expect(accountCover(az018)).toEqual({ cashDueUsd: 1972.52, coveredUsd: 230.79 });
  });

  it("with nothing else open the two rules agree", () => {
    const box = { dueUsd: 500, balanceUsd: 200, toChargeUsd: 0 };
    expect(accountCover({ ...box, openUsd: 500 })).toEqual(accountCover(box));
  });

  it("an advance bigger than the box: nothing asked, and no credit is made", () => {
    expect(accountCover({ dueUsd: 300, balanceUsd: -200, openUsd: 300 })).toEqual({ cashDueUsd: 0, coveredUsd: 300 });
  });

  it("an old debt outside any box is asked for before an advance is spent", () => {
    // $50 owed from before, $300 of goods in the box, $100 advance: the advance meets the old debt first.
    expect(accountCover({ dueUsd: 300, balanceUsd: 250, openUsd: 300 })).toEqual({ cashDueUsd: 250, coveredUsd: 50 });
  });
});

describe("one rule in every place money is asked for", () => {
  it("the till, the box's payment panel and the quick payment pass the open charges", () => {
    expect(root("server/db/boxSettlement.db.ts")).toContain("openUsd: view.openChargesUsd ?? undefined,");
    for (const f of ["client/src/components/delivery/BoxSettlementPanel.tsx", "client/src/components/delivery/QuickSettleDialog.tsx"]) {
      expect(root(f), f).toContain("openUsd: data?.openChargesUsd ?? undefined,");
    }
  });

  it("the printed receipt takes the same advance off, filled in by itself", () => {
    const dialog = root("client/src/components/delivery/ReceiptDinarDialog.tsx");
    expect(dialog).toContain("openUsd: v.openChargesUsd,");
    expect(dialog).toContain("setAdvance(accountAdvanceUsd.toFixed(2));");
    expect(dialog).toContain('data-testid="receipt-account-advance"');
    for (const f of ["client/src/components/delivery/BoxDetailPanel.tsx", "client/src/components/delivery/BoxTable.tsx"]) {
      expect(root(f), f).toContain("boxId: box.id,");
    }
  });

  it("the open charges are the debt rule's own owed charges", () => {
    const db = root("server/db/boxPaidStillOwed.db.ts");
    const fn = db.slice(db.indexOf("export async function openChargesUsd"));
    expect(fn).toContain("explainDebt(got.rows, got.facts).owedUsd");
  });
});
