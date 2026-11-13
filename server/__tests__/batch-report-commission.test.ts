/**
 * The batch report's customers carry the commission on their orders that came
 * in the batch, and freight + commission together (owner, 2026-11-13). The
 * commission is the one profit rule's (shared/orderProfit), counted once per
 * order, in the batch of its first parcel.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8");

describe("batch report commission", () => {
  it("is the one profit rule, live sales only, commission orders only, once per order", () => {
    const src = read("server/db/batchCommission.db.ts");
    expect(src).toContain('import { isLiveSale, orderProfitUsd } from "@shared/orderProfit";');
    expect(src).toContain('o.orderType === "commission" && isLiveSale(o)');
    expect(src).toContain("mine[0].batchId !== batchId");
  });

  it("each customer row has it, and the total is freight plus commission", () => {
    const src = read("server/db/batchReport.db.ts");
    expect(src).toContain("const commission = await commissionByCustomer(batchId, live);");
    expect(src).toContain("totalProfit: waiting ? null : round2(revenue - cost + commissionUsd),");
  });

  it("the PDF shows Freight, Comm. and Total, and sums the Total row from the rows", () => {
    const pdf = read("server/services/pdfReports.ts");
    expect(pdf).toContain("['Freight', 409, 48, 'right'], ['Comm.', 459, 44, 'right'], ['Total', 505, 48, 'right']");
    expect(pdf).toContain("const commissionSum = sum((c) => c.commissionUsd);");
    expect(pdf).toContain("money(sum((c) => c.totalProfit ?? 0))");
  });

  it("the batch revenue is the sum of its parcels' cents, so header and rows agree", () => {
    const src = read("server/db/batches.db.ts");
    expect(src).toContain("priced += cents;");
    expect(src).not.toContain("priced += final;");
  });
});
