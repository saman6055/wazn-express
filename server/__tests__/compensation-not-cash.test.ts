/**
 * Compensation or a waiver lowers a debt as a discount, never as money
 * received (owner, 2026-11-05: an $8 CBM compensation showed as cash).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("compensation is not cash", () => {
  it("the payment door sends it to a discount, before any payment record", () => {
    const r = read("server/routers/finance.router.ts");
    const comp = r.indexOf("if (input.paymentMethod === 'COMPENSATION') {");
    const cash = r.indexOf("db.recordPaymentReceived(", comp);
    expect(comp).toBeGreaterThan(0);
    expect(r.slice(comp, cash)).toContain("'credit', reason, ctx.user.id, 'compensation')");
  });
  it("the ledger writes it as CREDIT_DISCOUNT", () => {
    expect(read("server/db/finance.db.ts")).toContain("compensation ? 'CREDIT_DISCOUNT' : 'ADJUSTMENT_CREDIT'");
  });
  it("every payment dialog offers it", () => {
    for (const f of ["client/src/pages/finance/CustomerFinance.tsx", "client/src/pages/finance/Finance.tsx"]) {
      expect(read(f)).toContain('<SelectItem value="COMPENSATION">');
    }
    expect(read("client/src/pages/finance/Payments.tsx")).toContain("'compensation': 'COMPENSATION'");
  });
});
