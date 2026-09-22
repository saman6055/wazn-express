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
    // Since 2026-09-21 a number whose order is known is also a link to it;
    // the shape is pinned in alert-to-record.test.ts.
    expect(component).toContain("{list.map((number) => {");
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
    expect(read("components/registrations/StaleDepotCard.tsx")).toContain('<OrderNumbers numbers={r.orderNumbers} orders={r.orders} copyClassName="relative z-10" />');
  });

  it("the volumetric card", () => {
    expect(read("components/registrations/VolumetricWatchCard.tsx")).toContain(
      '<OrderNumbers numbers={r.orderNumbers} orders={r.orders} className="mt-1 flex" copyClassName="relative z-10" />',
    );
  });

  it("the parcel's details from either card", () => {
    const sheet = read("components/registrations/AlertParcelSheet.tsx");
    expect(sheet).toContain("<OrderNumbers numbers={parcel.orderNumbers} orders={parcel.orders} bare");
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

  it("a box's parcels, and the box payment in both its states", () => {
    expect(read("components/delivery/BoxDetailPanel.tsx")).toContain('<OrderNumbers numbers={item.orderNumbers} className="flex font-sans" />');
    expect(read("components/delivery/BoxSettlementPanel.tsx")).toContain('<OrderNumbers numbers={parcel.orderNumbers} className="flex" />');
    expect(read("components/delivery/SettlementStates.tsx")).toContain('<OrderNumbers numbers={p.orderNumbers} className="flex font-sans" />');
  });

  it("a batch's parcels", () => {
    expect(read("pages/Batches.tsx")).toContain('<OrderNumbers numbers={pkg.orderNumbers} className="flex" />');
  });

  it("the arrival scanner, in the waiting and the checked lists", () => {
    const page = read("pages/ArrivalVerificationScanner.tsx");
    expect(page.split("<OrderNumbers numbers={pkg.orderNumbers} />").length - 1).toBe(2);
    // A parcel from outside the chosen batches has no manifest row: the scan brings its numbers.
    expect(page).toContain("package: { ...pkg, orderNumbers: result.orderNumbers },");
  });

  it("the batch scanner's list", () => {
    expect(read("components/scanner/ScannedList.tsx")).toContain('<OrderNumbers numbers={item.orderNumbers} className="flex" />');
    const page = read("pages/BatchAssignmentScanner.tsx");
    expect(page.split("orderNumbers: result.orderNumbers,").length - 1).toBe(2);
    expect(page).toContain("orderNumbers: p.orderNumbers,");
  });

  it("quick register: the found order copies it, the last registered and the sharing orders show it", () => {
    const page = read("pages/QuickRegister.tsx");
    expect(page).toContain("<CopyButton value={String(foundOrder.order.orderNumber)}");
    expect(page).toContain('<OrderNumbers numbers={lastRegistered.orderNumber} className="text-xs" />');
    expect(page).toContain("<OrderNumbers numbers={od.order.orderNumber} />");
  });

  it("bulk register's sharing orders", () => {
    expect(read("pages/BulkRegister.tsx")).toContain('<OrderNumbers numbers={od.order.orderNumber} className="text-[10px]" />');
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

  it("and the all-parcels search matches it too — by both routes to an order", () => {
    // Asked once each since 2026-09-21, not as an EXISTS run for every row of
    // packages, which is what made that search unusable — see
    // server/packages-search.test.ts.
    const list = slice("export async function getAllPackages", "if (status && status !== 'all')");
    expect(list).toContain("like(fullPackageOrders.orderNumber, searchTerm)");
    expect(list).toContain("inArray(packages.fullPackageOrderId, matchingOrderIds)");
    expect(list).toContain(".from(packageOrderLinks)");
    expect(list).toContain("inArray(packages.id, linkedPackageIds)");
  });

  it("with the arrival manifest, by both routes to an order", () => {
    const manifest = slice("export async function getBatchManifest", "\n}\n");
    expect(manifest.split("orderNumber: fullPackageOrders.orderNumber,").length - 1).toBe(2);
    expect(manifest).toContain("const numbersByPackage = await orderNumbersForPackages(packageIds);");
    expect(manifest).toContain("      orderNumbers,\n");
  });

  it("with a box's items, by both routes to an order", () => {
    const boxes = readRoot("server/db/deliveryBoxes.db.ts");
    expect(boxes).toContain("fpById.get(item.fullPackageOrderId)?.orderNumber");
    expect(boxes).toContain("(fpsByTracking.get(item.trackingNumber) || []).map((fp) => fp.orderNumber)");
    expect(boxes.split("orderNumbers, orderNote };").length - 1).toBe(3);
  });

  it("with the box payment view only — the paid verdict's lines stay as they are", () => {
    const settlement = readRoot("server/db/boxSettlement.db.ts");
    expect(settlement).toContain("parcels: await withParcelOrderNumbers(parcels),");
    const a = settlement.indexOf("async function parcelsForItems");
    expect(a).toBeGreaterThan(-1);
    const b = settlement.indexOf("\n}\n", a);
    expect(b).toBeGreaterThan(a);
    expect(settlement.slice(a, b)).not.toContain("orderNumbers");
  });

  it("with a batch's parcels and a scanned parcel", () => {
    expect(readRoot("server/routers/batches.router.ts")).toContain("return pkgs.map((p) => ({ ...p, orderNumbers: numbers.get(p.id) ?? [] }));");
    expect(readRoot("server/db/scanning.db.ts")).toContain("return { package: pkg, customer, orderNumbers: numbers.get(pkg.id) ?? [] };");
    const router = readRoot("server/routers/scanning.router.ts");
    expect(router).toContain("orderNumbers: result.orderNumbers,");
    expect(router).toContain("package: null, customer: null, orderNumbers: [] as string[] };");
  });
});
