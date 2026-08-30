import { describe, expect, it } from "vitest";
import {
  settlementTotals,
  differenceOf,
  outstandingOf,
  iqdToUsd,
  usdToIqd,
  DISCOUNT_REASONS,
  boxDiscountUsd,
  allocateBoxDiscount,
  boxPaidState,
} from "./boxSettlement";

/**
 * The box is the door money comes back through, and these are the sums that
 * decide how much of it comes back. Every case the owner described is here
 * as a worked example, because a rule with no number beside it is a rule
 * nobody can check.
 */

const parcel = (lineId: number, chargedUsd: number, extra: Partial<{ discountedUsd: number; settledUsd: number }> = {}) => ({
  lineId, chargedUsd, discountedUsd: 0, settledUsd: 0, ...extra,
});

describe("the ordinary day", () => {
  it("a $900 box with nothing wrong asks for $900 and nothing else", () => {
    // The owner's own words: 900 goes out, 900 comes back, no fuss. Nothing
    // in the result may ask a question.
    const parcels = [245.00, 180.50, 312.75, 96.25, 65.50].map((v, i) => parcel(i + 1, v));
    const t = settlementTotals(parcels);
    expect(t.dueUsd).toBe(900);
    expect(t.discountUsd).toBe(0);
    expect(t.correctionUsd).toBe(0);
    expect(t.heldUsd).toBe(0);
    expect(t.lines.every((l) => l.remainingUsd === 0)).toBe(true);

    const d = differenceOf(t.dueUsd, 900);
    expect(d.kind).toBe("none");
    expect(d.reasonRequired, "the ordinary day must not ask for a reason").toBe(false);
  });

  it("counts a part-paid parcel from what is left, not from the price", () => {
    expect(outstandingOf(parcel(1, 50, { settledUsd: 20 }))).toBe(30);
    expect(outstandingOf(parcel(1, 50, { settledUsd: 20, discountedUsd: 5 }))).toBe(25);
  });
});

describe("one parcel is set aside — the rest are still receipted", () => {
  it("leaves the held parcel off the total and keeps its money owed", () => {
    const parcels = [parcel(1, 8.40), parcel(2, 12.00), parcel(3, 7.50)];
    const t = settlementTotals(parcels, [{ lineId: 3, held: true }]);
    expect(t.dueUsd).toBe(20.40);
    expect(t.heldUsd, "held money must not vanish").toBe(7.50);
    const held = t.lines.find((l) => l.lineId === 3)!;
    expect(held.paidUsd).toBe(0);
    expect(held.remainingUsd).toBe(7.50);
  });

  it("refuses to discount a parcel nobody is paying for", () => {
    // Forgiving money on a held parcel would be a discount against nothing,
    // and would land in the discount report as if we had given something.
    const t = settlementTotals([parcel(1, 10)], [{ lineId: 1, held: true, discountUsd: 4 }]);
    expect(t.discountUsd).toBe(0);
    expect(t.lines[0]!.remainingUsd).toBe(10);
  });
});

describe("a discount is money we chose to give", () => {
  it("comes off what is due and is counted as a discount", () => {
    const t = settlementTotals([parcel(1, 12)], [{ lineId: 1, discountUsd: 4 }]);
    expect(t.dueUsd).toBe(8);
    expect(t.discountUsd).toBe(4);
    expect(t.lines[0]!.remainingUsd).toBe(0);
  });

  it("cannot be negative, whatever is passed in", () => {
    const t = settlementTotals([parcel(1, 12)], [{ lineId: 1, discountUsd: -5 }]);
    expect(t.discountUsd).toBe(0);
    expect(t.dueUsd).toBe(12);
  });

  it("never turns a parcel into money owed back", () => {
    // A discount bigger than the balance settles the parcel; it does not
    // hand the customer the difference.
    const t = settlementTotals([parcel(1, 12)], [{ lineId: 1, discountUsd: 30 }]);
    expect(t.dueUsd).toBe(0);
    expect(t.lines[0]!.remainingUsd).toBe(0);
  });

  it("keeps a reason for every kind we report on", () => {
    expect(DISCOUNT_REASONS).toContain("damaged");
    expect(DISCOUNT_REASONS).toContain("goodwill");
    expect(DISCOUNT_REASONS).toContain("loyal");
    expect(DISCOUNT_REASONS).toContain("other");
  });
});

/**
 * A correction is not a discount, and the difference is the whole reason the
 * discount report is worth having. A discount means the price was right and
 * we gave some back. A correction means the price was wrong.
 */
