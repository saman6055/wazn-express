/**
 * The box decides, the batch is logistics (owner, 2026-10-27).
 *
 * Closing old batches on 27/10 wrote $417 of "deferred" freight onto 30
 * commission orders - $209 of it on cartons whose box had been receipted
 * weeks before, because the old receipts never marked the order's freight as
 * taken. A batch now asks the box first: goods in a box its receipt closed
 * are never charged by the batch - not goods, not freight, not a parcel.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("a batch never charges what a box receipt closed", () => {
  const batches = read("server/routers/batches.router.ts");
  const settle = read("server/db/boxSettlement.db.ts");

  it("one rule says which goods a receipt closed: the same closed-box rule as the till", () => {
    expect(settle).toContain("export async function goodsInReceiptedBoxes(");
    const fn = settle.slice(settle.indexOf("export async function goodsInReceiptedBoxes("), settle.indexOf("`raw`: the parcels as the ledger alone reads them"));
    expect(fn).toContain("await boxesClosedByReceipt(db,");
    expect(fn).toContain("inArray(deliveryBoxItems.fullPackageOrderId, orderIds)");
    expect(fn).toContain("inArray(deliveryBoxItems.packageId, packageIds)");
    expect(fn).toContain("inArray(deliveryBoxItems.trackingNumber, trackings)");
  });

  it("commission and full-package orders are taken out before anything is written", () => {
    const cm = batches.slice(batches.indexOf("async function emitCmInvoices("), batches.indexOf("for (const [customerId, cmItems] of Array.from(buckets.entries())) {"));
    expect(cm.length).toBeGreaterThan(0);
    expect(cm).toContain('await dropReceiptedGoods(buckets, "CM");');
    const fp = batches.slice(batches.indexOf("async function emitFpInvoices("), batches.indexOf("async function emitCmInvoices("));
    expect(fp.length).toBeGreaterThan(0);
    expect(fp).toContain('await dropReceiptedGoods(buckets, "FP");');
  });

  it("an own parcel receipted in a box is not charged by its batch either", () => {
    const parcels = batches.slice(batches.indexOf("const unchargedPackages: typeof customerPackages = [];"), batches.indexOf("unchargedPackages.push(pkg);"));
    expect(parcels).toContain("const heldByBox = await db.goodsInReceiptedBoxes({");
    expect(parcels).toContain("if (heldByBox.packageIds.has(Number(pkg.id))) {");
  });
});
