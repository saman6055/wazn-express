import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * What the first real batch from China exposed.
 *
 * Three separate silences, all with the same shape: something moved, and the
 * thing that should have moved with it did not — so the customer was told
 * one story by the goods in their hand and another by the portal.
 *
 *   1. A scan wrote packages.status straight at the column, so no scan in
 *      the system's history ever moved the full-package or commission order
 *      linked to that parcel. Goods delivered; order still "in transit".
 *   2. Arrival verification moved every parcel and left the batch where it
 *      was — usually `preparing`, which the portal renders as "in the China
 *      warehouse". Goods checked into Erbil; portal says China.
 *   3. The scan box disabled itself while a scan was in flight. A disabled
 *      input loses focus and nothing gives it back, so the operator had to
 *      put the gun down and click between every parcel.
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const END_OF_FN = ["", "}", ""].join("\n");

const scanningDb = read("server/db/scanning.db.ts");
const packagesDb = read("server/db/packages.db.ts");
const batchesDb = read("server/db/batches.db.ts");
const scanningRouter = read("server/routers/scanning.router.ts");
const scanInput = read("client/src/components/scanner/ScanInput.tsx");

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker "${startMarker}" not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker "${endMarker}" not found after start`).toBeGreaterThan(start);
  const body = src.slice(start, end);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

const viaScan = () =>
  slice(scanningDb, "export async function updatePackageStatusViaScan", END_OF_FN, "updatePackageStatusViaScan");

describe("a scan moves the order, not just the parcel", () => {
  it("writes through updatePackage rather than at the column", () => {
    // The sync onto every linked order lives inside updatePackage. Going
    // straight to the column skips it, and nothing says so.
    const body = viaScan();
    expect(body, "the order sync is skipped again").toContain("await updatePackage(packageId,");
    expect(body, "a direct column write is back").not.toContain("db.update(packages).set({");
  });

  it("still refuses to drag a package backwards", () => {
    // Scans arrive out of order. Without this a late scan would tell a
    // customer their delivered goods had un-arrived.
    expect(viaScan()).toContain("advanceStatus(oldStatus");
  });

  it("still records what the scan changed", () => {
    expect(viaScan()).toContain("createStatusHistory");
  });

  it("keeps the sync it is relying on", () => {
    // If this map loses ready_for_delivery or delivered, the scan writes
    // through a path that no longer does the job it was routed there for.
    const body = slice(packagesDb, "const statusMap: Record<string, string>", "};", "statusMap");
    expect(body).toContain("'ready_for_delivery': 'arrived'");
    expect(body).toContain("'delivered': 'delivered'");
  });
});

describe("verifying arrival puts the batch in the Erbil depot", () => {
  const advance = () =>
    slice(batchesDb, "export async function advanceBatchToDepot", END_OF_FN, "advanceBatchToDepot");

  it("moves the batch when a parcel is verified", () => {
    const body = slice(scanningRouter, "registerScan: staffProcedure", "quickRegisterPackage", "registerScan");
    expect(body).toContain('newStatus === "ready_for_delivery"');
    expect(body).toContain("advanceBatchToDepot");
  });

  it("only ever forwards", () => {
    // A parcel that turns up late must not reopen a delivered batch.
    const body = advance();
    expect(body).toContain("BATCH_RANK");
    expect(body).toContain("current >= BATCH_RANK.at_depot");
  });

  it("does not let a stuck batch stop the scan being recorded", () => {
    // A scan that failed cannot be recovered from the warehouse floor; a
    // batch that did not move can be moved by hand.
    const body = slice(scanningRouter, 'newStatus === "ready_for_delivery"', "return scan;", "batch advance");
    expect(body).toContain("catch");
  });

  it("lands on the status the portal calls the Erbil depot", () => {
    // shipmentFilters.ts maps at_depot to "لە کۆگای هەولێر" and preparing to
    // "لە کۆگای چین". Landing on the wrong one is the whole bug again.
    expect(advance()).toContain('status: "at_depot"');
  });
});

describe("the scan box stays ready for the next parcel", () => {
  it("is not disabled while a scan is in flight", () => {
    const start = scanInput.indexOf("<Input");
    expect(start).toBeGreaterThan(-1);
    const input = scanInput.slice(start, scanInput.indexOf("/>", start));
    expect(input, "a disabled input loses focus and nothing gives it back")
      .not.toContain("disabled={isProcessing");
  });

  it("takes the focus back whenever the field becomes usable", () => {
    expect(scanInput).toContain("document.activeElement === inputRef.current");
  });

  it("blocks a repeated barcode, not the next parcel", () => {
    // A flat window dropped the second barcode of a fast operator silently:
    // the parcel was never verified and nothing said so.
    const body = slice(scanInput, "const handleSubmit", "onScan(value);", "handleSubmit");
    expect(body).toContain("lastScanValue.current");
    expect(body).toContain("isRepeat");
  });
});

/**
 * A tracking number identifies a parcel to the system. It does not identify
 * it to the man holding it: he has a box in his hands and a shelf of other
 * boxes, and what tells him which is which is the picture and the order it
 * belongs to.
 */
describe("the scanner shows what identifies the box to a person", () => {
  const manifest = () =>
    slice(packagesDb, "export async function getBatchManifest", END_OF_FN, "getBatchManifest");
  const scanner = read("client/src/pages/ArrivalVerificationScanner.tsx");

  it("resolves the order by both routes a parcel can be linked", () => {
    // The link table and the legacy tracking column. Reading only one leaves
    // half the orders looking unlinked.
    const body = manifest();
    expect(body).toContain("packageOrderLinks");
    expect(body).toContain("fullPackageOrders.trackingNumber");
  });

  it("prefers the ordered product's picture over the parcel's own", () => {
    // The product image is what the customer chose and what the box should
    // contain; the parcel photo is what the China warehouse saw.
    expect(manifest()).toContain("order?.productImage ?? ownPhoto");
  });

  it("asks once per batch, not once per parcel", () => {
    // A container is two hundred boxes and this screen opens with it on the
    // floor already.
    expect(scanner).toContain("packages.batchManifest.fetch({ batchId })");
    expect(scanner, "back to a lookup per parcel").not.toContain("packages.list.fetch({ batchId");
  });

  it("shows the order and the picture in both lists", () => {
    // The missing list matters most: those are the boxes somebody has to go
    // and find.
    const missing = slice(scanner, 'TabsContent value="unverified"', 'TabsContent value="verified"', "missing list");
    expect(missing).toContain("ParcelThumb");
    expect(missing).toContain("pkg.orderCode");
    const verified = slice(scanner, 'TabsContent value="verified"', "verifiedAt.toLocaleTimeString", "verified list");
    expect(verified).toContain("ParcelThumb");
    expect(verified).toContain("pkg.orderCode");
  });

  it("falls back to an outline rather than a broken image", () => {
    const body = slice(scanner, "function ParcelThumb", "// ==================== MAIN", "ParcelThumb");
    expect(body).toContain("photo ?");
    expect(body).toContain("<Package");
  });
});
