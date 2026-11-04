import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The two customer cards say what they measure (audit 2026-11-05): the debt
 * list is the biggest balances with days since the last payment, not
 * "overdue"; the top list is ranked by what was billed, counting charges,
 * not parcels.
 */
const page = readFileSync(resolve(__dirname, "../pages/dashboard/Dashboard.tsx"), "utf8");

describe("dashboard customer cards", () => {
  it("biggest debts, with days since paying", () => {
    expect(page).toContain("گەورەترین قەرزەکان");
    expect(page).toContain("ڕۆژە پارەی نەداوە");
    expect(page).not.toContain("t('dashboard.overdueDebtAlerts')");
  });

  it("top customers by billed, counting charges", () => {
    expect(page).toContain("بە پێی کۆی حیسابکراو، هەموو کات");
    expect(page).not.toContain("{customer.packageCount} {t('common.package')}");
  });
});
