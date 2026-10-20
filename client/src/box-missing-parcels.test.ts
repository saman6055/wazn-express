import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-20: a parcel forgotten at the scanner went home unbilled
 * (Zainab, 79135534330219). The box counts what it still waits for, says so
 * after a minute without a scan, and no receipt is printed or sent while one
 * is unexplained.
 */
describe("a box knows the parcels it is still waiting for", () => {
  const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
  const table = read("client/src/components/delivery/BoxTable.tsx");
  const card = read("client/src/components/delivery/BoxMissingParcels.tsx");

  it("the box screen shows the count and the trackings, and the minute", () => {
    expect(panel).toContain("<BoxMissingParcels");
    expect(panel).toContain("setScanTick((n) => n + 1);");
    expect(card).toContain("}, 60_000);");
    expect(card).toContain("soundManager.playWarning();");
  });

  it("print, send and PDF wait in the one step before the paper", () => {
    const gate = panel.slice(panel.indexOf("const askBeforePrinting = ("), panel.indexOf("// Ready before the print button is pressed"));
    expect(gate).toContain("if (!reached && (missingNow?.length ?? 0) > 0) {");
    expect(panel).toContain("const handleSendOnWhatsApp = (format: ReceiptShareFormat");
    expect(panel).toContain("askBeforePrinting(lang, downloadReceiptNow)");
  });

  it("the box list's own print asks too", () => {
    expect(table).toContain("trpcUtils.deliveryBox.missingParcels.fetch({ boxId: box.id })");
  });

  it("«نەگەیشتووە» moves only the parcel's status, never its order or money", () => {
    const db = read("server/db/boxMissing.db.ts");
    const start = db.indexOf("export async function markMissingParcelNotArrived");
    const fn = db.slice(start, db.indexOf("A batch's arrival puts its parcels", start));
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).toContain('.set({ status: "in_transit" })');
    expect(fn).not.toContain("updatePackage(");
    expect(fn).not.toContain("ledger");
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

  it("the three-day clock runs with the server, only on parcels inside a box", () => {
    expect(read("server/_core/index.ts")).toContain("await scheduleBoxDeliveredAfterDays();");
    const db = read("server/db/boxMissing.db.ts");
    expect(db).toContain("export const BOX_DELIVERED_AFTER_DAYS = 3;");
    const fn = db.slice(db.indexOf("export async function deliverParcelsOfOldBoxes"));
    expect(fn).toContain("inArray(packages.id, inOldBoxes)");
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