describe("a correction moves the price, not the payment", () => {
  it("we overcharged, the customer noticed: the price comes down", () => {
    const t = settlementTotals([parcel(1, 6.25)], [{ lineId: 1, correctionUsd: -1.25 }]);
    expect(t.dueUsd).toBe(5);
    expect(t.correctionUsd).toBe(-1.25);
    expect(t.discountUsd, "a correction must never be reported as a discount").toBe(0);
  });

  it("we undercharged and they sent the difference: the price goes up", () => {
    const t = settlementTotals([parcel(1, 9)], [{ lineId: 1, correctionUsd: 2 }]);
    expect(t.dueUsd).toBe(11);
    expect(t.correctionUsd).toBe(2);
    expect(t.discountUsd).toBe(0);
  });

  it("a correction past zero settles the parcel rather than owing it back", () => {
    const t = settlementTotals([parcel(1, 5)], [{ lineId: 1, correctionUsd: -20 }]);
    expect(t.dueUsd).toBe(0);
    expect(t.lines[0]!.remainingUsd).toBe(0);
  });
});

describe("the whole screen at once", () => {
  it("adds up the mockup's box exactly", () => {
    // Five parcels: one plain, one discounted for breakage, one corrected
    // down, one corrected up, one held.
    const t = settlementTotals(
      [parcel(1, 8.40), parcel(2, 12.00), parcel(3, 6.25), parcel(4, 9.00), parcel(5, 7.50)],
      [
        { lineId: 2, discountUsd: 4.00 },
        { lineId: 3, correctionUsd: -1.25 },
        { lineId: 4, correctionUsd: 2.00 },
        { lineId: 5, held: true },
      ],
    );
    expect(t.chargedUsd).toBe(43.15);
    expect(t.correctionUsd).toBe(0.75);
    expect(t.discountUsd).toBe(4);
    expect(t.heldUsd).toBe(7.50);
    expect(t.dueUsd).toBe(32.40);
  });
});

describe("the gap between what is due and what was handed over", () => {
  it("is nothing at all when they match", () => {
    expect(differenceOf(32.40, 32.40)).toEqual({ kind: "none", amountUsd: 0, reasonRequired: false });
  });

  it("short becomes debt by default, and always needs a reason", () => {
    const d = differenceOf(32.40, 31.03);
    expect(d.kind).toBe("debt");
    expect(d.amountUsd).toBe(1.37);
    expect(d.reasonRequired).toBe(true);
  });

  it("short can be forgiven instead, and still needs a reason", () => {
    const d = differenceOf(32.40, 31.03, "discount");
    expect(d.kind).toBe("discount");
    expect(d.amountUsd).toBe(1.37);
    expect(d.reasonRequired, "money written off must say why").toBe(true);
  });

  it("over becomes credit, and needs no decision", () => {
    const d = differenceOf(32.40, 35.00);
    expect(d.kind).toBe("credit");
    expect(d.amountUsd).toBe(2.60);
    expect(d.reasonRequired).toBe(false);
  });
});

describe("charged in dollars, collected in dinars", () => {
  it("converts at the rate it is given", () => {
    expect(iqdToUsd(1_305_000, 1450)).toBe(900);
    expect(usdToIqd(900, 1450)).toBe(1_305_000);
  });

  it("refuses a rate that would produce nonsense", () => {
    // A missing or zero rate must not silently divide and report a huge or
    // infinite dollar figure on a money screen.
    expect(iqdToUsd(1_305_000, 0)).toBe(0);
    expect(iqdToUsd(1_305_000, NaN)).toBe(0);
    expect(usdToIqd(900, -5)).toBe(0);
  });

  it("rounds dinars to whole units, because there are no fractions of one", () => {
    expect(usdToIqd(32.40, 1450)).toBe(46_980);
    expect(Number.isInteger(usdToIqd(31.03, 1447))).toBe(true);
  });

  it("survives the rounding that floating point invites", () => {
    // 0.1 + 0.2 money. Three parcels that must add to exactly the box total.
    const t = settlementTotals([parcel(1, 0.10), parcel(2, 0.20), parcel(3, 0.30)]);
    expect(t.dueUsd).toBe(0.60);
    expect(differenceOf(t.dueUsd, 0.60).kind).toBe("none");
  });
});

/**
 * A discount is normally given on the box, not the parcel.
 *
 * Nobody at a counter forgives $4.13 on parcel three. They say the box is
 * nine hundred, call it eight-eighty — or the kilo is eleven dollars, make it
 * ten. Both are one decision about the box, and it still has to land on the
 * parcels underneath or the report has nothing to add up.
 */
