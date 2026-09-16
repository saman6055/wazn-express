import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The payment screen reads a box's charges from its own customer's account
 * (box-money defect 3; owner's ledger audit, 2026-09-16).
 *
 * Commission freight is recorded as a package charge under the ORDER's id.
 * Reading the ledger by reference alone, a box whose parcel id happened to
 * equal someone else's order id showed that customer's freight as its own
 * parcel's charge — "charged", so never billed to its real owner, and
 * "settled" by a payment of the wrong amount. Reproduced on a scratch MySQL:
 * BOX-SIM-I showed $7.50 (another customer's freight) for its own $12
 * parcel; after this it shows $12 not yet charged, and settling it bills its
 * own customer $12 while the other account keeps its $7.50. No other box's
 * figures changed.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("a box reads only its own customer's account", () => {
  const sums = slice(
    read("server/db/boxSettlement.db.ts"),
    "async function parcelsForItems",
    "export async function getBoxesPaidInFull",
  );

  it("finds the account of each item's box", () => {
    expect(sums).toContain("innerJoin(customerAccounts, eq(customerAccounts.customerId, deliveryBoxes.customerId))");
    expect(sums).toContain("const accountOfBox = new Map(");
  });

  it("asks the ledger for those accounts only", () => {
    expect(sums).toContain("inArray(ledgerTransactions.accountId, accountIds)");
  });

  it("keys every sum by the account as well as the reference", () => {
    expect(sums).toContain("const id = `${row.accountId}|${row.referenceType}:${row.referenceId}`;");
    expect(sums).toContain("`${account}|package:${packageId}`");
    expect(sums).not.toMatch(/const id = `\$\{row\.referenceType\}/);
  });
});
