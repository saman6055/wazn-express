import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8");

/**
 * The carrier strip takes off our other batches' late cartons that came in
 * this load (owner, 2026-11-03: carrier 99 kg, 15 of batch 69, 18 of 79 = 33).
 */
describe("carrier strip counts our other batches in the load", () => {
  it("the register says which load a late carton came in", () => {
    const qr = read("client/src/pages/packages/QuickRegister.tsx");
    expect(qr).toContain('scanType: "received_local", arrivedWithBatchId: parseInt(batchId) || undefined');
    const router = read("server/routers/scanning.router.ts");
    expect(router).toContain('arrivedWithBatchId: input.scanType === "received_local" ? input.arrivedWithBatchId : undefined');
    expect(read("server/_core/migrations.ts")).toContain("ADD COLUMN arrivedWithBatchId INT NULL");
  });

  it("the check reads them, never this batch's own cartons", () => {
    const src = read("server/db/carrierGroup.db.ts");
    const body = src.slice(src.indexOf("async function arrivedWithLoad"), src.indexOf("export async function getBatchKgCheck"));
    expect(body).toContain("inArray(packageScans.arrivedWithBatchId, batchIds)");
    expect(body).toContain("notInArray(packages.batchId, batchIds)");
    expect(body).toContain("seen.has(p.id)");
  });

  it("what is left is the carrier's kilos less all of ours", () => {
    const card = read("client/src/components/batches/CarrierGroupCard.tsx");
    expect(card).toContain("const totalKg = g.oursKg + othersKg;");
    expect(card).toContain("const left = g.carrierKg - totalKg;");
  });
});