describe("a discount on the whole box", () => {
  const box900 = [245.00, 180.50, 312.75, 96.25, 65.50].map((v, i) =>
    ({ lineId: i + 1, chargedUsd: v, discountedUsd: 0, settledUsd: 0 }));

  it("takes an amount off: nine hundred, call it eight-eighty", () => {
    expect(boxDiscountUsd({ mode: "newTotal", value: 880 }, box900)).toBe(20);
    expect(boxDiscountUsd({ mode: "amount", value: 20 }, box900)).toBe(20);
  });

  it("takes a lower rate per kilo: thirty kilos at eleven, call it ten", () => {
    const parcels = [
      { lineId: 1, chargedUsd: 220, weightKg: 20, discountedUsd: 0, settledUsd: 0 },
      { lineId: 2, chargedUsd: 110, weightKg: 10, discountedUsd: 0, settledUsd: 0 },
    ];
    expect(boxDiscountUsd({ mode: "perKg", fromRatePerKg: 11, toRatePerKg: 10 }, parcels)).toBe(30);
  });

  it("refuses a rate that went up, which is a price change and not a gift", () => {
    const parcels = [{ lineId: 1, chargedUsd: 220, weightKg: 20, discountedUsd: 0, settledUsd: 0 }];
    expect(boxDiscountUsd({ mode: "perKg", fromRatePerKg: 10, toRatePerKg: 11 }, parcels)).toBe(0);
  });

  it("never exceeds the box or goes below zero", () => {
    // "Make it 950" on a 900 box is a typo, not money owed back.
    expect(boxDiscountUsd({ mode: "newTotal", value: 950 }, box900)).toBe(0);
    expect(boxDiscountUsd({ mode: "amount", value: 5000 }, box900)).toBe(900);
    expect(boxDiscountUsd({ mode: "amount", value: -50 }, box900)).toBe(0);
    expect(boxDiscountUsd({ mode: "none" }, box900)).toBe(0);
  });

  it("splits across the parcels in proportion to what each costs", () => {
    const shares = allocateBoxDiscount(20, box900);
    // The biggest parcel carries the biggest share.
    expect(shares.get(3)!).toBeGreaterThan(shares.get(5)!);
    // 312.75/900 × 20
    expect(shares.get(3)).toBeCloseTo(6.95, 2);
  });

  it("adds up to exactly the discount, cent for cent", () => {
    // A cent lost to rounding is a parcel that owes a cent forever.
    for (const amount of [20, 33.33, 0.01, 899.99, 7.77]) {
      const shares = allocateBoxDiscount(amount, box900);
      const sum = Array.from(shares.values()).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 100) / 100, `${amount} did not split evenly`).toBe(amount);
    }
  });

  it("skips held parcels, which are not on this receipt", () => {
    const shares = allocateBoxDiscount(20, box900, [3]);
    expect(shares.has(3)).toBe(false);
    const sum = Array.from(shares.values()).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(20);
  });

  it("does nothing when there is nothing left to discount", () => {
    const paid = [{ lineId: 1, chargedUsd: 50, discountedUsd: 0, settledUsd: 50 }];
    expect(allocateBoxDiscount(10, paid).size).toBe(0);
    expect(boxDiscountUsd({ mode: "amount", value: 10 }, paid)).toBe(0);
  });

  it("reaches the receipt as a lower total, which is what the customer pays", () => {
    // The whole point: the discount is applied before printing, and the
    // receipt is the discounted figure.
    const shares = allocateBoxDiscount(20, box900);
    const t = settlementTotals(
      box900,
      box900.map((p) => ({ lineId: p.lineId, discountUsd: shares.get(p.lineId) ?? 0 })),
    );
    expect(t.discountUsd).toBe(20);
    expect(t.dueUsd).toBe(880);
    expect(differenceOf(t.dueUsd, 880).kind).toBe("none");
  });
});

/**
 * "Paid $190" on a box worth $200 is true about the money and wrong about
 * the box — on the two screens where somebody checks whether a customer
 * still owes.
 */
describe("a box is paid, part paid, or not paid", () => {
  it("calls a fully settled box paid", () => {
    expect(boxPaidState(200, "200.00")).toBe("paid");
    expect(boxPaidState(629.64, 629.64)).toBe("paid");
  });

  it("calls a part settled box part paid, not paid", () => {
    expect(boxPaidState(190, "200.00")).toBe("partly");
    expect(boxPaidState(0.01, "200.00")).toBe("partly");
  });

  it("calls an untouched box unpaid", () => {
    expect(boxPaidState(0, "200.00")).toBe("unpaid");
    expect(boxPaidState(null, "200.00")).toBe("unpaid");
    expect(boxPaidState(undefined, undefined)).toBe("unpaid");
  });

  it("does not strand a box on a rounded dinar", () => {
    // 275,500 IQD at 1,450 is $190.00 to the cent, but rates rarely divide
    // that cleanly. Half a cent of slack, or boxes look part paid forever.
    expect(boxPaidState(199.999, "200.00")).toBe("paid");
    expect(boxPaidState(199.98, "200.00")).toBe("partly");
  });

  it("trusts the money over a box with no recorded worth", () => {
    expect(boxPaidState(50, null)).toBe("paid");
    expect(boxPaidState(50, 0)).toBe("paid");
  });

  it("treats money over the total as paid, not as something odd", () => {
    expect(boxPaidState(250, "200.00")).toBe("paid");
  });
});
