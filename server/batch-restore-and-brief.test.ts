/**
 * A batch put back from the bin keeps its prices (2026-10-29), and the
 * morning brief compares today's debt with yesterday's, not with itself.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("a batch restored from the bin", () => {
  it("its prices and stage history ride in the bin copy, from both delete paths", () => {
    const router = read("server/routers/batches.router.ts");
    expect(router.split("const sideRows = await db.batchSideRows(input.id);").length - 1).toBe(2);
    expect(router.split("releasedPackageIds, sideRows }").length - 1).toBe(2);
  });

  it("comes back with them, in one transaction", () => {
    const trash = read("server/db/trash.db.ts");
    const fn = trash.slice(trash.indexOf("export async function restoreBatchFromSnapshot("));
    expect(fn).toContain("await db.transaction(async (tx) => {");
    expect(fn).toContain("await tx.insert(batchPricingTiers)");
    expect(fn).toContain("await tx.insert(batchCustomerPricing)");
    expect(read("server/routers/trash.router.ts")).toContain("await db.restoreBatchFromSnapshot(batchRow, sideRows);");
  });
});

describe("the morning brief's debt", () => {
  it("the hourly re-write keeps the debt first stored for the day", () => {
    const brief = read("server/services/dailyBrief.service.ts");
    expect(brief).not.toContain("outstandingDebtUsd = VALUES(outstandingDebtUsd)");
    expect(brief).not.toContain("openBatches = VALUES(openBatches)");
  });
});

describe("a reversed receipt", () => {
  it("tells the customer only after the money is committed", () => {
    const src = read("server/db/boxSettlement.db.ts");
    expect(src).toContain("}).then(async ({ customerId, putBack }) => {");
  });
});
