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

/**
 * Owner, 2026-10-05, shown a wrong weight corrected by a line of its own:
 * «نرخی پێشوو لەگەڵ ئیزافەی نوێ بە جیا بچنە ناو بەشی ژمێریاری، ئەوە قەبوڵ کراو
 * نییە». A parcel weighed or typed wrong is put right where it stands - the
 * one exception to "a row is never rewritten", and kept as narrow as this.
 */
describe("a charge put right where it stands", () => {
  it("rewrites the charge, and moves every later balance of the account by the same difference", () => {
    const fn = body("restateCharge");
    expect(fn).toContain("amountUsd: (nowCents / 100).toFixed(2),");
    expect(fn).toContain("balanceAfterUsd: sql`${ledgerTransactions.balanceAfterUsd} + ${by}`,");
    expect(fn).toContain("balanceBeforeUsd: sql`${ledgerTransactions.balanceBeforeUsd} + ${by}`,");
    expect(fn).toContain("gt(ledgerTransactions.id, original.id),");
    expect(fn).toContain("currentBalanceUsd: newBalanceUsd.toFixed(2),");
  });

  it("works in whole cents, from the row as it stands", () => {
    const fn = body("restateCharge");
    expect(fn).toContain("const wasCents = Math.round(parseFloat(original.amountUsd || '0') * 100);");
    expect(fn).toContain("const deltaCents = nowCents - wasCents;");
    expect(fn).toContain("if (deltaCents === 0) {");
  });

  it("only a charge nothing has been posted against", () => {
    expect(body("restateCharge")).toContain("if (await chargeHasCorrections(tx, original)) {");
    const has = body("chargeHasCorrections");
    expect(has).toContain("[ADJ:${original.transactionNumber}]");
    expect(has).toContain("[REV:${original.transactionNumber}]");
    expect(has).toContain("eq(ledgerTransactions.accountId, original.accountId)");
  });

  it("never down to nothing: a charge no longer owed is reversed, not restated", () => {
    expect(body("restateCharge")).toContain("if (!(newAmountUsd > 0)) {");
  });

  it("holds the account while its rows are moved", () => {
    const fn = body("restateCharge");
    const lock = fn.indexOf("const account = await _lockAccount(tx, original.accountId);");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(fn.indexOf("await tx.update(ledgerTransactions)"));
  });

  it("keeps the record of the change in the same transaction", () => {
    const fn = body("restateCharge");
    expect(fn).toContain("await tx.insert(auditLogs).values({");
    expect(fn).toContain("action: CHARGE_RESTATED_ACTION,");
    expect(fn).toContain("oldValues: { amountUsd: wasCents / 100 },");
    expect(fn).toContain("newValues: { amountUsd: nowCents / 100 },");
    // createAuditLog opens a connection of its own: a record written there
    // could survive a correction that was rolled back, or be lost after one
    // that was not.
    expect(fn).not.toContain("createAuditLog(");
  });

  it("writes no ledger row", () => {
    expect(body("restateCharge")).not.toContain("insert(ledgerTransactions)");
  });
});

describe("the one place a ledger row's amount is rewritten", () => {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) files.push(full);
    }
  };
  walk(__dirname);

  it("no other file updates a ledger row", () => {
    expect(files.length).toBeGreaterThan(100);
    const others = files.filter((f) => !f.replace(/\\/g, "/").endsWith("db/finance.db.ts")
      && readFileSync(f, "utf8").includes("update(ledgerTransactions)"));
    expect(others).toEqual([]);
  });

  it("and in the ledger itself, only the invoice link and the restatement", () => {
    expect(src.split("update(ledgerTransactions)").length - 1).toBe(3);
    expect(body("restateCharge").split("update(ledgerTransactions)").length - 1).toBe(2);
    const link = body("linkTransactionToInvoice");
    expect(link.split("update(ledgerTransactions)").length - 1).toBe(1);
    expect(link).toContain(".set({ invoiceId })");
  });

  it("and the ledger file never deletes one", () => {
    expect(src).not.toMatch(/\.delete\(ledgerTransactions\)/);
  });
});
