import { describe, expect, it } from "vitest";
import { ORDER_FORM_DRAFT_FIELDS, pickOrderFormDraft } from "./formSwitchDraft";

describe("pickOrderFormDraft", () => {
  it("carries the shared fields and the images", () => {
    const draft = pickOrderFormDraft(
      { customerId: "12", productType: "کەلوپەلی ماڵ", shippingType: "sea", quantity: "3" },
      ["https://img/1.jpg"],
    );
    expect(draft.customerId).toBe("12");
    expect(draft.productType).toBe("کەلوپەلی ماڵ");
    expect(draft.shippingType).toBe("sea");
    expect(draft.quantity).toBe("3");
    expect(draft.productImages).toEqual(["https://img/1.jpg"]);
    expect(draft.orderNumber).toBe("");
  });

  it("never carries a money field — that is the owner's rule", () => {
    // The price section must start over on the other form. If one of these
    // ever joins the list, the switch starts smuggling prices across.
    const moneyFields = [
      "purchasePriceUsd",
      "sellingPriceUsd",
      "itemPriceUsd",
      "sellPriceUsd",
      "commissionFeeUsd",
      "advancePaidUsd",
      "advancePaymentMethod",
    ];
    for (const field of moneyFields) {
      expect(ORDER_FORM_DRAFT_FIELDS).not.toContain(field);
    }
    const draft = pickOrderFormDraft(
      { itemPriceUsd: "99.99", advancePaidUsd: "50", customerId: "1" },
      [],
    );
    expect(JSON.stringify(draft)).not.toContain("99.99");
    expect(JSON.stringify(draft)).not.toContain("50");
  });
});
