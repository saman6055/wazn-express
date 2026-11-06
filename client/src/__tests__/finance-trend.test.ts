/** The finance centre's charts read the cards' own figures (owner, 2026-11-07: infographics). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("finance trend", () => {
  const db = read("server/db/financePulse.db.ts");
  const start = db.indexOf("export async function getFinanceTrend");
  const end = db.indexOf("async function receivedBetween");
  const body = db.slice(start, end);
  it("uses the same functions as the centre's cards", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(body).toContain("getMoneyReceived(now).then((r) => r.month)");
    expect(body).toContain("receivedBetween(db, bounds.start, end)");
    expect(body).toContain("expensesBetween(db, bounds.start, end)");
    expect(body).toContain("cents(num(profit.total.profit))");
  });
  it("the centre draws it, and the received and profit cards carry their line", () => {
    const page = read("client/src/pages/finance/FinanceCenter.tsx");
    expect(page).toContain("trpc.ledger.financeTrend.useQuery({ months: 6 })");
    expect(page).toContain('spark={trend.map((t) => t.receivedUsd)} sparkColour="#10B981"');
    expect(page).toContain("<FinanceTrendCard");
  });
});
