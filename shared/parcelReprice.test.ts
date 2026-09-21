import { describe, expect, it } from "vitest";
import { repriceIsGood, repriceReport, repriceWords, shouldStoreNewPrice } from "./parcelReprice";

/**
 * Correcting a parcel says what it did to the price (owner, 2026-09-21).
 *
 * A parcel entered in Quick Register with the wrong weight was corrected and
 * the price did not move. The edit had always refused in three cases — no
 * owner, already charged, no rate — and it refused without a word, so the
 * only way out anybody could see was to delete the parcel and enter it again.
 */
describe("what the correction did", () => {
  it("prices it again when the facts moved", () => {
    const r = repriceReport({ wasUsd: "12.00", resolvedUsd: "9.75" });
    expect(r).toEqual({ outcome: "repriced", wasUsd: 12, nowUsd: 9.75 });
    expect(shouldStoreNewPrice(r)).toBe(true);
    expect(repriceIsGood(r)).toBe(true);
  });

  it("prices a parcel that had no price at all", () => {
    const r = repriceReport({ wasUsd: null, resolvedUsd: "9.75" });
    expect(r.outcome).toBe("repriced");
    expect(r.wasUsd).toBeNull();
    expect(r.nowUsd).toBe(9.75);
  });

  it("says so when the answer is the same figure", () => {
    const r = repriceReport({ wasUsd: "9.75", resolvedUsd: 9.7501 });
    expect(r.outcome).toBe("unchanged");
    expect(shouldStoreNewPrice(r)).toBe(false);
    expect(repriceIsGood(r)).toBe(true);
  });

  it("never writes a blank over a real price", () => {
    const r = repriceReport({ wasUsd: "12.00", resolvedUsd: undefined });
    expect(r).toEqual({ outcome: "no_rate", wasUsd: 12, nowUsd: 12 });
    expect(shouldStoreNewPrice(r)).toBe(false);
    expect(repriceIsGood(r)).toBe(false);
    expect(repriceReport({ wasUsd: "12.00", resolvedUsd: "0.00" }).outcome).toBe("no_rate");
  });

  it("leaves a charged parcel's figure alone — a debt is not moved by an edit", () => {
    const r = repriceReport({ isCharged: true, wasUsd: "12.00", resolvedUsd: "9.75" });
    expect(r).toEqual({ outcome: "charged", wasUsd: 12, nowUsd: 12 });
    expect(shouldStoreNewPrice(r)).toBe(false);
    expect(repriceIsGood(r)).toBe(false);
  });

  it("leaves a parcel with no owner to the claim, which prices it properly", () => {
    const r = repriceReport({ isUnclaimed: true, wasUsd: null, resolvedUsd: "9.75" });
    expect(r.outcome).toBe("unclaimed");
    expect(shouldStoreNewPrice(r)).toBe(false);
  });

  it("puts the charge first: an unclaimed parcel is not charged", () => {
    expect(repriceReport({ isUnclaimed: true, isCharged: false, wasUsd: 5 }).outcome).toBe("unclaimed");
  });
});

describe("the sentence the person reads", () => {
  it("names both figures when the price moved", () => {
    const words = repriceWords(repriceReport({ wasUsd: 12, resolvedUsd: 9.75 }))!;
    expect(words.ku).toContain("$12.00");
    expect(words.ku).toContain("$9.75");
    expect(words.en).toBe("Repriced: $12.00 → $9.75");
    // Digits stay 0-9 in every language (the owner's standing rule).
    for (const s of [words.ku, words.ar, words.zh]) expect(s).toMatch(/9\.75/);
  });

  it("says what to do when there is no rate yet", () => {
    const words = repriceWords(repriceReport({ wasUsd: 12, resolvedUsd: null }))!;
    expect(words.ku).toContain("نرخی باچەکە");
    expect(words.en).toContain("Give its batch a price");
  });

  it("names the figure already charged", () => {
    const words = repriceWords(repriceReport({ isCharged: true, wasUsd: 12 }))!;
    expect(words.en).toContain("$12.00");
    expect(words.ku).toContain("حسابی کڕیار");
  });

  it("is silent when nothing behind the price moved", () => {
    expect(repriceWords({ outcome: "untouched", wasUsd: null, nowUsd: null })).toBeNull();
  });

  it("says the same thing in all four languages", () => {
    for (const facts of [
      { wasUsd: 12, resolvedUsd: 9.75 },
      { wasUsd: 12, resolvedUsd: 12 },
      { wasUsd: 12, resolvedUsd: null },
      { isCharged: true, wasUsd: 12 },
      { isUnclaimed: true, wasUsd: null },
    ]) {
      const words = repriceWords(repriceReport(facts))!;
      for (const key of ["ku", "en", "ar", "zh"] as const) {
        expect(words[key].length, `${key} of ${JSON.stringify(facts)}`).toBeGreaterThan(5);
      }
    }
  });
});
