import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-27: «هەر باچێکی نوێ دروست کرا بەبێ AWB ئەوە دەبێ یەکسەر
 * بە ئامادەکاری حیسابی بکات نەک لە کۆگای هەولێر.»
 *
 * One arrival scan used to carry the whole shipment to the Erbil depot,
 * which is right when it flew and wrong when it has not been given a
 * waybill yet: a parcel scanned onto a brand-new batch dragged that batch,
 * and every customer in it, to «لە کۆگای هەولێر».
 */
describe("a batch with nothing to travel under stays in preparation", () => {
  const db = read("server/db/batches.db.ts");
  const fn = db.slice(db.indexOf("export async function advanceBatchToDepot"));

  it("asks for the number the shipment travels under", () => {
    // The same rule the parcel timeline runs on: the waybill by air, the
    // container by sea, is what says it left (shared/parcelStage).
    expect(fn).toContain('batch.shippingType === "sea" ? batch.containerNumber : batch.awbNumber');
    expect(fn).toContain("if (!travelsUnder) {");
  });

  it("refuses quietly, and says why in the log", () => {
    // Refusing without a word would look like the scan failing.
    const guard = fn.slice(fn.indexOf("if (!travelsUnder) {"), fn.indexOf("if (!travelsUnder) {") + 500);
    expect(guard).toContain("appLogger.info");
    expect(guard).toContain("no waybill or container");
    expect(guard).toContain("return { moved: false, from: batch.status };");
  });

  it("still moves the parcel that was scanned", () => {
    // The scan establishes where that parcel is, and that write happens
    // before the batch is ever consulted.
    const scanner = read("server/routers/scanning.router.ts");
    const moved = scanner.indexOf("await db.updatePackageStatusViaScan(");
    const batch = scanner.indexOf("await db.advanceBatchToDepot(");
    expect(moved).toBeGreaterThan(-1);
    expect(batch).toBeGreaterThan(moved);
  });

  it("is the only thing that moves a batch on its own", () => {
    // If a second automatic writer ever appears it needs the same rule, so
    // this fails until somebody has looked at it.
    const writers = read("server/db/batches.db.ts").match(/status: "(at_depot|arrived|customs)"/g) ?? [];
    expect(writers).toEqual(['status: "at_depot"']);
  });
});
