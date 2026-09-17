import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The platform order number beside a parcel's tracking (owner, 2026-09-17).
 *
 * Buy-at-cost and full-package parcels are checked with the customer by the
 * order number on the shop's platform, so wherever staff see such a parcel's
 * tracking, that number sits next to it, copyable — and searching by it finds
 * the parcel.
 *
 * What would undo it: a screen dropping the number again, a carton with
 * several orders showing only one, or the server forgetting to send it.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("one way to show it", () => {
  const component = read("components/OrderNumbers.tsx");

  it("every number, each with its own copy button, nothing for a self order", () => {
    expect(component).toContain("{list.map((number) => (");
    expect(component).toContain("<CopyButton value={number} label={copy} className={copyClassName} />");
    expect(component).toContain("if (list.length === 0) return null;");
  });
});

describe("one way to find it", () => {
  const helper = readRoot("server/db/orderNumbers.db.ts");

  it("through the parcel's main order and every order in its carton, main first", () => {
    expect(helper).toContain("from(packageOrderLinks)");
    expect(helper).toContain("for (const main of mains) add(main.packageId, main.orderId);");
    expect(helper).toContain("sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))");
    expect(helper).toContain("isNull(fullPackageOrders.deletedAt)");
    expect(helper).not.toMatch(/\.(insert|update|delete)\(/);
  });
});

describe("the screens that show it", () => {
  it("the stuck-in-China card, under each tracking", () => {
    expect(read("components/registrations/StaleDepotCard.tsx")).toContain('<OrderNumbers numbers={r.orderNumbers} copyClassName="relative z-10" />');
  });

  it("the volumetric card", () => {
    expect(read("components/registrations/VolumetricWatchCard.tsx")).toContain(
      '<OrderNumbers numbers={r.orderNumbers} className="mt-1 flex" copyClassName="relative z-10" />',
    );
  });

  it("the parcel's details from either card", () => {
    const sheet = read("components/registrations/AlertParcelSheet.tsx");
    expect(sheet).toContain("<OrderNumbers numbers={parcel.orderNumbers} bare");
    expect(read("components/registrations/StaleDepotCard.tsx")).toContain("orderNumbers: open.orderNumbers,");
    expect(read("components/registrations/VolumetricWatchCard.tsx")).toContain("orderNumbers: open.orderNumbers,");
  });

  it("the registrations page, as cards and as a table", () => {
    const page = read("pages/Registrations.tsx");
    expect(page).toContain('<OrderNumbers numbers={row.order?.orderNumber} className="mt-1 flex text-[12px]" />');
    expect(page).toContain('<OrderNumbers numbers={r.order?.orderNumber} className="flex" />');
  });

  it("a parcel's own window on the all-parcels page", () => {
    expect(read("pages/Packages.tsx")).toContain("numbers={(viewPackage as any).platformOrderNumber || (viewPackage as any).supplierOrderNumber}");
  });
});

describe("the server sends it", () => {
  const db = readRoot("server/db/packages.db.ts");
  const slice = (start: string, end: string) => {
    const a = db.indexOf(start);
    expect(a, start).toBeGreaterThan(-1);
    const b = db.indexOf(end, a + start.length);
    expect(b, end).toBeGreaterThan(a);
    return db.slice(a, b);
  };

  it("with the stuck and the volumetric parcels", () => {
    expect(slice("export async function getStaleDepotPackages", "export type RegistrationPhoto")).toContain(
      "orderNumbers: numbers.get(r.id) ?? [],",
    );
    expect(slice("export async function getVolumetricParcels", "export async function acknowledgeVolumetric")).toContain(
      "parcel.orderNumbers = numbers.get(parcel.id) ?? [];",
    );
  });

  it("with every registration's order, and a search by it finds the parcel", () => {
    const registrations = slice("export async function getRegistrations", "\n}\n");
    expect(registrations).toContain("orderNumber: order.orderNumber?.trim() || null,");
    expect(registrations).toContain("row.order?.orderNumber,");
  });

  it("and the all-parcels search matches it too", () => {
    const list = slice("export async function getAllPackages", "if (status && status !== 'all')");
    expect(list).toContain("spo.orderNumber LIKE ${searchTerm}");
    expect(list).toContain("FROM ${packageOrderLinks} spl WHERE spl.packageId = ${packages.id}");
  });
});
