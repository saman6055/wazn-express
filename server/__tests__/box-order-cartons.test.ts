import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * An order carton at the box reads its order (box-money defects 1 and 2;
 * owner's ledger audit, 2026-09-16).
 *
 * Proven on a scratch MySQL with the real writers, before and after:
 * - a commission order ($80 goods charged at entry, $30 advance, $7.50
 *   freight under the order id) in its carton: the box asked $87.50 and its
 *   receipt would have posted $87.50 more; now it asks $57.50, posts no
 *   charge, and the account ends at $0;
 * - a $100 full-package order that arrived in two cartons in one box: the
 *   box asked $200 and would have posted $200 more; now $100, nothing
 *   posted, account $0;
 * - every other simulated box read the same before and after.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

const settle = read("server/db/boxSettlement.db.ts");

describe("an order carton reads its order", () => {
  const sums = slice(settle, "async function parcelsForItems", "export async function getBoxesPaidInFull");

  it("knows a carton when it sees one", () => {
    expect(sums).toContain('const fromOrder = r.item.itemType !== "regular" || orderId !== null;');
  });

  it("finds its orders the way the receipt does: named on the item, or on its tracking", () => {
    expect(sums).toContain("inArray(fullPackageOrderTrackings.trackingNumber, cartonTrackings)");
    expect(sums).toContain("inArray(fullPackageOrders.trackingNumber, cartonTrackings)");
    // …and only this customer's.
    expect(sums).toContain("Number(o.customerId) === customerOfBox.get(boxId)");
  });

  it("counts the goods, the freight and their corrections from the order's rows", () => {
    expect(sums).toContain('["full_package", "commission", "purchase_request", "package"]');
    expect(sums).toContain('row.referenceType === "package" && !String(row.description ?? "").includes(order.orderCode)');
  });

  it("counts each order once per box, however many cartons it came in", () => {
    expect(sums).toContain("const claim = `${boxId}|${o.id}`;");
    expect(sums).toContain("if (claimedInBox.has(claim)) continue;");
  });

  it("takes off the advance, by the shared rule the receipt uses", () => {
    expect(sums).toContain("orderAdvancePaidUsd(o as unknown as AdvanceSource)");
    expect(sums).toContain("const settledUsd = round2((settledByItem.get(Number(r.item.id)) ?? 0) + advanceUsd);");
  });
});

describe("a box receipt never charges an order as a parcel", () => {
  const create = slice(settle, "export async function createBoxSettlement", "async function postDiscountCredits");

  it("leaves order cartons out of what it charges", () => {
    expect(create).toContain("const toCharge = parcels.filter((p) => p.packageId !== null && !p.fromOrder && p.notChargedYet && settling(p));");
  });

  it("sends a price correction to the order instead of dropping it", () => {
    expect(create).toContain("if (parcel.fromOrder) {");
    expect(create).toContain("لەسەر ئۆردەرەکەیەتی");
    expect(create).toContain("نرخەکەی لەوێ ڕاست بکەرەوە، بە هۆکارەوە");
  });

  it("the payment panel says why a carton asks for less than its price", () => {
    const panel = read("client/src/components/delivery/BoxSettlementPanel.tsx");
    expect(panel).toContain("parcel.advanceUsd > 0");
  });
});
