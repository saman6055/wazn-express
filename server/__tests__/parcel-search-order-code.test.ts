import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/** Owner, 2026-10-21: «CM-MTVGC8UN» found nothing in All Packages. */
describe("the parcel list finds a parcel by its order's system number", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "db/packages.db.ts"), "utf8").replace(/\r\n/g, "\n");
  const fn = src.slice(src.indexOf("export async function getAllPackages"), src.indexOf("if (status && status !== 'all')"));

  it("by the shop's number, the system's and the supplier's", () => {
    expect(fn.length).toBeGreaterThan(500);
    expect(fn).toContain("like(fullPackageOrders.orderCode, searchTerm),");
    expect(fn).toContain("like(fullPackageOrders.orderNumber, searchTerm),");
    expect(fn).toContain("like(fullPackageOrders.supplierOrderNumber, searchTerm),");
  });

  it("and the parcels that reach the order only through its tracking", () => {
    expect(fn).toContain("orConditions.push(inArray(packages.trackingNumber, orderTrackings));");
  });
});
