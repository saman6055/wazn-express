import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { sameList, seenList } from "./boxDoubleChargeAll";

/**
 * Every false debt at one yes (owner, 2026-10-10: "if it is not real, why
 * does it show a void thing? ... chasing them wastes a great deal of time").
 *
 * What would undo it: the one yes covering a list other than the one on
 * screen, a second rule for taking a debt off, anyone but the main admin
 * pressing it, or one customer's failure stopping the rest in silence.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the list that was agreed to", () => {
  it("is those with something to take off, and their total to the cent", () => {
    expect(seenList([{ falseDebtUsd: 60.36 }, { falseDebtUsd: 120 }, { falseDebtUsd: 0 }, { falseDebtUsd: 0.004 }])).toEqual({ customers: 2, totalUsd: 180.36 });
    // Thirty-three small figures must not drift by a float's rounding.
    expect(seenList(Array.from({ length: 33 }, () => ({ falseDebtUsd: 0.1 }))).totalUsd).toBe(3.3);
  });

  it("one cent or one customer of difference is a different list", () => {
    const seen = { customers: 33, totalUsd: 2149.16 };
    expect(sameList(seen, { customers: 33, totalUsd: 2149.16 })).toBe(true);
    expect(sameList(seen, { customers: 33, totalUsd: 2149.15 })).toBe(false);
    expect(sameList(seen, { customers: 32, totalUsd: 2149.16 })).toBe(false);
  });
});

describe("one yes is as careful as thirty-three", () => {
  const db = root("server/db/boxDoubleChargeAll.db.ts");

  it("checks the list against what was seen before anything moves", () => {
    const check = db.indexOf("if (!sameList(seen, seenList(now)))");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(db.indexOf("await correctBoxDoubleCharge("));
  });

  it("takes each debt off by the one rule, never one of its own", () => {
    expect(db).toContain("await correctBoxDoubleCharge(customer.customerId, userId)");
    for (const forbidden of ["reverseCharge", "adjustCharge", "adjustCustomerBalance", "ledgerTransactions", "db.insert(", "db.update("]) {
      expect(db, forbidden).not.toContain(forbidden);
    }
  });

  it("one customer's failure is reported by name and stops nobody else", () => {
    expect(db).toContain("result.failed.push({ customerId: customer.customerId, customerCode: customer.customerCode,");
  });

  it("is the main admin's alone", () => {
    expect(root("server/routers/finance.router.ts")).toContain("correctAllBoxDoubleCharges: superAdminProcedure");
  });
});

describe("the page shows the whole list before the yes", () => {
  const page = root("client/src/pages/BoxDoubleCharges.tsx");

  it("who, what comes off, and what stays - then one button", () => {
    expect(page).toContain('data-testid="double-charge-all-list"');
    expect(page).toContain("<Money value={c.balanceUsd - c.falseDebtUsd}");
    expect(page).toContain('data-testid="double-charge-all-yes"');
  });

  it("the yes carries the list on screen, and only the main admin sees the button", () => {
    expect(page).toContain("fixAll.mutate(seenList(owing))");
    expect(page).toContain("{isMainAdmin && owing.length > 1 && !askingAll && (");
  });

  it("a failure is shown, never swallowed", () => {
    expect(page).toContain("for (const f of res.failed) toast.error(");
  });
});
