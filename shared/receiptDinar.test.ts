import { describe, expect, it } from "vitest";
import {
  DEFAULT_DINAR_ROUND_STEP,
  formatIqd,
  formatRate,
  offeredRate,
  receiptDinar,
  roundDinars,
} from "./receiptDinar";

/**
 * The owner's examples from the approved mockups (2026-09-17): a box of
 * $142.50 at 1,465 dinars to the dollar, rounded to the nearest 250.
 */
describe("the receipt in dinars", () => {
  it("with no advance: the total, converted and rounded once (example 2)", () => {
    const d = receiptDinar(142.5, { rate: 1465 })!;
    expect(d.totalIqd).toBe(208_750);
    expect(d.dueIqd).toBe(208_750);
    expect(d.advance).toBeNull();
    expect(d.dueUsd).toBeNull();
  });

  it("with an advance in dollars: taken off in dollars, then converted (example 3)", () => {
    const d = receiptDinar(142.5, { rate: 1465, advanceAmount: 10, advanceCurrency: "USD" })!;
    expect(d.advance).toEqual({ amount: 10, currency: "USD" });
    expect(d.dueUsd).toBe(132.5);
    expect(d.dueIqd).toBe(194_000);
  });

  it("with an advance in dinars: taken off in dinars, exactly as received (example 4)", () => {
    const d = receiptDinar(142.5, { rate: 1465, advanceAmount: 15_000, advanceCurrency: "IQD" })!;
    expect(d.totalIqd).toBe(208_750);
    expect(d.dueIqd).toBe(193_750);
    expect(d.dueUsd).toBeNull();
    // The lines on the paper add up by hand.
    expect(d.totalIqd - d.advance!.amount).toBe(d.dueIqd);
  });

  it("takes an advance in dinars by default", () => {
    expect(receiptDinar(142.5, { rate: 1465, advanceAmount: 15_000 })!.advance?.currency).toBe("IQD");
  });

  it("an odd advance still adds up: rounding happens once, on the total", () => {
    const d = receiptDinar(142.5, { rate: 1465, advanceAmount: 15_100 })!;
    expect(d.dueIqd).toBe(193_650);
    expect(d.totalIqd - 15_100).toBe(d.dueIqd);
  });

  it("rounds to the step the person chose", () => {
    expect(DEFAULT_DINAR_ROUND_STEP).toBe(250);
    expect(receiptDinar(142.5, { rate: 1465, step: 1 })!.totalIqd).toBe(208_763);
    expect(receiptDinar(142.5, { rate: 1465, step: 1000 })!.totalIqd).toBe(209_000);
    expect(roundDinars(208_762.5, 250)).toBe(208_750);
  });

  it("never asks for less than nothing", () => {
    expect(receiptDinar(10, { rate: 1465, advanceAmount: 50_000 })!.dueIqd).toBe(0);
    expect(receiptDinar(10, { rate: 1465, advanceAmount: 20, advanceCurrency: "USD" })!.dueUsd).toBe(0);
  });

  it("ignores an advance of nothing, or of nonsense", () => {
    expect(receiptDinar(142.5, { rate: 1465, advanceAmount: 0 })!.advance).toBeNull();
    expect(receiptDinar(142.5, { rate: 1465, advanceAmount: -5 })!.advance).toBeNull();
    expect(receiptDinar(142.5, { rate: 1465, advanceAmount: Number.NaN })!.advance).toBeNull();
  });

  it("prints no dinars without a usable rate", () => {
    expect(receiptDinar(142.5, null)).toBeNull();
    expect(receiptDinar(142.5, { rate: 0 })).toBeNull();
    expect(receiptDinar(142.5, { rate: Number.NaN })).toBeNull();
  });
});

describe("the rate offered when the window opens", () => {
  it("is the newer of this device's last print and the last payment's", () => {
    expect(offeredRate({ rate: 1460, at: 2 }, { rate: 1465, at: 1 })).toBe(1460);
    expect(offeredRate({ rate: 1460, at: 1 }, { rate: 1465, at: 2 })).toBe(1465);
  });

  it("is whichever exists, and nothing when neither does", () => {
    expect(offeredRate(null, { rate: 1465, at: 1 })).toBe(1465);
    expect(offeredRate({ rate: 1460, at: 1 }, null)).toBe(1460);
    expect(offeredRate(null, null)).toBeNull();
    expect(offeredRate({ rate: 0, at: 5 }, null)).toBeNull();
  });
});

describe("dinars on paper", () => {
  it("keeps digits 0-9 and groups thousands", () => {
    expect(formatIqd(193_750)).toBe("193,750 IQD");
    expect(formatRate(1465)).toBe("1,465");
    expect(formatRate(1465.5)).toBe("1,465.5");
  });
});
