import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The payments page reads payments, not "the last rows of everything".
 * On 2026-10-03 the last 100 ledger rows were all corrections, and the page
 * said "$0 — no payments" while the money had come in. The method was also
 * guessed from the description's words; a payment record carries its own.
 */
describe("the payments page", () => {
  const page = readFileSync(resolve(__dirname, "pages/Payments.tsx"), "utf8");

  it("asks for payment records", () => {
    expect(page).toContain("trpc.ledger.getRecentPayments.useQuery(");
    expect(page).not.toContain("getRecentTransactions");
  });

  it("splits by the recorded method and counts what was handed back", () => {
    expect(page).not.toMatch(/description \|\| ''\)\.toLowerCase\(\)\.includes\('cash'\)/);
    expect(page).toContain('methodOf(p) === "CASH"');
    expect(page).toContain("Number(p.amountUsd || 0) - Number(p.reversedAmountUsd || 0)");
  });
});
