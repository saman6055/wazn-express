import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { orderDisplayTotal } from "./lib/portalOrderPrice";
import { getBatchEta } from "./lib/batchEta";

/**
 * The number on the screen is the number the office means.
 *
 * Phase-two audit (2026-09-10): an order card headlined the unit price while
 * the ledger posted unit × quantity; shipment-invoice rows read "0 parcels"
 * because they asked for fields that do not exist; the date chips filtered
 * nothing; credit was "+$50" on one screen and "-$50" on the next; a batch in
 * the Erbil depot still showed a future arrival date.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

describe("an order shows what it is charged", () => {
  it("an agreed-price order is the unit price × quantity", () => {
    expect(orderDisplayTotal({ orderType: "full_package", sellingPriceUsd: "52.00", quantity: 3 })).toBe(156);
    expect(orderDisplayTotal({ orderType: "purchase_request", sellingPriceUsd: 10.1, quantity: 3 })).toBe(30.3);
  });

  it("a commission order is its stored total, which already includes quantity and fee", () => {
    expect(orderDisplayTotal({ orderType: "commission", totalPrepaidUsd: "105.00", sellingPriceUsd: "35.00", quantity: 3 })).toBe(105);
  });

  it("nothing priced yet is null, so the screen prints a dash, not $0.00", () => {
    expect(orderDisplayTotal({ orderType: "full_package", sellingPriceUsd: null, quantity: 2 })).toBeNull();
    expect(orderDisplayTotal({ orderType: "commission", totalPrepaidUsd: "" })).toBeNull();
  });

  it("is what the orders card and dialog print", () => {
    const page = read("pages/portal/PortalFullPackage.tsx");
    expect(page.match(/formatPrice\(orderDisplayTotal\(/g)?.length).toBe(2);
    expect(page).not.toContain('ku: "نرخی کڕین", en: "Purchase Price"');
  });
});

describe("the money page reads the fields the server sends", () => {
  const page = read("pages/portal/PortalFinancial.tsx");

  it("shipment-invoice rows use this customer's own parcel count and size", () => {
    expect(page).toContain("Number(b.customerPackageCount ?? 0)");
    expect(page).not.toMatch(/myPackageCount|myWeightKg|myVolumeCbm/);
  });

  it("the date chips filter the list they sit above", () => {
    expect(page).toContain("const shownTransactions = useMemo(");
    expect(page).toContain("{shownTransactions.map((tx) => {");
  });

  it("credit carries no sign; the words say which way it sits", () => {
    expect(page).not.toContain('{isCredit ? "-" : ""}');
    expect(read("pages/portal/PortalHome.tsx")).not.toContain("+{balanceText}");
  });
});

describe("an estimate is never shown for goods already in Iraq", () => {
  const departed = { shippingType: "air_regular", departureDate: "2026-09-01T00:00:00Z" };

  it("still estimates while the shipment is on the road", () => {
    expect(getBatchEta({ ...departed, status: "in_transit" })).not.toBeNull();
  });

  for (const status of ["arrived", "customs", "at_depot", "delivered", "closed"]) {
    it(`shows no arrival estimate once it is ${status}`, () => {
      expect(getBatchEta({ ...departed, status })).toBeNull();
    });
  }
});

describe("labels describe the number beside them", () => {
  it("the profile's delivered count is called delivered", () => {
    expect(read("pages/portal/PortalProfile.tsx")).toContain('ku: "پاکەتی گەیشتوو", en: "Delivered"');
  });
});
