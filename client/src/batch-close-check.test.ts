import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * What the pre-delivery check says before a batch is closed or marked
 * delivered (owner, 2026-09-18): the cartons with no box and the ones never
 * checked in on arrival, listed with their code and tracking — a click opens
 * the carton with its photos — no selling price, a loss, and the rest worth a
 * second look. Warnings only, the loss included; the same check before
 * "delivered" as before "closed".
 *
 * What each finding means is unit-tested in shared/batchCloseCheck.test.ts;
 * this pins the wiring from the server to the dialog.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const router = read("server/routers/batches.router.ts");
const facts = read("server/db/batchCloseCheck.db.ts");
const component = read("client/src/components/batches/BatchCloseCheck.tsx");
const page = read("client/src/pages/Batches.tsx");

const audit = (() => {
  const start = router.indexOf("getPreDeliveryAudit: staffProcedure");
  expect(start).toBeGreaterThan(-1);
  const end = router.indexOf("\n      }),\n", start);
  expect(end).toBeGreaterThan(start);
  return router.slice(start, end);
})();

describe("the server gathers it", () => {
  it("the cartons, the boxes and the money, beside the checks that were there", () => {
    expect(audit).toContain("const close = await db.getBatchCloseFacts(input.batchId);");
    expect(audit).toContain("const financial = await db.getBatchFinancialSummary(input.batchId);");
    expect(audit).toContain("priceMissing: batchMissingSellingPrice(batch, {");
    expect(audit).toContain('costMissing: financial?.costSource === "none",');
    expect(audit).toContain("const missingNumber = missingPieces(batch);");
    for (const key of ["unboxed: close.unboxed,", "notArrivalChecked: close.notArrivalChecked,", "unpaidBoxes: close.unpaidBoxes,", "missingNumber,"]) {
      expect(audit).toContain(key);
    }
  });

  it("as warnings only: a customer mismatch is still the one thing that holds a batch back", () => {
    expect(audit).toContain("const blocking = customerMismatch.length > 0;");
    expect(audit).toContain("closeCheckWarns({ ...close, missingNumber, money });");
  });

  it("a carton counts as boxed by its id or its tracking, in any box not cancelled", () => {
    expect(facts).toContain('ne(deliveryBoxes.status, "cancelled"),');
    expect(facts).toContain("or(inArray(deliveryBoxItems.packageId, ids), inArray(deliveryBoxItems.trackingNumber, trackings))");
  });

  it("checked in on arrival means the arrival scanner's scan", () => {
    expect(facts).toContain('eq(packageScans.scanType, "received_local"),');
    expect(read("client/src/pages/ArrivalVerificationScanner.tsx")).toContain('scanType: "received_local",');
  });

  it("what a box still owes is what its payment screen says", () => {
    expect(facts).toContain("const paid = await getBoxesPaidInFull(boxIds);");
    expect(facts).toContain("const view = await getBoxSettlementView(boxId);");
  });

  it("and it only reads", () => {
    expect(facts).not.toMatch(/\.(insert|update|delete)\(/);
  });
});

describe("the dialog shows it", () => {
  it("before delivered as before closed", () => {
    expect(page).toContain('if (value === "delivered" || value === "closed") {');
    expect(page).toContain("trpcUtilsForAudit.batches.getPreDeliveryAudit.fetch({ batchId: batch.id })");
  });

  it("three more tiles, and the sections after a customer mismatch", () => {
    expect(page).toContain("<CloseCheckTiles audit={auditData} />");
    const mismatch = page.indexOf("{/* Blocking: customer mismatch */}");
    // It gained the batch code, which each section prints at the head of
    // its own sheet (lib/closeCheckPrint, 2026-09-26).
    const sections = page.indexOf("<BatchCloseCheckSections audit={auditData} batchCode={auditData?.batchCode} batchId={auditData?.batchId} />");
    expect(mismatch).toBeGreaterThan(-1);
    expect(sections).toBeGreaterThan(mismatch);
  });

  it("every carton copies its code and tracking, and a click opens it with its photos", () => {
    expect(component).toContain("<CopyButton value={p.packageCode} label={copyCode} className=\"relative z-10\" />");
    expect(component).toContain("<CopyButton value={p.trackingNumber} label={copyTracking} className=\"relative z-10\" />");
    expect(component).toContain("onClick={() => onOpen(p)}");
    expect(component).toContain('kind="check"');
    expect(read("client/src/components/registrations/AlertParcelSheet.tsx")).toContain('kind: "stale" | "volumetric" | "check";');
  });

  it("each box still owing copies its code", () => {
    expect(component).toContain("<CopyButton value={b.boxCode}");
  });

  it("the money in red: a loss with its figures, no cost recorded, no selling price", () => {
    expect(component).toContain("{loss && (");
    expect(component).toContain("{money.costMissing && (");
    expect(component).toContain("{money.priceMissing && (");
  });
});
