import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { likelyCreditCause } from "./db/creditCustomers.db";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * Owner, 2026-10-01: "no customer has credit — find the ones that do."
 */
describe("customers in credit", () => {
  it("reads AZ173 as a debt cleared twice", () => {
    expect(likelyCreditCause({ creditUsd: 34.24, handCreditUsd: 54.5, boxReceiptsUsd: 244.57, discountUsd: 0 }))
      .toBe("double_clearing");
  });

  it("tells the other stories apart", () => {
    expect(likelyCreditCause({ creditUsd: 10, handCreditUsd: 10, boxReceiptsUsd: 0, discountUsd: 0 })).toBe("hand_credit");
    expect(likelyCreditCause({ creditUsd: 40.15, handCreditUsd: 0, boxReceiptsUsd: 3.85, discountUsd: 44 })).toBe("discount");
    expect(likelyCreditCause({ creditUsd: 20, handCreditUsd: 0, boxReceiptsUsd: 50, discountUsd: 0 })).toBe("other");
  });

  it("the finder only reads", () => {
    const whole = read("server/db/creditCustomers.db.ts");
    const src = whole.slice(0, whole.indexOf("export const ZERO_CREDIT_REASON")).toUpperCase();
    expect(src.length).toBeGreaterThan(1000);
    for (const verb of ["INSERT ", "UPDATE ", "DELETE ", ".INSERT(", ".UPDATE(", ".DELETE("]) {
      expect(src, `the finder contains ${verb}`).not.toContain(verb);
    }
  });

  it("is admin-only and shown in Repairs", () => {
    expect(read("server/routers/finance.router.ts")).toContain("customersInCredit: adminProcedure.query");
    expect(read("client/src/pages/admin/DataManagement.tsx")).toContain("<CreditCustomersSection language={language} />");
  });

  it("zeroing debits exactly what the account holds, read when it posts", () => {
    const whole = read("server/db/creditCustomers.db.ts");
    const fn = whole.slice(whole.indexOf("export async function zeroCustomerCredits"));
    expect(fn).toContain("const creditCents = row ? Math.round(-Number(row.balance ?? 0) * 100) : 0;");
    expect(fn).toContain("if (!row || creditCents <= 0) {");
    expect(fn).toContain('creditCents / 100, "debit", ZERO_CREDIT_REASON');
    // The screen sends customers, never amounts.
    const router = read("server/routers/finance.router.ts");
    expect(router).toContain("zeroCustomerCredits: adminProcedure");
    expect(router).toContain('action: "zero_customer_credits"');
  });

  it("the screen asks before it zeroes", () => {
    const ui = read("client/src/components/admin/CreditCustomersSection.tsx");
    expect(ui.indexOf("await confirmAction(")).toBeLessThan(ui.indexOf("zero.mutate({ customerIds"));
  });
});
