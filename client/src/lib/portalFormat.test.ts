import { describe, expect, it } from "vitest";
import { fmtCbm, fmtChargeable, fmtCount, fmtDims, fmtKg, fmtNumber, fmtUsd, NO_VALUE } from "./portalFormat";

describe("money reads the same on every screen", () => {
  it("always has two decimals and thousands separators", () => {
    expect(fmtUsd(1234.5)).toBe("$1,234.50");
    expect(fmtUsd("1234.5")).toBe("$1,234.50");
    expect(fmtUsd(0)).toBe("$0.00");
  });

  it("never prints NaN, null or undefined", () => {
    expect(fmtUsd(null)).toBe(NO_VALUE);
    expect(fmtUsd(undefined)).toBe(NO_VALUE);
    expect(fmtUsd("abc")).toBe(NO_VALUE);
    expect(fmtUsd(Number.NaN)).toBe(NO_VALUE);
  });
});

describe("weights and volumes", () => {
  it("drops the trailing zeros the decimal column carries", () => {
    expect(fmtKg("12.500")).toBe("12.5 kg");
    expect(fmtKg(12)).toBe("12 kg");
    expect(fmtKg(12.345)).toBe("12.35 kg");
  });

  it("keeps three decimals for cubic metres, which sea freight bills on", () => {
    expect(fmtCbm("0.125000")).toBe("0.125 m³");
    expect(fmtCbm(1)).toBe("1 m³");
  });

  it("picks the unit the batch is billed by", () => {
    expect(fmtChargeable(0.5, "cbm")).toBe("0.5 m³");
    expect(fmtChargeable(0.5, "kg")).toBe("0.5 kg");
    expect(fmtChargeable(0.5, null)).toBe("0.5 kg");
  });

  it("shows a dash for a weight nobody recorded", () => {
    expect(fmtKg(null)).toBe(NO_VALUE);
    expect(fmtKg("")).toBe(NO_VALUE);
  });
});

describe("dimensions", () => {
  it("prints whole centimetres without decimals", () => {
    expect(fmtDims("30.00", "20.00", "10.00")).toBe("30×20×10 cm");
  });

  it("keeps a fractional side to one decimal", () => {
    expect(fmtDims(30.5, 20, 10)).toBe("30.5×20×10 cm");
  });

  it("is a dash when any side is missing", () => {
    expect(fmtDims(30, null, 10)).toBe(NO_VALUE);
  });
});

describe("counts and plain numbers", () => {
  it("a missing count is zero, never blank", () => {
    expect(fmtCount(undefined)).toBe(0);
    expect(fmtCount("3")).toBe(3);
  });

  it("plain numbers get separators and no trailing zeros", () => {
    expect(fmtNumber(1500)).toBe("1,500");
    expect(fmtNumber("1500.10")).toBe("1,500.1");
  });
});
