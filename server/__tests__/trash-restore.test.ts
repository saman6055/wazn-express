import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import { batches, deliveryBoxItems, deliveryBoxes } from "../drizzle/schema";
import { snapshotRowForInsert } from "./db/trash.db";

/**
 * What goes into the bin comes out whole (owner, 2026-09-17).
 *
 * BOX-20260719-003 was listed as empty while its record counted 4 parcels:
 * restored from the bin, the box went back in and its parcels did not. The
 * bin keeps rows as JSON, dates come back as text, and restoring revived only
 * a hand-written list of date names — a parcel's scannedAt was not on it, so
 * inserting the parcels threw after the box row was already back.
 */

const db = drizzle.mock();
const asStored = (row: Record<string, unknown>) => JSON.parse(JSON.stringify(row)) as Record<string, unknown>;

/** A row with every date column of the table set, as the bin would keep it. */
function everyDateSet(table: MySqlTable, base: Record<string, unknown>) {
  const row: Record<string, unknown> = { ...base };
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (column.dataType === "date") row[key] = new Date("2026-07-19T10:15:00Z");
  }
  return asStored(row);
}

const item = {
  id: 9001, boxId: 77, packageId: 501, fullPackageOrderId: null, trackingNumber: "YT7580012345678", packageCode: "PKG-501",
  description: "Phone case", weightKg: "0.400", calculatedCostUsd: "2.45", itemType: "regular", sourceInfo: null, scannedById: 3,
  // What the screen added, which the bin keeps too.
  advanceAppliedUsd: "0", orderNote: null, orderNumbers: ["4312889013367452"], productImage: null, volumeCbm: null, shippingType: "air_regular",
};
const box = {
  id: 77, boxCode: "BOX-20260719-003", customerId: 125, batchId: 12, deliveryMethod: "city_transfer", totalPackages: 4,
  totalWeightKg: "3.200", totalValueUsd: "9.82", status: "ready", isCharged: false, createdById: 1,
};
const batch = { id: 12, batchCode: "AIR-0719", status: "delivered" };

describe("a row from the bin goes back in", () => {
  it("was broken: a parcel's date as text made the insert throw", () => {
    expect(() => db.insert(deliveryBoxItems).values(asStored({ ...item, scannedAt: new Date() }) as any).toSQL()).toThrow();
  });

  it("a box's parcels, with every date", () => {
    const row = snapshotRowForInsert(deliveryBoxItems, everyDateSet(deliveryBoxItems, item));
    expect(row.scannedAt).toBeInstanceOf(Date);
    expect(() => db.insert(deliveryBoxItems).values(row as any).toSQL()).not.toThrow();
  });

  it("a sealed box, with every date", () => {
    const row = snapshotRowForInsert(deliveryBoxes, everyDateSet(deliveryBoxes, box));
    expect(row.sealedAt).toBeInstanceOf(Date);
    expect(() => db.insert(deliveryBoxes).values(row as any).toSQL()).not.toThrow();
  });

  it("a batch, with every date", () => {
    const row = snapshotRowForInsert(batches, everyDateSet(batches, batch));
    expect(row.flightArrivedAt).toBeInstanceOf(Date);
    expect(() => db.insert(batches).values(row as any).toSQL()).not.toThrow();
  });

  it("only the table's own columns, and the values as they were", () => {
    const row = snapshotRowForInsert(deliveryBoxItems, asStored({ ...item, scannedAt: new Date("2026-07-19T10:15:00Z") }));
    expect(Object.keys(row).every((key) => key in getTableColumns(deliveryBoxItems))).toBe(true);
    expect(row).not.toHaveProperty("orderNumbers");
    expect(row).not.toHaveProperty("advanceAppliedUsd");
    expect(row.calculatedCostUsd).toBe("2.45");
    expect(row.fullPackageOrderId).toBeNull();
    expect((row.scannedAt as Date).toISOString()).toBe("2026-07-19T10:15:00.000Z");
  });
});

describe("a box comes back with its parcels or not at all", () => {
  const source = fs.readFileSync(path.join(__dirname, "db/trash.db.ts"), "utf8").replace(/\r\n/g, "\n");
  const slice = (start: string) => {
    const a = source.indexOf(start);
    expect(a, start).toBeGreaterThan(-1);
    const b = source.indexOf("\n}\n", a);
    expect(b).toBeGreaterThan(a);
    return source.slice(a, b);
  };

  it("one transaction, both rows through the reviver", () => {
    const restore = slice("export async function restoreDeliveryBoxFromSnapshot");
    expect(restore).toContain("await db.transaction(async (tx) => {");
    expect(restore).toContain("tx.insert(deliveryBoxes).values(snapshotRowForInsert(deliveryBoxes, box)");
    expect(restore).toContain("tx.insert(deliveryBoxItems).values(items.map((item) => snapshotRowForInsert(deliveryBoxItems, item))");
  });

  it("no hand-written list of dates is left to fall behind the tables", () => {
    expect(source).not.toMatch(/const dates = \[/);
    expect(slice("export async function restoreBatchFromSnapshot")).toContain("snapshotRowForInsert(batches, snapshot)");
  });
});
