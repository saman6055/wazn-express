import { describe, expect, it } from "vitest";
import { AIRLINE_PREFIXES, airlineFromAwb, awbLooksWrong, parseAwb } from "./airWaybill";

/**
 * The owner, 2026-09-25: "after I enter the AWB, can the system fill the
 * other fields in by searching the web, or must it be manual?"
 *
 * The airline needs no searching — it is the first three digits. Nor does
 * "did you type it right": the last digit is the first seven modulo seven.
 */

describe("reading a waybill", () => {
  it("takes the airline off the front", () => {
    // The number on his own screen.
    const awb = parseAwb("235-98651733")!;
    expect(awb.prefix).toBe("235");
    expect(awb.airline).toBe("Turkish Airlines");
    expect(awb.formatted).toBe("235-98651733");
  });

  it("does not mind how it was typed", () => {
    for (const written of ["23598651733", "235 9865 1733", "235-98651733", " 235–98651733 "]) {
      expect(airlineFromAwb(written), written).toBe("Turkish Airlines");
    }
  });

  it("says nothing rather than guessing an airline it does not know", () => {
    // A confidently wrong name is worse than an empty box: nobody checks a
    // box that is already filled.
    const awb = parseAwb("999-12345675")!;
    expect(awb.airline).toBe(null);
  });
});

describe("the check digit", () => {
  it("passes a real number", () => {
    // 9865173 ÷ 7 leaves 3, and the last digit is 3.
    expect(parseAwb("235-98651733")!.checkDigitValid).toBe(true);
    expect(awbLooksWrong("235-98651733")).toBe(false);
  });

  it("catches one typed wrong", () => {
    expect(awbLooksWrong("235-98651734")).toBe(true);
    expect(awbLooksWrong("235-98651730")).toBe(true);
  });

  it("holds its tongue while somebody is still typing", () => {
    // A field that argues with every keystroke is one people stop reading.
    for (const partial of ["", "2", "235", "235-9865", "235-9865173"]) {
      expect(awbLooksWrong(partial), partial).toBe(false);
      expect(parseAwb(partial), partial).toBe(null);
    }
  });

  it("agrees with itself across every serial", () => {
    for (let body = 1000000; body < 1000200; body++) {
      const right = `235-${body}${body % 7}`;
      expect(awbLooksWrong(right), right).toBe(false);
      const wrong = `235-${body}${(body % 7 === 6 ? 0 : (body % 7) + 1)}`;
      expect(awbLooksWrong(wrong), wrong).toBe(true);
    }
  });
});

describe("the table", () => {
  it("is all three-digit prefixes with a real name", () => {
    for (const [prefix, name] of Object.entries(AIRLINE_PREFIXES)) {
      expect(prefix, prefix).toMatch(/^\d{3}$/);
      expect(name.length, prefix).toBeGreaterThan(2);
    }
  });
});
