import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The bin says whose each box and order was (owner, 2026-09-17, with a
 * screenshot of the bin: "the customer code isn't with the box, I don't know
 * which is whose"), what a deleted box held, and when a box had already lost
 * its parcels before it was deleted. The reading rules are unit-tested in
 * shared/trash.test.ts; this pins the wiring from the database to the card.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the bin's list carries the owner", () => {
  const db = read("server/db/trash.db.ts");
  const start = db.indexOf("export async function listTrash");
  const end = db.indexOf("\n}\n", start);
  const list = db.slice(start, end);

  it("reads a deleted box's snapshot, and an order's customer, then their codes and names in one query", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(list).toContain('if (r.entityType === "delivery_box") boxFacts.set(r.id, deliveryBoxSnapshotFacts(r.snapshot));');
    expect(list).toContain("customerId: fullPackageOrders.customerId,");
    expect(list).toContain(".where(inArray(customers.id, customerIds));");
    expect(list).toContain("{ ...ownerOf(facts.customerId), parcelCount: facts.parcelCount, recordedParcels: facts.recordedParcels }");
    expect(list).toContain("...ownerOf(o.customerId),");
    expect(list).not.toMatch(/\.(insert|update|delete)\(/);
  });
});

describe("the card shows it", () => {
  const page = read("client/src/pages/Trash.tsx");

  it("the customer's code and name, and what the box held", () => {
    expect(page).toContain('<bdi dir="ltr" className="font-mono font-semibold">{item.customerCode}</bdi>');
    expect(page).toContain('{item.customerName && <span className="font-medium">{item.customerName}</span>}');
    expect(page).toContain("{item.parcelCount === 0");
  });

  it("a warning on a box that had already lost its parcels", () => {
    expect(page).toContain("{boxLostItsParcels(item) && (");
  });

  it("and a search by the customer finds it", () => {
    expect(page).toContain('(item.customerCode ?? "").toLowerCase().includes(q)');
    expect(page).toContain('(item.customerName ?? "").toLowerCase().includes(q)');
  });
});
