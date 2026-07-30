import { describe, it, expect } from "vitest";
import { readableError, editableSnapshot, advancePayload } from "./commissionEditUtils";

/**
 * Saving a commission edit used to fill the screen with an unreadable blob:
 * the failed mutation's `message` carried a serialized payload (a base64
 * product image plus every field of the order) and the toast printed it
 * verbatim. `readableError` is the guard that keeps data out of the UI.
 */
describe("readableError", () => {
  const FALLBACK = "Failed to update order";

  it("shows a real error message through", () => {
    expect(readableError("This order number is already used by CM-123", FALLBACK))
      .toBe("This order number is already used by CM-123");
  });

  it("falls back when the message is missing or blank", () => {
    expect(readableError(undefined, FALLBACK)).toBe(FALLBACK);
    expect(readableError("", FALLBACK)).toBe(FALLBACK);
    expect(readableError("   ", FALLBACK)).toBe(FALLBACK);
  });

  it("never prints a base64 image payload", () => {
    const blob = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ" + "A".repeat(50);
    expect(readableError(blob, FALLBACK)).toBe(FALLBACK);
  });

  it("never prints the serialized order row that caused the report", () => {
    // Shape observed in production: a JSON image array then the order's fields.
    const blob = '["data:image/jpeg;base64,' + "x".repeat(400) +
      '/9k="],,1,red,38,Bag,39.56,5.44,air_regular,,,,,5.44,260729-315495554581958,,2,1849';
    expect(readableError(blob, FALLBACK)).toBe(FALLBACK);
  });

  it("rejects anything that starts like JSON", () => {
    expect(readableError('{"code":"BAD_REQUEST"}', FALLBACK)).toBe(FALLBACK);
    expect(readableError('[{"path":["itemPriceUsd"]}]', FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a message too long to read in a toast", () => {
    expect(readableError("e".repeat(301), FALLBACK)).toBe(FALLBACK);
    // ...but keeps one that is merely long-ish.
    const longish = "e".repeat(299);
    expect(readableError(longish, FALLBACK)).toBe(longish);
  });
});

/**
 * Pressing Save without touching anything should say so, not write a no-op
 * update that bumps the order version and logs a change that never happened.
 */
describe("editableSnapshot", () => {
  const base = {
    customerId: "7", supplierId: "none", orderNumber: "ORD-1",
    trackingNumber: "TRK-1", productLink: "", productDescription: "",
    quantity: "1", color: "red", size: "38", productType: "Bag",
    itemPriceUsd: "39.56", commissionFeeUsd: "5.44", notes: "",
    shippingType: "air_regular", weightKg: "", dimensionLength: "",
    dimensionWidth: "", dimensionHeight: "", volumeCbm: "",
  };

  it("is identical for an untouched form", () => {
    expect(editableSnapshot(base, ["img-a"]))
      .toBe(editableSnapshot({ ...base }, ["img-a"]));
  });

  it("changes when a price is edited", () => {
    expect(editableSnapshot({ ...base, itemPriceUsd: "40.00" }, []))
      .not.toBe(editableSnapshot(base, []));
  });

  it("changes when the commission is edited", () => {
    expect(editableSnapshot({ ...base, commissionFeeUsd: "9.00" }, []))
      .not.toBe(editableSnapshot(base, []));
  });

  it("changes when the quantity is edited", () => {
    expect(editableSnapshot({ ...base, quantity: "3" }, []))
      .not.toBe(editableSnapshot(base, []));
  });

  it("changes when an image is added or removed", () => {
    expect(editableSnapshot(base, ["img-a"])).not.toBe(editableSnapshot(base, []));
    expect(editableSnapshot(base, ["img-a", "img-b"]))
      .not.toBe(editableSnapshot(base, ["img-a"]));
  });

  it("ignores the derived sale price, which is not sent to the server", () => {
    // sellPriceUsd is a UI helper (buy + commission); on its own it must not
    // make an untouched form look edited.
    expect(editableSnapshot({ ...base, sellPriceUsd: "45.00" }, []))
      .toBe(editableSnapshot({ ...base, sellPriceUsd: "" }, []));
  });

  it("ignores advance-payment fields, which edit mode never sends", () => {
    expect(editableSnapshot({ ...base, advancePaidUsd: "10", advancePaymentMethod: "FIB" }, []))
      .toBe(editableSnapshot(base, []));
  });
});

/**
 * The server treats a PRESENT advancePaidUsd as intent and moves real money on
 * the customer's ledger (recordPaymentReceived / reverseAdvancePayment). So an
 * order saved with no advance entered must send nothing at all — the owner's
 * requirement: "when no advance is entered, don't calculate an advance in any
 * way".
 */
describe("advancePayload", () => {
  it("sends nothing when the field was never touched", () => {
    expect(advancePayload("")).toBeUndefined();
    expect(advancePayload(undefined)).toBeUndefined();
    expect(advancePayload(null)).toBeUndefined();
    expect(advancePayload("   ")).toBeUndefined();
  });

  it("sends nothing for a typed zero — the case `|| undefined` would leak", () => {
    expect(advancePayload("0")).toBeUndefined();
    expect(advancePayload("0.00")).toBeUndefined();
    expect(advancePayload("0.0")).toBeUndefined();
    expect(advancePayload(" 0 ")).toBeUndefined();
  });

  it("sends nothing for junk rather than posting NaN", () => {
    expect(advancePayload("abc")).toBeUndefined();
    expect(advancePayload("-")).toBeUndefined();
  });

  it("never sends a negative advance", () => {
    expect(advancePayload("-25")).toBeUndefined();
  });

  it("sends a real advance through untouched", () => {
    expect(advancePayload("25")).toBe("25");
    expect(advancePayload("0.50")).toBe("0.50");
    expect(advancePayload(" 100.25 ")).toBe("100.25");
  });
});
