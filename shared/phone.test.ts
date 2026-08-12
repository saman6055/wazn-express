import { describe, expect, it } from "vitest";
import { normalizePhone, phoneVariants, samePhone } from "./phone";

/**
 * The lookup a customer's login depends on, and it had no tests.
 *
 * The bug it was written for cost two people an afternoon each time: the
 * portal compared numbers with `=`, so a stored `07740427884` and a typed
 * `7740427884` found nobody, the customer was told "wrong phone number or
 * password", staff reset a password that had never been wrong, and the
 * customer still could not sign in.
 */

const CANONICAL = "7740427884";

describe("reducing a number to what identifies it", () => {
  it("recognises every way one number gets written", () => {
    for (const written of [
      "7740427884",
      "07740427884",
      "9647740427884",
      "+9647740427884",
      "009647740427884",
      "+964 774 042 7884",
      "0774-042-7884",
      "  07740427884  ",
      "(0774) 042 7884",
    ]) {
      expect(normalizePhone(written), written).toBe(CANONICAL);
    }
  });

  it("folds Arabic-Indic digits to the number they are", () => {
    // A phone keyboard set to Arabic or Kurdish produces these, and imported
    // rows hold them. `\D` counts them as punctuation and strips them, so a
    // number written this way once reduced to nothing and matched nobody.
    expect(normalizePhone("٠٧٧٤٠٤٢٧٨٨٤")).toBe(CANONICAL);
    expect(normalizePhone("۰۷۷۴۰۴۲۷۸۸۴")).toBe(CANONICAL);
    expect(normalizePhone("+٩٦٤ ٧٧٤ ٠٤٢ ٧٨٨٤")).toBe(CANONICAL);
  });

  it("gives back nothing rather than something wrong", () => {
    // An empty result must never match a stored empty column.
    for (const nothing of ["", "   ", "abc", "---", null, undefined]) {
      expect(normalizePhone(nothing as string), JSON.stringify(nothing)).toBe("");
    }
  });

  it("strips a trunk zero however many were typed", () => {
    expect(normalizePhone("007740427884")).toBe(CANONICAL);
    expect(normalizePhone("0007740427884")).toBe(CANONICAL);
  });

  it("does not mistake a number that merely starts with 964", () => {
    // 964 at the front is the country code; the same digits later are not.
    expect(normalizePhone("07709649999")).toBe("7709649999");
  });

  it("leaves a foreign number alone rather than mangling it", () => {
    // A Chinese supplier's mobile is not an Iraqi one, and pretending
    // otherwise would match it against the wrong person.
    expect(normalizePhone("+8613800000000")).toBe("8613800000000");
  });
});

describe("finding a row however it was stored", () => {
  it("offers every shape the database might hold", () => {
    const variants = phoneVariants("07740427884");
    for (const shape of [
      CANONICAL,
      "07740427884",
      `964${CANONICAL}`,
      `+964${CANONICAL}`,
      `00964${CANONICAL}`,
    ]) {
      expect(variants, shape).toContain(shape);
    }
  });

  it("includes what the caller actually typed", () => {
    // In case a row holds something this cannot predict — spaces, a
    // landline, a foreign mobile.
    expect(phoneVariants("+964 774 042 7884")).toContain("+964 774 042 7884");
  });

  it("never repeats a shape", () => {
    const variants = phoneVariants(CANONICAL);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it("returns nothing for nothing", () => {
    // An empty list means the query matches no rows. A list containing ""
    // would match every row with a blank phone column — every one of them.
    for (const nothing of ["", "   ", "abc", null, undefined]) {
      expect(phoneVariants(nothing as string), JSON.stringify(nothing)).toEqual([]);
    }
  });
});

describe("deciding two numbers are the same phone", () => {
  it("sees through the way each was written", () => {
    expect(samePhone("07740427884", "7740427884")).toBe(true);
    expect(samePhone("+964 774 042 7884", "07740427884")).toBe(true);
    expect(samePhone("٠٧٧٤٠٤٢٧٨٨٤", "+9647740427884")).toBe(true);
  });

  it("keeps different numbers apart", () => {
    expect(samePhone("07740427884", "07740427885")).toBe(false);
    expect(samePhone("07740427884", "07509183535")).toBe(false);
  });

  it("never says two unreadable numbers are the same person", () => {
    // Two blanks reducing to "" must not authenticate anybody.
    expect(samePhone("", "")).toBe(false);
    expect(samePhone(null, null)).toBe(false);
    expect(samePhone("abc", "xyz")).toBe(false);
    expect(samePhone("abc", "")).toBe(false);
    expect(samePhone(undefined, "07740427884")).toBe(false);
  });
});
