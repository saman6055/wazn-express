import { describe, expect, it } from "vitest";
import { declaredLinkRefusal } from "./declaredLink";

const open = { status: "pending", customerId: 2 };
const nobodys = { customerId: null, status: "in_batch" };

describe("a declared tracking can be given its parcel", () => {
  it("when the declaration is open, its customer known, and the parcel here and nobody's", () => {
    expect(declaredLinkRefusal(open, nobodys)).toBeNull();
    // Registration marks a declaration matched even when it registers the parcel without an owner.
    expect(declaredLinkRefusal({ status: "matched", customerId: 2 }, nobodys)).toBeNull();
  });

  it("not when the declaration was received or cancelled", () => {
    expect(declaredLinkRefusal({ status: "received", customerId: 2 }, nobodys)).toBe("closed");
    expect(declaredLinkRefusal({ status: "cancelled", customerId: 2 }, nobodys)).toBe("closed");
  });

  it("not without a customer to give it to", () => {
    expect(declaredLinkRefusal({ status: "pending", customerId: null }, nobodys)).toBe("no_customer");
  });

  it("not when no parcel is in the warehouse, or it was returned or cancelled", () => {
    expect(declaredLinkRefusal(open, null)).toBe("no_parcel");
    expect(declaredLinkRefusal(open, { customerId: null, status: "returned" })).toBe("no_parcel");
    expect(declaredLinkRefusal(open, { customerId: null, status: "cancelled" })).toBe("no_parcel");
  });

  it("never when the parcel already belongs to someone", () => {
    expect(declaredLinkRefusal(open, { customerId: 7, status: "in_batch" })).toBe("owned");
    expect(declaredLinkRefusal(open, { customerId: 2, status: "in_batch" })).toBe("owned");
  });
});
