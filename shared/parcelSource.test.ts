import { describe, expect, it } from "vitest";
import { mainOrderOf, parcelListHref, parcelSourceTarget, type ParcelOrderRef } from "./parcelSource";

/**
 * One click from an alert to the record that can answer it (owner, 2026-09-21).
 *
 * "When it says these have not been sent — clicking should go straight to the
 * same parcel that has the problem. Whether it is buy-at-cost, or a full
 * package, or the customer's own: take me there."
 */

const commission: ParcelOrderRef = { orderId: 42, orderType: "commission", orderCode: "CM-1042", orderNumber: "260804-5231" };
const fullPackage: ParcelOrderRef = { orderId: 7, orderType: "full_package", orderCode: "FP-MU2RJM6B", orderNumber: null };

describe("where a parcel is dealt with", () => {
  it("a buy-at-cost parcel opens its purchase", () => {
    const target = parcelSourceTarget([commission], "SF7555593386");
    expect(target.kind).toBe("commission");
    expect(target.href).toBe("/commission/42");
    expect(target.code).toBe("CM-1042");
    expect(target.label.ku).toContain("کڕین بە تێچوو");
  });

  it("a full-package parcel opens its order", () => {
    const target = parcelSourceTarget([fullPackage], "SF7555593386");
    expect(target.href).toBe("/full-package/7");
    expect(target.code).toBe("FP-MU2RJM6B");
  });

  it("a purchase request goes to the same place as a full package", () => {
    expect(parcelSourceTarget([{ orderId: 9, orderType: "purchase_request" }]).href).toBe("/full-package/9");
  });

  it("the customer's own parcel opens the list on that one parcel", () => {
    const target = parcelSourceTarget(null, "SF7555593386");
    expect(target.kind).toBe("parcel");
    expect(target.href).toBe("/packages/all?search=SF7555593386");
    expect(target.code).toBe("SF7555593386");
  });

  it("with no tracking either, the list opens whole rather than lying about a filter", () => {
    expect(parcelSourceTarget([], null).href).toBe("/packages/all");
    expect(parcelListHref("   ")).toBe("/packages/all");
  });

  it("a tracking with characters a URL cannot hold is escaped", () => {
    expect(parcelListHref("JT551 336/01")).toBe("/packages/all?search=JT551%20336%2F01");
  });

  it("the parcel's own order comes first when a carton holds several", () => {
    expect(mainOrderOf([commission, fullPackage])?.orderId).toBe(42);
    expect(parcelSourceTarget([commission, fullPackage], "SF1").href).toBe("/commission/42");
  });

  it("ignores an order that is not one", () => {
    expect(mainOrderOf([{ orderId: 0, orderType: "commission" }])).toBeNull();
    expect(parcelSourceTarget([{ orderId: 0, orderType: "commission" }], "SF1").kind).toBe("parcel");
  });

  it("falls back to the platform number when the order has no code", () => {
    expect(parcelSourceTarget([{ orderId: 3, orderType: "commission", orderNumber: "260807-3550" }]).code).toBe("260807-3550");
    expect(parcelSourceTarget([{ orderId: 3, orderType: "commission" }]).code).toBeUndefined();
  });
});
