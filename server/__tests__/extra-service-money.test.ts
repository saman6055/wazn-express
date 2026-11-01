/**
 * An extra service on a customer's account is paid on the account, not by a
 * flag (2026-10-30), and the old unlinked finance copy sends to the real one.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("an extra service's money", () => {
  const router = read("server/routers/services.router.ts");
  const doors = router.slice(router.indexOf("    update: accountantProcedure"), router.indexOf("    getSummary: staffProcedure"));

  it("paying, re-pricing or deleting one on an account is refused with the cure", () => {
    expect(doors).not.toBe("");
    expect(doors.split("withFix(ON_ACCOUNT_CAUSE, ON_ACCOUNT_STEPS)").length - 1).toBe(3);
    expect(doors).toContain("markAsPaid: accountantProcedure");
    expect(doors).toContain("delete: accountantProcedure");
  });

  it("a walk-in is paid once, at its own price", () => {
    const fn = read("server/db/services.db.ts");
    const body = fn.slice(fn.indexOf("export async function markExtraServiceAsPaid("));
    expect(body).toContain("paidAmount: sql`${extraServices.priceAmount}`,");
    expect(body).toContain("eq(extraServices.isPaid, false)");
  });

  it("profit counts a service on an account as earned, paid or not", () => {
    expect(read("server/db/finance.db.ts")).toContain("or(eq(extraServices.isPaid, true), eq(extraServices.addedToBalance, true)),");
  });
});

describe("the unlinked finance copy", () => {
  it("/accounting sends to /finance", () => {
    expect(read("client/src/App.tsx")).toContain('<Route path="/accounting">{() => <Redirect to="/finance" replace />}</Route>');
  });
});
