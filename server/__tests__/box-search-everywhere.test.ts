import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule (Sep 2026): searching the delivery boxes looks everywhere.
 *
 * The chips narrow the list to a slice — unpaid, new, old, handed over, or
 * the archive — and the search ran inside whichever slice happened to be
 * showing. So a parcel sitting in a box that had been paid for and archived
 * could not be found from the list somebody was standing on. A person typing
 * a tracking number is asking "where is this?", not "is this in the slice I
 * am looking at".
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  const out = src.slice(start, end);
  expect(out.length, "slice is empty").toBeGreaterThan(50);
  return out;
}

describe("a search is not narrowed by the chip above it", () => {
  const dbsrc = read("server/db/deliveryBoxes.db.ts");
  const list = slice(dbsrc, "export async function getAllDeliveryBoxes", "const boxes = await db.select().from(deliveryBoxes)");

  it("the archive filter stands down while searching", () => {
    expect(list).toContain("const isSearching = Boolean(filters?.search && filters.search.trim());");
    expect(list).toContain("if (!isSearching) {");
    // Neither half of the archive filter may run unguarded any more.
    expect(list).not.toMatch(/^\s{2}if \(filters\?\.archive === "exclude"\) conditions\.push/m);
  });

  it("the slice chips stand down too", () => {
    expect(list).toContain('if (!isSearching && filters?.archive === "exclude" && filters.segment)');
  });

  it("the chip counts still describe the search, not the whole table", () => {
    // baseWhere is taken BEFORE the archive condition, so it carries the
    // search, status and dates — the counts say how matches are spread.
    const baseAt = list.indexOf("const baseWhere =");
    const guardAt = list.indexOf("const isSearching =");
    expect(baseAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(baseAt);
  });
});

describe("what a search actually looks at", () => {
  const dbsrc = read("server/db/deliveryBoxes.db.ts");
  const list = slice(dbsrc, "export async function getAllDeliveryBoxes", "Which boxes are archived");

  it("the box, the parcels inside it, and the customer it belongs to", () => {
    for (const field of [
      "deliveryBoxes.boxCode",
      "deliveryBoxes.destinationCity",
      "deliveryBoxes.recipientName",
      "deliveryBoxItems.trackingNumber",
      "deliveryBoxItems.packageCode",
      "customers.customerCode",
      "customers.fullName",
    ]) {
      expect(list, field).toContain(field);
    }
  });
});

describe("the screen explains why a paid box turned up", () => {
  const page = read("client/src/pages/CustomerDeliveryScanner.tsx");

  it("it says the search spans everything", () => {
    expect(page).toContain("const isSearching = Boolean(filters.search && filters.search.trim());");
    expect(page).toContain("{isSearching && (");
    expect(page).toContain("گەڕان لە هەموو بۆکسەکاندا دەگەڕێت");
  });

  it("every row still carries what it was paid, so a result can be read", () => {
    const dbsrc = read("server/db/deliveryBoxes.db.ts");
    expect(dbsrc).toContain("settlementCleared: settledByBox.has(b.id)");
    expect(dbsrc).toContain("settledUsd: settledByBox.get(b.id) ?? 0,");
  });
});
