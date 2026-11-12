import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/** Owner, 2026-11-13: the batch report's customers end on a total, and the heaviest parcels carry the name. */
describe("batch report PDF: totals and names", () => {
  const pdf = read("server/services/pdfReports.ts");
  it("the customers table ends on a Total row summed from its own rows", () => {
    expect(pdf).toContain("{ t: 'Total', b: true }, { t: `${rows.length} customers`, b: true }");
    expect(pdf).toContain("const allProfit = rows.length > 0 && rows.every((c) => c.profit !== null);");
  });
  it("the heaviest parcels show the customer's name beside the code", () => {
    expect(pdf).toContain("['Code', 192, 55, 'left'], ['Name', 249, 150, 'left']");
    expect(read("server/db/batchReport.db.ts")).toContain("customerName: r.p.customerId ? nameOf.get(r.p.customerId)?.name ?? null : null,");
  });
});
