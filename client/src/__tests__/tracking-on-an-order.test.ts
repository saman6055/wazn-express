import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { looksLikeTracking } from "./components/packages/TrackingOnAnOrder";

/**
 * A tracking the parcels list cannot find leads to its order (owner,
 * 2026-10-15: "why does the system not show it? I want to look into each
 * tracking's state one by one"). What would undo it: the panel leaving
 * either empty state, the lookup matching by case or by a fragment, or the
 * order's price worked out by a second rule.
 */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the parcels list asks the orders when it finds nothing", () => {
  const page = read("client/src/pages/Packages.tsx");

  it("on the phone and on the desktop alike", () => {
    expect(page.split("<TrackingOnAnOrder search={searchInput} />").length - 1).toBe(2);
  });

  it("only for something that looks like one tracking", () => {
    expect(looksLikeTracking("YT7602474897157")).toBe(true);
    expect(looksLikeTracking("bag")).toBe(false);
    expect(looksLikeTracking("Zainab Saeed")).toBe(false);
  });
});

describe("the lookup", () => {
  const db = read("server/db/ordersByTracking.db.ts");

  it("matches the whole tracking whatever its case, in both places an order keeps one", () => {
    expect(db).toContain("LOWER(${fullPackageOrderTrackings.trackingNumber}) = LOWER(${term})");
    expect(db).toContain("LOWER(${fullPackageOrders.trackingNumber}) = LOWER(${term})");
    expect(db).not.toContain("like(");
  });

  it("prices an order by the one rule every order is charged by", () => {
    expect(db).toContain("computeOrderChargeAmount(");
  });

  it("says whether a parcel exists after all, and never sends a picture", () => {
    expect(db).toContain("parcelRegistered: Boolean(parcel)");
    expect(db).not.toContain("productImage");
  });

  it("is open to the staff who search the list", () => {
    expect(read("server/routers/fullPackage.router.ts")).toContain("ordersByTracking: staffProcedure");
  });
});
