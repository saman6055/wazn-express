import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Searching all parcels stays a question the database can answer quickly.
 *
 * The owner, 2026-09-21: "All parcels" had become very slow — a search gave
 * no answer, or gave one long after it was asked. The search had grown an
 * EXISTS on the platform order number (2026-09-17), and an EXISTS in the
 * where clause is run for every row it tests: `fullPackageOrders` was scanned
 * once per parcel for a LIKE with no index to help it, first to count the
 * matches and then again to fetch the page.
 *
 * Two small questions up front give the same answer once each, and the count
 * and the page are asked together rather than one after the other.
 */

const source = fs
  .readFileSync(path.join(__dirname, "db", "packages.db.ts"), "utf8")
  .replace(/\r\n/g, "\n");

const search = source.slice(source.indexOf("export async function getAllPackages"), source.indexOf("export async function getPackagesStats"));

describe("the parcel search", () => {
  it("asks about order numbers once, not once per parcel", () => {
    expect(search.length).toBeGreaterThan(500);
    expect(search, "an EXISTS here runs for every row of packages").not.toContain("EXISTS (");
    expect(search).toContain("const matchingOrders = await db.select({ id: fullPackageOrders.id })");
    expect(search).toContain("inArray(packages.fullPackageOrderId, matchingOrderIds)");
    expect(search).toContain("inArray(packages.id, linkedPackageIds)");
  });

  it("never builds an unbounded list out of a one-character search", () => {
    expect(source).toContain("const SEARCH_MATCH_LIMIT = 500;");
    // Three now: the customer lookup was the one still uncapped (2026-09-25).
    expect((search.match(/\.limit\(SEARCH_MATCH_LIMIT\)/g) ?? []).length).toBe(3);
  });

  it("counts the matches and reads the page at the same time", () => {
    expect(search).toContain("const [countResult, data] = await Promise.all([");
    const countAt = search.indexOf("db.select({ count: count() }).from(packages).where(whereClause)");
    const pageAt = search.indexOf("db.select({\n      id: packages.id,");
    expect(countAt).toBeGreaterThan(-1);
    expect(pageAt).toBeGreaterThan(countAt);
  });

  it("still finds a parcel by its own number, its code, its goods, its customer and its order number", () => {
    for (const part of [
      "like(packages.trackingNumber, searchTerm)",
      "like(packages.packageCode, searchTerm)",
      "like(packages.description, searchTerm)",
      "inArray(packages.customerId, matchingCustomerIds)",
      "like(fullPackageOrders.orderNumber, searchTerm)",
    ]) {
      expect(search, part).toContain(part);
    }
  });
});
