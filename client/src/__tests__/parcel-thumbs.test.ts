import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-19: «لە هەموو پاکەتەکان وێنەش نیشان بدات». A picture on each
 * row - without the list carrying pictures again (2026-09-25, it made the
 * screen heavy): one thumbnails request for the page.
 */
describe("the parcels list shows a picture on each row", () => {
  const page = read("client/src/pages/Packages.tsx");

  it("one request for the page, a square on the row and on the phone card", () => {
    expect(page).toContain("<ParcelThumbs ids={routedPackages.map((p) => p.id)}>");
    expect(page.split('<ParcelThumb id={pkg.id} alt={pkg.trackingNumber ?? ""} />').length - 1).toBe(2);
  });

  it("the list itself still carries no pictures", () => {
    const list = read("server/db/packages.db.ts");
    const start = list.indexOf("export async function getAllPackages");
    const select = list.slice(start, list.indexOf(".from(packages)", start));
    expect(select.length).toBeGreaterThan(200);
    expect(select).not.toContain("photos: packages.photos");
    expect(select).not.toContain("productImage:");
  });

  it("the order's photo first, then the depot's, shrunk once on the server", () => {
    const router = read("server/routers/packages.router.ts");
    expect(router).toContain("order: [json(row.productImages), row.productImage],");
    expect(router).toContain("warehouse: json(row.photos),");
    expect(router).toContain("const made = cachedThumbnail(key);");
  });
});
