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
    const src = read("server/db/creditCustomers.db.ts").toUpperCase();
    for (const verb of ["INSERT ", "UPDATE ", "DELETE ", ".INSERT(", ".UPDATE(", ".DELETE("]) {
      expect(src, `the finder contains ${verb}`).not.toContain(verb);
    }
  });

  it("is admin-only and shown in Repairs", () => {
    expect(read("server/routers/finance.router.ts")).toContain("customersInCredit: adminProcedure.query");
    expect(read("client/src/pages/admin/DataManagement.tsx")).toContain("<CreditCustomersSection language={language} />");
  });
});
