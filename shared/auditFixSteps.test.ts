import { describe, expect, it } from "vitest";
import { CHECKS } from "./auditSweep";
import { FIX_STEPS } from "./auditFixSteps";

describe("every audit finding says how to put it right (owner, 2026-10-30)", () => {
  it("each check has steps, in Kurdish", () => {
    for (const check of CHECKS) {
      const steps = FIX_STEPS[check.id];
      expect(steps?.length, check.id).toBeGreaterThan(0);
      for (const s of steps) expect(s.ku.trim(), check.id).not.toBe("");
    }
  });

  it("money that disagrees with its history is never typed over by hand", () => {
    for (const id of ["account_balance_drift", "cash_account_drift", "partner_books_drift", "payment_without_ledger"] as const) {
      expect(FIX_STEPS[id].some((s) => s.en.startsWith("Do not change it by hand")), id).toBe(true);
    }
  });
});
