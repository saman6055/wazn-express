/** The sales breakdown opens the rows behind each figure; the ledger says how to read a row (owner, points 3 and 4). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { chargeKindOfRow, chargeKindOfType } from "../../../shared/accountStatement";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("statement pick", () => {
  it("knows each charge type's kind, the same table the statement adds up by", () => {
    expect(chargeKindOfType("DEBIT_PACKAGE")).toBe("package");
    expect(chargeKindOfType("debit_commission")).toBe("commission");
    expect(chargeKindOfType("DEBIT_PENALTY")).toBe("service");
    expect(chargeKindOfType("CREDIT_PAYMENT")).toBeNull();
  });
  it("a correction counts under the kind it corrects; a hand adjustment under none", () => {
    expect(chargeKindOfRow({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "commission" })).toBe("commission");
    expect(chargeKindOfRow({ transactionType: "ADJUSTMENT_DEBIT", referenceType: "package" })).toBe("package");
    expect(chargeKindOfRow({ transactionType: "ADJUSTMENT_CREDIT", referenceType: null })).toBeNull();
    expect(chargeKindOfRow({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "manual" })).toBeNull();
  });
  it("a pick filters the ledger and brings it into view", () => {
    const page = read("client/src/pages/finance/CustomerFinance.tsx");
    expect(page).toContain("if (typeFilter.startsWith('kind:')) return kindOf === typeFilter.slice(5);");
    expect(page).toContain('setLedgerTab("transactions");');
    expect(page).toContain('data-testid="ledger-legend"');
    expect(read("client/src/components/finance/AccountStatementSummary.tsx")).toContain("onPick?.({ kind })");
  });
});
