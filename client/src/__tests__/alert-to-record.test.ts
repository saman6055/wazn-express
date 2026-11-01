import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * From an alert to the record that can answer it, in one click.
 *
 * The owner, 2026-09-21, looking at the "still in the China warehouse" card:
 * "when it says these have not been sent, clicking should go straight to the
 * same parcel that has the problem — whether it belongs to buy-at-cost, or a
 * full package, or the customer's own list. Make it easy."
 *
 * The address is decided once (shared/parcelSource) and the server sends the
 * order with the alert, so the card, the sheet and the order number on the
 * row all lead to the same place.
 *
 * What would undo it: a screen building the href itself, the server dropping
 * the order, or a number rendered as plain text where the order is known.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the server sends the order with the alert", () => {
  const db = readRoot("server/db/packages.db.ts");
  const helper = readRoot("server/db/orderNumbers.db.ts");

  it("asks once for every parcel in the list, not once per parcel", () => {
    expect(helper).toContain("export async function orderSourcesForPackages(");
    expect(helper).toContain("inArray(fullPackageOrders.id, cleanIds(allOrderIds))");
    expect(helper).toContain("isNull(fullPackageOrders.deletedAt)");
    expect(helper, "read-only").not.toMatch(/orderSourcesForPackages[\s\S]*?\.(insert|update|delete)\(/);
  });

  it("with the stuck parcels and the volumetric ones alike", () => {
    expect((db.match(/orderSourcesForPackages\(ids\)/g) ?? []).length).toBe(2);
    expect(db).toContain("orders: sources.get(r.id) ?? [],");
    expect(db).toContain("parcel.orders = sources.get(parcel.id) ?? [];");
  });

  it("carries which kind of order it is, so the link knows where to go", () => {
    expect(helper).toContain("orderType: fullPackageOrders.orderType,");
    expect(helper).toContain("orderCode: fullPackageOrders.orderCode,");
    expect(helper).toContain('orderType: (row.orderType ?? "full_package") as ParcelOrderRef["orderType"],');
  });
});

describe("the parcel's own sheet", () => {
  const sheet = read("components/registrations/AlertParcelSheet.tsx");

  it("leads with the record the parcel lives in, and asks the shared rule where that is", () => {
    expect(sheet).toContain("const source = parcelSourceTarget(parcel?.orders, tracking);");
    expect(sheet).toContain("<Link\n                    href={source.href}");
    expect(sheet).toContain("{L(source.label)}");
    // Across the row and first: it is the way onward, not one of five.
    expect(sheet).toContain('"col-span-2 justify-center border-sky-300');
  });

  it("only offers it to somebody allowed on that screen", () => {
    expect(sheet).toContain('source.kind === "commission"\n      ? canViewPath("/commission")');
    expect(sheet).toContain('? canViewPath("/packages/all")');
    expect(sheet).toContain(': canViewPath("/full-package");');
    expect(sheet).toContain("{canSource && (");
  });

  it("keeps the parcels list and the customer page beside it", () => {
    expect(sheet).toContain("packagesHref({ search: tracking })");
    expect(sheet).toContain("`/customers/${parcel.customerId}`");
  });
});

describe("the order number on a row", () => {
  const component = read("components/OrderNumbers.tsx");

  it("is itself the door, when the order behind it is known", () => {
    expect(component).toContain('const order = (orders ?? []).find((o) => (o?.orderNumber ?? "").trim() === number);');
    expect(component).toContain("const href = order ? parcelSourceTarget([order]).href : null;");
    expect(component).toContain("{href ? (");
    // Without an order it stays exactly as it was: plain, copyable text.
    expect(component).toContain('<bdi dir="ltr" className="font-mono text-foreground">');
    expect(component).toContain("<CopyButton value={number} label={copy} className={copyClassName} />");
  });

  it("is given the orders by both alert cards and the sheet", () => {
    expect(read("components/registrations/StaleDepotCard.tsx")).toContain("orders={r.orders}");
    expect(read("components/registrations/VolumetricWatchCard.tsx")).toContain("orders={r.orders}");
    expect(read("components/registrations/AlertParcelSheet.tsx")).toContain("orders={parcel.orders}");
  });

  it("hands the sheet the orders it was given, not a copy of its own", () => {
    for (const card of ["StaleDepotCard", "VolumetricWatchCard"]) {
      expect(read(`components/registrations/${card}.tsx`), card).toContain("orders: open.orders ?? [],");
    }
  });
});
