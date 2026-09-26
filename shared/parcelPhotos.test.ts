import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { customerPhotos, firstPhotoSource, photoList } from "./parcelPhotos";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

const ORDER = "/uploads/order-shop.jpg";
const DEPOT = "/uploads/depot-sack.jpg";
const MINE = "/uploads/customer-sent.jpg";

describe("the picture a customer meets first", () => {
  it("is the one attached when the order was entered", () => {
    // The owner, 2026-09-26: the visible photo must be the order's own, not
    // the quick-register shot. It is the picture they chose and recognise.
    const sets = { order: ORDER, warehouse: [DEPOT], declared: [MINE] };
    expect(customerPhotos(sets)[0]).toBe(ORDER);
    expect(firstPhotoSource(sets)).toBe("product");
  });

  it("keeps the depot shot right behind it, never hidden", () => {
    expect(customerPhotos({ order: ORDER, warehouse: [DEPOT] })).toEqual([ORDER, DEPOT]);
  });

  it("starts at the depot shot when there is no order behind the parcel", () => {
    // An ordinary self-order parcel behaves exactly as it always did.
    const sets = { warehouse: [DEPOT] };
    expect(customerPhotos(sets)).toEqual([DEPOT]);
    expect(firstPhotoSource(sets)).toBe("warehouse");
  });

  it("counts a picture once, however many columns carry it", () => {
    expect(photoList(ORDER, [ORDER, DEPOT], " " + DEPOT + " ")).toEqual([ORDER, DEPOT]);
    expect(customerPhotos({ order: [ORDER], warehouse: [ORDER] })).toEqual([ORDER]);
  });

  it("says nothing rather than something, when there is nothing", () => {
    expect(customerPhotos({})).toEqual([]);
    expect(firstPhotoSource({})).toBeNull();
    expect(photoList(null, undefined, 7, {}, [[""]])).toEqual([]);
  });
});

describe("the portal asks this, rather than each screen deciding", () => {
  it("in the thumbnail every screen draws", () => {
    const thumb = read("client/src/components/portal/PackageThumb.tsx");
    expect(thumb).toContain('from "@shared/parcelPhotos"');
    const resolve = thumb.slice(thumb.indexOf("const resolve ="), thumb.indexOf("return { resolve }"));
    expect(resolve.length).toBeGreaterThan(20);
    expect(resolve).toContain("customerPhotos(sets)");
    // The old chain led with the warehouse shot; nothing may lead with it now.
    expect(resolve).not.toContain('source: "warehouse", urls: photos');
  });

  it("in the bill, where the pictures are the evidence", () => {
    const billing = read("client/src/components/portal/OrderBillingGroups.tsx");
    expect(billing).toContain("customerPhotos({");
    expect(billing).toContain("order:");
  });

  it("and in the photos a tap opens on the shipment page", () => {
    const detail = read("client/src/pages/portal/PortalBatchDetail.tsx");
    expect(detail).toContain("resolvePackageImage(selectedPkg as never).urls");
  });
});
