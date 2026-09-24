import { describe, expect, it } from "vitest";
import {
  pledgeFloors,
  pledgeBreaches,
  pledgeRefusal,
  lowerPledgeRefusal,
  pledgeLabel,
  shortOfPledge,
  wholeBoxName,
  type DiscountPledge,
} from "./pledgedDiscount";
import { hasFix } from "./fixAdvice";

/**
 * The owner, 2026-09-24: "add a discount to the receipt printing, in dollars
 * … the box payment screen must be in step with it … the reason for the
 * discount must be written as well." Then: "the discount at receipt printing
 * is fixed in the box payment. You cannot lower it — only raise it."
 *
 * And: "it must be possible for the receipt to carry a discount on one
 * particular tracking as well … I had to give twenty dollars on it: that
 * discount was for one tracking, not for the total."
 */

const box = (usd: number): DiscountPledge => ({ lineId: null, usd, reason: "goodwill" });
const on = (lineId: number, usd: number, tracking = "78829104477"): DiscountPledge =>
  ({ lineId, usd, reason: "damaged", trackingNumber: tracking });

describe("what is still promised", () => {
  it("keeps the box and the parcels apart", () => {
    const f = pledgeFloors([box(10), on(7, 20)]);
    expect(f.boxUsd).toBe(10);
    expect(f.byLine.get(7)).toBe(20);
    expect(f.totalUsd).toBe(30);
  });

  it("does not add two printings of the same promise together", () => {
    // The receipt was printed at ten and reprinted at twenty. The second
    // paper replaced the first in the customer's hand; it did not promise
    // thirty.
    expect(pledgeFloors([on(7, 10), on(7, 20)]).byLine.get(7)).toBe(20);
    expect(pledgeFloors([box(10), box(25)]).boxUsd).toBe(25);
  });

  it("ignores nothing and nonsense", () => {
    expect(pledgeFloors([]).totalUsd).toBe(0);
    expect(pledgeFloors([box(0), on(3, -5)]).totalUsd).toBe(0);
  });
});

describe("kept, or not", () => {
  it("is at least, never exactly — giving more was always allowed", () => {
    expect(shortOfPledge(20, 20)).toBe(0);
    expect(shortOfPledge(20, 25)).toBe(0);
    expect(shortOfPledge(20, 19.99)).toBeCloseTo(0.01, 2);
  });

  it("a promise on one parcel is not kept by a discount on the box", () => {
    const f = pledgeFloors([on(7, 20)]);
    const spread = pledgeBreaches(f, { boxUsd: 50, byLine: new Map() }, () => "78829104477");
    expect(spread).toHaveLength(1);
    expect(spread[0]!.promisedUsd).toBe(20);
    // …and is kept by that parcel's own.
    expect(pledgeBreaches(f, { byLine: new Map([[7, 20]]) }, () => "x")).toHaveLength(0);
  });

  it("reads the offer whether it comes as a map or an object", () => {
    const f = pledgeFloors([on(7, 20)]);
    expect(pledgeBreaches(f, { byLine: { 7: 20 } }, () => "x")).toHaveLength(0);
    expect(pledgeBreaches(f, { byLine: { 7: 5 } }, () => "x")).toHaveLength(1);
  });

  it("names every promise that is short, box and parcels alike", () => {
    const f = pledgeFloors([box(10), on(7, 20), on(9, 5)]);
    const short = pledgeBreaches(
      f,
      { boxUsd: 0, byLine: new Map([[7, 20], [9, 1]]) },
      (lineId) => (lineId === null ? "the whole box" : `line ${lineId}`),
    );
    expect(short.map((b) => b.what)).toEqual(["the whole box", "line 9"]);
  });
});

describe("the refusal", () => {
  it("says what was promised, what is being given, and how to put it right", () => {
    const text = pledgeRefusal([{ what: "78829104477", promisedUsd: 20, offeredUsd: 5 }]);
    expect(text).toContain("$20.00");
    expect(text).toContain("$5.00");
    expect(text).toContain("78829104477");
    // The owner's standing rule: every refusal carries its cure.
    expect(hasFix(text)).toBe(true);
  });

  it("lists them when several are short", () => {
    const text = pledgeRefusal([
      { what: "A", promisedUsd: 10, offeredUsd: 0 },
      { what: "B", promisedUsd: 20, offeredUsd: 1 },
    ]);
    expect(text).toContain("A");
    expect(text).toContain("B");
    expect(hasFix(text)).toBe(true);
  });

  it("says nothing when nothing is broken", () => {
    expect(pledgeRefusal([])).toBe("");
  });

  it("refuses to lower one, in the reader's language", () => {
    expect(lowerPledgeRefusal("78829104477", 20, 5)).toContain("$20.00");
    const en = lowerPledgeRefusal("the whole box", 20, 5, "en");
    expect(en).toContain("a promise");
    expect(hasFix(en, "en")).toBe(true);
  });

  it("has a name for the box as a whole", () => {
    expect(wholeBoxName("ku")).toBeTruthy();
    expect(wholeBoxName("en")).toBe("the whole box");
  });
});

describe("how the receipt names it", () => {
  it("is the reason, and the tracking when it was given on one", () => {
    expect(pledgeLabel({ lineId: null, reason: "goodwill" }, "en")).toBe("Goodwill");
    expect(pledgeLabel({ lineId: 7, reason: "damaged", trackingNumber: "789" }, "en"))
      .toBe("789 · Damaged in transit");
  });
});
