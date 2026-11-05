/**
 * The company's own code is spending, not a customer's debt (owner,
 * 2026-11-05). Every debt figure passes through NOT_HOUSE_ACCOUNT.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { workingCapital } from "@shared/workingCapital";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("house account", () => {
  it("every debt reader leaves it out", () => {
    for (const f of ["server/db/finance.db.ts", "server/db/debtAge.db.ts", "server/db/financePulse.db.ts", "server/db/reports.db.ts", "server/db/boxReminder.db.ts"]) {
      expect(read(f), f).toContain("NOT_HOUSE_ACCOUNT");
    }
  });
  it("working capital counts it as spent", () => {
    const base = { capitalUsd: 1000, profitUsd: 0, expensesUsd: 0, withdrawals: [], debtUsd: 0, debtors: 0, creditUsd: 0, goodsOnRoadUsd: 0, goodsOnRoadCostUsd: 0, goodsOnRoadCount: 0, stockUsd: 0, stockCount: 0 };
    expect(workingCapital({ ...base, houseUsd: 48.71 }).shouldHoldUsd).toBe(951.29);
  });
});
