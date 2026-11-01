/**
 * The portal's lists carry photo links, not photos (2026-10-30).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { findPhoto, linkOrderPhotos, linkParcelPhotos, photoHash } from "./lib/portalImages";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("photos in a list become links", () => {
  it("an order's photo is a link named by its content; the same photo is the same link", () => {
    const o = linkOrderPhotos({ id: 7, productImage: JPEG, productImages: [JPEG, PNG], productName: "x" });
    expect(o.productImage).toBe(`/api/portal/img/o/7/${photoHash(JPEG)}`);
    expect(o.productImages[0]).toBe(o.productImage);
    expect(o.productImages[1]).toBe(`/api/portal/img/o/7/${photoHash(PNG)}`);
    expect(o.productName).toBe("x");
  });

  it("an uploaded photo (already a link), an empty one and an SVG are left alone", () => {
    const svg = "data:image/svg+xml;base64,PHN2Zz4=";
    const p = linkParcelPhotos({ id: 3, photos: ["/uploads/a.jpg", "", svg, null] });
    expect(p.photos).toEqual(["/uploads/a.jpg", "", svg, null]);
    expect(linkOrderPhotos({ id: 1, productImage: null }).productImage).toBeNull();
  });

  it("the route finds the photo the link names, and nothing else", () => {
    expect(findPhoto([JPEG, [PNG]], photoHash(PNG))).toBe(PNG);
    expect(findPhoto([JPEG], "0000000000000000")).toBeNull();
  });
});

describe("wired where the portal polls", () => {
  it("every list of parcels or orders sends links", () => {
    const r = read("server/routers/portal.router.ts");
    expect(r).toContain("return linkParcelsPhotos(await db.getCustomerVisiblePackages(customerId));");
    expect(r).toContain("return linkOrdersPhotos(toCustomerVisibleOrders(orders as any[]));");
    expect(r).toContain("linkParcelsPhotos(await db.getCustomerPackagesInBatch(");
  });

  it("the route is served by both entry points, to the owner only", () => {
    for (const f of ["server/_core/index.ts", "server/_core/prod-entry.ts"]) expect(read(f)).toContain("registerPortalImageRoute(app);");
    const lib = read("server/lib/portalImages.ts");
    expect(lib.split("Number(row.customerId) !== Number(user.id)").length - 1).toBe(2);
  });
});
