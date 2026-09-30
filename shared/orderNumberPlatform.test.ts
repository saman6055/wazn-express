import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  looksLikeOrderNumber,
  platformFromOrderNumber,
  PLATFORM_1688,
  PLATFORM_PINDUODUO,
  PLATFORM_TAOBAO,
} from "./orderNumberPlatform";

/** The three the owner wrote out on 2026-09-30. */
const PINDUODUO = "260930-434834019861958";
const TAOBAO = "5127741900660014414";
const ALIBABA_1688 = "5127802021486096433";

describe("which shop an order number came from", () => {
  it("names Pinduoduo, because its shape is its own", () => {
    const guess = platformFromOrderNumber(PINDUODUO);
    expect(guess.platform).toBe(PLATFORM_PINDUODUO);
    expect(guess.candidates).toEqual([PLATFORM_PINDUODUO]);
  });

  it("will not choose between Taobao and 1688, and says both", () => {
    // «زۆر بەیەک دەچن ئەو دووە» — they are the same nineteen digits. Naming
    // both is a short question; guessing one is a wrong answer half the time.
    for (const number of [TAOBAO, ALIBABA_1688]) {
      const guess = platformFromOrderNumber(number);
      expect(guess.platform, number).toBeNull();
      expect(guess.candidates, number).toEqual([PLATFORM_TAOBAO, PLATFORM_1688]);
    }
  });

  it("says nothing about a number it does not know", () => {
    for (const number of ["", null, undefined, "SF1234567890", "abc", "123", "78123456789"]) {
      const guess = platformFromOrderNumber(number);
      expect(guess.platform, String(number)).toBeNull();
      expect(guess.candidates, String(number)).toEqual([]);
    }
  });

  it("survives the spaces a paste brings with it", () => {
    expect(platformFromOrderNumber("  260930-434834019861958 ").platform).toBe(PLATFORM_PINDUODUO);
    expect(platformFromOrderNumber("5127741900660014414 ").candidates).toHaveLength(2);
  });
});

describe("an order number typed into a tracking box", () => {
  it("is recognised in both shapes", () => {
    expect(looksLikeOrderNumber(PINDUODUO)).toBe(true);
    expect(looksLikeOrderNumber(TAOBAO)).toBe(true);
    expect(looksLikeOrderNumber(ALIBABA_1688)).toBe(true);
  });

  it("leaves a real tracking number alone", () => {
    // Courier codes carry letters, or are far shorter than an order number.
    for (const tracking of ["SF1234567890123", "YT7565432109876", "78123456789", "JD0012345678901"]) {
      expect(looksLikeOrderNumber(tracking), tracking).toBe(false);
    }
  });

  it("says nothing about an empty box", () => {
    expect(looksLikeOrderNumber("")).toBe(false);
    expect(looksLikeOrderNumber(null)).toBe(false);
  });
});

describe("one rule for what an order number looks like", () => {
  it("the older order/tracking sanity check reads it from here", () => {
    // Two definitions of "looks like an order number" would drift, and the
    // Pinduoduo shape — which carries a dash — was invisible to the old one.
    const sanity = fs.readFileSync(path.join(__dirname, "orderTrackingSanity.ts"), "utf8");
    expect(sanity).toContain('from "./orderNumberPlatform"');
    expect(sanity).toContain("looksLikeOrderNumber(");
  });
});
