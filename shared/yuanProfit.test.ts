import { describe, expect, it } from "vitest";
import { yuanOrdersProfit, yuanProfitPerUsd } from "./yuanProfit";

describe("what selling yuan earns", () => {
  it("sold at 6.40, bought at 7.10: each dollar earns about 9.86 cents", () => {
    const perUsd = yuanProfitPerUsd(6.4, 7.1)!;
    expect(Math.round(perUsd * 100 * 100) / 100).toBe(9.86);
  });

  it("sold dearer than it is bought is a loss, and says so", () => {
    expect(yuanProfitPerUsd(7.2, 7.1)!).toBeLessThan(0);
    expect(yuanProfitPerUsd(7.1, 7.1)).toBe(0);
  });

  it("says nothing without both rates", () => {
    expect(yuanProfitPerUsd(6.4, 0)).toBeNull();
    expect(yuanProfitPerUsd(0, 7.1)).toBeNull();
    expect(yuanProfitPerUsd(Number.NaN, 7.1)).toBeNull();
  });
});

describe("what orders already taken earn at today's market rate", () => {
  it("the dollars they brought in, less what their yuan cost today", () => {
    // $2,000 taken for ¥12,800; the yuan cost 12,800 / 7.10 = $1,802.82 today.
    expect(Math.round(yuanOrdersProfit({ usd: 2000, cny: 12800 }, 7.1)! * 100) / 100).toBe(197.18);
  });

  it("nothing open, nothing earned; no market rate, no figure", () => {
    expect(yuanOrdersProfit({ usd: 0, cny: 0 }, 7.1)).toBe(0);
    expect(yuanOrdersProfit({ usd: 2000, cny: 12800 }, 0)).toBeNull();
  });
});
