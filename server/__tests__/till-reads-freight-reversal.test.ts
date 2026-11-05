/**
 * The till counts the reversal of an order's freight row, which names the row
 * it undoes ([REV:<number>]) and not the order (2026-11-05, Vian: the account
 * took back $16.61, the till still asked for it).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the till and a reversed order freight", () => {
  it("follows [REV:] back to the order's freight row", () => {
    const src = read("server/db/boxSettlement.db.ts");
    expect(src).toContain("transactionNumber: ledgerTransactions.transactionNumber,");
    expect(src).toContain("const undoesOrderFreight = ");
    expect(src).toContain('!String(row.description ?? "").includes(order.orderCode) && !undoesOrderFreight(row)) continue;');
  });
});
