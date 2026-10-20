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
    const fn = db.slice(db.indexOf("export async function markMissingParcelNotArrived"));
    expect(fn).toContain('.set({ status: "in_transit" })');
    expect(fn).not.toContain("updatePackage(");
    expect(fn).not.toContain("ledger");
  });
});
