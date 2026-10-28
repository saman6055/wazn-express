import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-20/21: a parcel forgotten at the scanner went home unbilled
 * (Zainab, 79135534330219). The box shows «3/10 سکان کرا» - every parcel of
 * the customer in the batch - says so after a minute without a scan, shows
 * the newest scan first, and asks «ئاگاداری...؟» before a receipt goes out.
 * Nothing is stored and no parcel changes.
 */
describe("a box knows how much of the customer's batch is in a box", () => {
  const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
  const table = read("client/src/components/delivery/BoxTable.tsx");
  const card = read("client/src/components/delivery/BoxMissingParcels.tsx");
  const db = read("server/db/boxMissing.db.ts");

  it("counts every parcel of the batch, wherever it is, but a returned or cancelled one", () => {
    const fn = db.slice(db.indexOf("export async function getBoxScanState"), db.indexOf("export async function getBoxMissingParcels"));
    // Every batch the box draws from: its own and its parcels' (a hand-made
    // box of seven parcels from two batches said 2/2, owner 2026-10-21).
    expect(fn).toContain("inArray(packages.batchId, Array.from(batchIds)),");
    expect(fn).toContain("notInArray(packages.status, [...ENDED]),");
    expect(fn).toContain("for (const r of rows) if (r.batchId) batchIds.add(r.batchId);");
    expect(db).toContain('const ENDED = ["returned", "cancelled"] as const;');
    expect(fn).toContain("return { total: candidates.length, scanned: candidates.length - missing.length, missing, earlier };");
  });

  it("the box screen shows scanned/total, the trackings, and the minute", () => {
    expect(panel).toContain("<BoxMissingParcels");
    expect(card).toContain("{data.scanned}/{data.total}");
    expect(card).toContain("}, 60_000);");
    expect(card).toContain("soundManager.playWarning();");
  });

  it("print, send and PDF ask «ئاگاداری...؟» in the one step before the paper", () => {
    const gate = panel.slice(panel.indexOf("const askBeforePrinting = ("), panel.indexOf("// Ready before the print button is pressed"));
    expect(gate).toContain("if (!reached && !missingAckRef.current && ((missingNow?.missing.length ?? 0) > 0 || (missingNow?.earlier.length ?? 0) > 0)) {");
    expect(panel).toContain('data-testid="box-missing-yes"');
    expect(panel).toContain('data-testid="box-missing-no"');
    expect(table).toContain("trpcUtils.deliveryBox.missingParcels.fetch({ boxId: box.id })");
  });

  it("nothing is stored: no «نەگەیشتووە», no parcel moved", () => {
    expect(db).not.toContain("markMissingParcelNotArrived");
    expect(read("server/routers/scanning.router.ts")).not.toContain("markMissingNotArrived");
  });

  it("the newest scan is first in the list", () => {
    expect(panel).toContain("newestFirst(items).map(");
  });
});

/**
 * Owner, 2026-10-20: arrived is not handed over. A parcel is delivered by its
 * box - handed over, paid, or three days after the box was made.
 */
describe("a parcel is delivered by its box, not by its batch's arrival", () => {
  it("the batch's flow steps unboxed parcels back to the office, after its money", () => {
    const flow = read("server/routers/batches.router.ts");
    const safety = flow.indexOf('appLogger.info("[BatchDelivered Phase3] Safety-net complete", { diag });');
    const step = flow.indexOf("await db.stepUnboxedBatchParcelsToArrived(id);");
    expect(safety).toBeGreaterThan(0);
    expect(step).toBeGreaterThan(safety);
  });

  // Dropped 2026-10-28 (owner): some boxes wait at the customer's request,
  // some go out unpaid - a clock cannot tell which (shared/boxHold).
  it("no three-day clock delivers a box's parcels", () => {
    expect(read("server/_core/index.ts")).not.toContain("scheduleBoxDeliveredAfterDays");
    expect(read("server/_core/prod-entry.ts")).not.toContain("scheduleBoxDeliveredAfterDays");
    expect(read("server/db/boxMissing.db.ts")).not.toContain("deliverParcelsOfOldBoxes(");
  });

  it("the unbilled-goods checks count a parcel at the office as arrived", () => {
    expect(read("server/db/orderCharging.db.ts")).toContain('inArray(packages.status, ["ready_for_delivery", "out_for_delivery", "delivered"])');
    expect(read("server/services/auditSweep.service.ts")).toContain("WHERE p.status IN ('ready_for_delivery','out_for_delivery','delivered')");
  });
});

/** Owner, 2026-10-20: the ones from before, as a read-only list. */
describe("parcels that went out without a box are listed, read only", () => {
  it("delivered, in no box that was not cancelled, by parcel or by tracking", () => {
    const db = read("server/db/boxMissing.db.ts");
    const fn = db.slice(db.indexOf("export async function getParcelsDeliveredWithoutBox"));
    expect(fn).toContain("WHERE p.status = 'delivered'");
    expect(fn).toContain("x.status <> 'cancelled'");
    expect(fn).toContain("WHERE i.packageId = p.id");
    expect(fn).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
  });

  it("has its own page in the parcels menu", () => {
    expect(read("client/src/App.tsx")).toContain('<Route path="/packages/without-box" component={DeliveredWithoutBox} />');
    expect(read("client/src/components/DashboardLayout.tsx")).toContain('path: "/packages/without-box"');
    expect(read("shared/permissions.ts")).toContain('"/packages/without-box": "packages",');
  });
});

/**
 * Owner, 2026-10-21: «لە باچی پێشوو ... ئۆندە پاکەتەی هەمان موشتەری لە ناو
 * هیچ بۆکسێک نیە بۆی نەچووە؟» - said when this batch is all scanned, and
 * before the receipt goes out; never mixed into this batch's count.
 */
describe("the customer's parcels from earlier batches, waiting at the office", () => {
  const db = read("server/db/boxMissing.db.ts");
  const card = read("client/src/components/delivery/BoxMissingParcels.tsx");
  const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");

  it("other batches, at the office, in no box; an old-flow delivered one only recently", () => {
    const fn = db.slice(db.indexOf("async function earlierWaiting"), db.indexOf("async function notInAnyBox"));
    expect(fn).toContain("notInArray(packages.batchId, Array.from(exceptBatchIds))");
    expect(fn).toContain('inArray(packages.status, ["ready_for_delivery", "out_for_delivery"]),');
    expect(fn).toContain('and(eq(packages.status, "delivered"), gte(packages.deliveredAt, since)),');
    expect(fn).toContain("return notInAnyBox(rows);");
    expect(db).toContain("const EARLIER_DELIVERED_DAYS = 90;");
  });

  it("said when the batch is all in, and in the question before the paper", () => {
    expect(card).toContain("if (before === null || before === 0 || left !== 0 || data.total === 0) return;");
    expect(card).toContain("{data.earlier.length > 0 && (");
    expect(panel).toContain("((missingNow?.missing.length ?? 0) > 0 || (missingNow?.earlier.length ?? 0) > 0)");
    expect(panel).toContain("<EarlierWaiting earlier={missingNow?.earlier ?? []} language={language} />");
  });
});
