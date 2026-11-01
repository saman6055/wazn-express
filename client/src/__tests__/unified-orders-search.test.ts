import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The one place that searches every order, full package and buy-at-cost
 * (owner, 2026-10-16). It looked only at the newest orders the page had
 * loaded, by name and first tracking, so an order six months old was never
 * found. What would undo it: the search going back to filtering what is on
 * the page, or the server's search losing a place an order keeps a tracking.
 */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", p), "utf8").replace(/\r\n/g, "\n");

describe("searching all orders", () => {
  const page = read("client/src/pages/UnifiedOrdersDashboard.tsx");

  it("asks the server, over every order, once three letters are typed", () => {
    expect(page).toContain("trpc.fullPackage.list.useQuery(\n    { search: searchTerm },");
    expect(page).toContain("const searching = searchTerm.length >= 3;");
    expect(page).toContain("const fullPackageOrders = searching ? foundOrders : recentOrders;");
  });

  it("does not throw away what the server found", () => {
    expect(page).toContain("const matchesSearch = !q || searching ||");
  });

  it("the server's search reaches every tracking, the codes, the platform number and the customer", () => {
    const db = read("server/db/fullPackage.db.ts");
    const from = db.indexOf("if (filters?.search) {");
    const block = db.slice(from, db.indexOf("conditions.push(or(...orConditions));", from));
    expect(block.length).toBeGreaterThan(500);
    for (const needle of [
      "like(fullPackageOrderTrackings.trackingNumber, searchTerm)",
      "like(fullPackageOrders.trackingNumber, searchTerm)",
      "like(fullPackageOrders.orderCode, searchTerm)",
      "like(fullPackageOrders.orderNumber, searchTerm)",
      "like(customers.customerCode, searchTerm)",
    ]) expect(block, needle).toContain(needle);
  });
});
