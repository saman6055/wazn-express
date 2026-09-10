import { describe, it, expect } from "vitest";
import { nothingToTakeReason, confirmedPaymentCount, type SettlementViewLike } from "./settlementState";

const parcel = (over: Partial<SettlementViewLike["parcels"][number]> = {}) => ({
  lineId: 1, packageCode: "PKG-1", trackingNumber: null,
  chargedUsd: 10, discountedUsd: 0, settledUsd: 10, outstandingUsd: 0,
  ...over,
});

const view = (over: Partial<SettlementViewLike> = {}): SettlementViewLike => ({
  box: { id: 1 }, parcels: [parcel()], settlements: [{ status: "confirmed" }],
  ...over,
});

describe("why the payment window has nothing to take", () => {
  it("no box at all", () => {
    expect(nothingToTakeReason(undefined)).toBe("no_box");
    expect(nothingToTakeReason(view({ box: null }))).toBe("no_box");
  });

  it("a box with no parcels in it", () => {
    expect(nothingToTakeReason(view({ parcels: [] }))).toBe("no_parcels");
  });

  it("a box whose parcels are all covered", () => {
    expect(nothingToTakeReason(view())).toBe("all_covered");
  });
});

describe("payments that still stand", () => {
  it("counts confirmed payments and leaves reversed ones out", () => {
    expect(confirmedPaymentCount(view({ settlements: [{ status: "confirmed" }, { status: "reversed" }, { status: "confirmed" }] }))).toBe(2);
    expect(confirmedPaymentCount(view({ settlements: [] }))).toBe(0);
    expect(confirmedPaymentCount(undefined)).toBe(0);
  });
});
