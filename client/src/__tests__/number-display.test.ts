import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fmtKg, fmtNumber, fmtUsd, NO_VALUE, unsignedZero } from "./lib/portalFormat";
import { formatCurrency, formatNumber, formatPercent } from "./lib/format";
import { formatMoney } from "./components/ui/money";

describe("nothing that rounds to zero carries a minus sign", () => {
  it("in the portal's formatters", () => {
    expect(fmtUsd(-0.001)).toBe("$0.00");
    expect(fmtUsd(-0.004)).toBe("$0.00");
    expect(fmtNumber(-0.0001)).toBe("0");
    expect(fmtKg(-0.001)).toBe("0 kg");
  });

  it("while a real negative keeps it", () => {
    expect(fmtUsd(-5)).toBe("-$5.00");
    expect(fmtUsd(-0.01)).toBe("-$0.01");
    expect(unsignedZero("-$0.01")).toBe("-$0.01");
    expect(unsignedZero("-$0.00")).toBe("$0.00");
  });

  it("floating-point noise never reaches the screen", () => {
    expect(fmtNumber(12.300000000004)).toBe("12.3");
    expect(fmtUsd(0.1 + 0.2)).toBe("$0.30");
  });
});

describe("a figure that is not there is a dash", () => {
  it("in the report formatters: no $NaN, no +Infinity%", () => {
    expect(formatCurrency(Number.NaN)).toBe(NO_VALUE);
    expect(formatCurrency(undefined as unknown as number)).toBe(NO_VALUE);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(NO_VALUE);
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe(NO_VALUE);
    expect(formatPercent(Number.NaN)).toBe(NO_VALUE);
  });

  it("while real values still print, strings from the database included", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency("12.5" as unknown as number)).toBe("$12.50");
    expect(formatCurrency(-0.001)).toBe("$0.00");
    expect(formatPercent(5)).toBe("+5.0%");
    expect(formatPercent(-3.26)).toBe("-3.3%");
    expect(formatPercent(-0.04)).toBe("0.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("an amount reads the same way everywhere", () => {
  it("-$500, never $-500 or $-0", () => {
    expect(formatMoney(-500)).toBe("-$500");
    expect(formatMoney(-0.4)).toBe("$0");
    expect(formatMoney(1250, { decimals: 2 })).toBe("$1,250.00");
    expect(formatMoney(1250, { currency: "USD", decimals: 2 })).toBe("$1,250.00");
    expect(formatMoney(-1250, { currency: "USD", decimals: 2 })).toBe("-$1,250.00");
  });

  it("a missing amount is a dash, not a settled $0", () => {
    expect(formatMoney(undefined)).toBe(NO_VALUE);
    expect(formatMoney(null)).toBe(NO_VALUE);
    expect(formatMoney(Number.NaN)).toBe(NO_VALUE);
  });

  it("a dashboard card never counts up to NaN", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "components/CountUp.tsx"), "utf8");
    expect(src).toContain('!Number.isFinite(display)');
  });
});
