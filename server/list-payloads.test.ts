import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A list never carries what a list cannot show.
 *
 * The owner, 2026-09-25: "the buy-at-cost table loads very heavily, and when
 * you search the result comes back very late. Test the whole system this
 * time and fix the slowness — make every part fire and high speed."
 *
 * Two habits had made the screens heavy, and both are easy to fall back
 * into, so they are guarded here:
 *
 *  1. `SELECT *` on a table whose columns include a picture. Product photos
 *     and passport scans are base64 data URIs in TEXT and MEDIUMTEXT
 *     columns, up to a megabyte each. A list of three hundred rows was
 *     hundreds of megabytes on the wire to draw forty-pixel squares.
 *  2. A search box wired straight into a server query, so every keystroke
 *     was a round trip and a table scan.
 */

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function slice(source: string, from: string, to: string, what: string): string {
  const start = source.indexOf(from);
  expect(start, `${what}: "${from}" not found`).toBeGreaterThan(-1);
  const end = source.indexOf(to, start + from.length);
  expect(end, `${what}: "${to}" not found`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("the customer list", () => {
  const db = read("server/db/customers.db.ts");

  it("leaves the passport, the ID, the contract and the photo behind", () => {
    // Thirty-six screens read this list, nearly all of them to fill a
    // dropdown. Not one of them shows a document.
    const picked = slice(db, "const {", "} = getTableColumns(customers);", "the column list");
    for (const blob of ["photoUrl", "passportUrl", "nationalIdUrl", "contractUrl"]) {
      expect(picked, blob).toContain(blob);
    }
    const fn = slice(db, "export async function getAllCustomers", "\n}", "getAllCustomers");
    expect(fn).toContain("db.select(CUSTOMER_LIST_COLUMNS)");
    expect(fn).not.toContain("db.select().from(customers)");
  });

  it("takes them off the top rather than listing the rest", () => {
    // A column added next year must be carried automatically; only the ones
    // that must never be carried are named.
    expect(db).toContain("...CUSTOMER_LIST_COLUMNS\n} = getTableColumns(customers);");
  });
});

describe("the order lists", () => {
  const db = read("server/db/fullPackage.db.ts");
  const fn = slice(db, "export async function getAllFullPackageOrders", "export async function getOrderImagesByIds", "getAllFullPackageOrders");

  it("carry no pictures at all", () => {
    const picked = slice(db, "const {\n  productImage:", "} = getTableColumns(fullPackageOrders);", "the column list");
    for (const blob of ["productImage", "productImages", "purchaseInvoiceUrl"]) {
      expect(picked, blob).toContain(blob);
    }
    expect(fn).toContain("...ORDER_LIST_COLUMNS, hasImage: HAS_IMAGE");
  });

  it("say whether a row has one, without sending it", () => {
    expect(db).toContain("const HAS_IMAGE = sql<boolean>`(");
    expect(db).toContain("JSON_LENGTH(");
  });

  it("stop at a page", () => {
    expect(db).toContain("export const ORDER_LIST_LIMIT = 300;");
    expect(fn).toContain("await rows.limit(limit).offset(filters?.offset ?? 0)");
    // Reports still need everything, and say so.
    expect(fn).toContain("filters?.limit === 0 ? 0");
  });

  it("cap what a search may drag in behind it", () => {
    // The two lookups fed an IN (...) list. Uncapped, a search for one
    // letter matched every customer in the business.
    expect(fn).toContain("const MATCH_CAP = 200;");
    expect(fn.match(/\.limit\(MATCH_CAP\)/g) ?? []).toHaveLength(2);
  });

  it("read only the customer columns a row prints", () => {
    expect(fn).toContain("fullNameKurdish: customers.fullNameKurdish,");
    expect(fn).not.toContain("db.select().from(customers)");
  });
});

describe("the thumbnails the tables draw instead", () => {
  it("are shrunk once on the server and remembered", () => {
    const svc = read("server/services/orderThumbs.service.ts");
    expect(svc).toContain("const THUMB_PX = 96;");
    expect(svc).toContain("scaleToFit(THUMB_PX, THUMB_PX)");
    // Bounded: a screen left open all day must not grow the server by one
    // image per order ever looked at.
    expect(svc).toContain("const MAX_CACHED = 500;");
    expect(svc).toContain("cache.delete(oldest)");
    // A broken picture is a missing thumbnail, never a failed screen.
    expect(svc).toContain("} catch (err) {");
  });

  it("are asked for once per page of rows, not once per row", () => {
    const comp = read("client/src/components/orders/OrderThumb.tsx");
    expect(comp).toContain("trpc.fullPackage.thumbs.useQuery");
    expect(comp).toContain("orders.filter((o) => o.hasImage).map((o) => o.id)");
    expect(comp).toContain("enabled: ids.length > 0");
  });

  it("are what the three order tables use", () => {
    for (const screen of [
      "client/src/pages/CommissionOrders.tsx",
      "client/src/pages/FullPackageDashboard.tsx",
      "client/src/pages/CommissionDashboard.tsx",
    ]) {
      const src = read(screen);
      expect(src, screen).toContain("<OrderThumbs orders={");
      expect(src, screen).toContain("<OrderThumb order={order}");
      // …and none of them reaches for the full photo in a row any more.
      expect(src, screen).not.toContain("src={order.productImage}");
    }
  });
});

describe("the search boxes", () => {
  it("wait for the typing to stop", () => {
    for (const screen of [
      "client/src/pages/CommissionOrders.tsx",
      "client/src/pages/FullPackageDashboard.tsx",
      "client/src/pages/AuditLogs.tsx",
      "client/src/pages/PortalCenter.tsx",
      "client/src/pages/portal/PortalUnclaimedPackages.tsx",
    ]) {
      const src = read(screen);
      expect(src, screen).toContain("useDebouncedValue(");
      // The raw box value never reaches a server query again.
      expect(src, screen).not.toMatch(/search: search \|\| undefined/);
      expect(src, screen).not.toMatch(/search: searchTerm \|\| undefined/);
    }
  });
});

describe("the access paths those queries need", () => {
  const migrations = read("server/_core/migrations.ts");

  it("exist on a database that already has rows", () => {
    for (const idx of [
      "idx_fpo_type_created",
      "idx_fpo_created_at",
      "idx_delivery_box_items_box",
      "idx_delivery_box_items_package",
      "idx_delivery_box_items_order",
      "idx_delivery_box_items_tracking",
      "idx_box_settlement_lines_box_item",
    ]) {
      expect(migrations, idx).toContain(`CREATE INDEX ${idx} ON`);
    }
  });

  it("and on one that is brand new", () => {
    // A patch runs against a table that exists; a fresh database gets its
    // indexes from the CREATE, or never gets them at all.
    const create = slice(migrations, "CREATE TABLE IF NOT EXISTS deliveryBoxItems", "ENGINE=InnoDB", "the box items table");
    expect(create).toContain("INDEX idx_delivery_box_items_order (fullPackageOrderId)");
    expect(create).toContain("INDEX idx_delivery_box_items_tracking (trackingNumber)");
    // And drizzle says what the database has.
    expect(read("drizzle/schema/packages.schema.ts")).toContain('index("idx_delivery_box_items_tracking")');
    expect(read("drizzle/schema/fullPackage.schema.ts")).toContain('index("idx_fpo_type_created")');
    expect(read("drizzle/schema/finance.schema.ts")).toContain('index("idx_box_settlement_lines_box_item")');
  });
});
