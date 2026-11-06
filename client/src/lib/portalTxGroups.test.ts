import { describe, it, expect } from "vitest";
import { groupTransactionsByBox } from "./portalTxGroups";
describe("groupTransactionsByBox", () => {
  const rows = [
    { id: 1, transactionType: "CREDIT_PAYMENT", description: "Payment", amountUsd: "50" },
    { id: 2, transactionType: "DEBIT_PACKAGE", description: "BOX-20261006-015 — JT1", amountUsd: "2.63" },
    { id: 3, transactionType: "DEBIT_PACKAGE", description: "BOX-20261006-015 — JT2", amountUsd: "4.73" },
    { id: 4, transactionType: "DEBIT_PACKAGE", description: "Package ABC", amountUsd: "9" },
    { id: 5, transactionType: "DEBIT_PACKAGE", description: "BOX-20261006-015 — JT3", amountUsd: "2.10" },
    { id: 6, transactionType: "DEBIT_PACKAGE", description: "BOX-20261101-002 — JT9", amountUsd: "3" },
  ];
  it("one entry per box, with its total, in first-seen order", () => {
    const g = groupTransactionsByBox(rows);
    expect(g.map((e) => (e.kind === "box" ? e.boxCode : e.tx.id))).toEqual([1, "BOX-20261006-015", 4, 6]);
    const box = g[1] as any;
    expect(box.rows.map((r: any) => r.id)).toEqual([2, 3, 5]);
    expect(box.totalUsd).toBe(9.46);
  });
  it("leaves payments and reversals alone", () => {
    const g = groupTransactionsByBox([{ id: 7, transactionType: "ADJUSTMENT_CREDIT", description: "BOX-1 — x [REV:1]", amountUsd: 1 }]);
    expect(g[0].kind).toBe("tx");
  });
});
