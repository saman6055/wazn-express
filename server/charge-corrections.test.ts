import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "db/finance.db.ts"), "utf8");
const body = (name: string) => {
  const start = src.indexOf(`export async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = src.indexOf("\nexport async function ", start + 10);
  return src.slice(start, end === -1 ? undefined : end);
};

/**
 * A correction is measured from what the charge stands at now, never from
 * its first amount (2026-10-02). Measured from the first amount, $100 → $80
 * → $90 left the charge at $70, and an order corrected down and then
 * cancelled left a credit nobody had paid — proved on a real MySQL, where
 * the old code failed ten of eleven checks. The database tests that cover
 * this only run with a database, so this pins the rule where CI can see it.
 */
describe("corrections and reversals read the charge as it stands", () => {
  it("adjustCharge takes its delta from the effective amount", () => {
    const fn = body("adjustCharge");
    expect(fn).toContain("const originalAmount = await effectiveChargeUsd(tx, original);");
    expect(fn).not.toContain("const originalAmount = parseFloat(original.amountUsd");
  });

  it("reverseCharge hands back the effective amount", () => {
    const fn = body("reverseCharge");
    expect(fn).toContain("const amountUsd = Math.max(0, await effectiveChargeUsd(tx, original));");
    expect(fn).not.toContain("const amountUsd = parseFloat(original.amountUsd");
  });

  it("the effective amount counts both kinds of marker, in cents", () => {
    const fn = body("effectiveChargeUsd");
    expect(fn).toContain("[ADJ:${original.transactionNumber}]");
    expect(fn).toContain("[REV:${original.transactionNumber}]");
    expect(fn).toContain("eq(ledgerTransactions.accountId, original.accountId)");
    expect(fn).toContain("Math.round(");
  });
});
