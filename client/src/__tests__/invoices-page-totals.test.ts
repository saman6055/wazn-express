/** The invoices page's figures are every invoice's, not the open page's twenty, and cancelled ones are left out (2026-11-07). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("invoices page totals", () => {
  const page = read("client/src/pages/finance/Invoices.tsx");
  const dbFile = read("server/db/invoices.db.ts");
  it("reads the totals from the server summary", () => {
    expect(page).toContain("trpc.invoices.getSummary.useQuery()");
    expect(page).toContain("totalAmount: allSummary?.liveAmountUsd ?? 0,");
    expect(page).not.toContain("allInvoices.reduce(");
  });
  it("the live total leaves cancelled and refunded invoices out", () => {
    expect(dbFile).toContain("NOT IN ('cancelled', 'refunded') THEN CAST(${invoices.totalUsd} AS DECIMAL(14,2))");
  });
});
