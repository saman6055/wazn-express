import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fmtAmount, fmtUsd } from "./lib/portalFormat";
import { csvAmount } from "./lib/csv";

/**
 * Money on the finance screens and at the delivery counter (2026-09-11): one
 * way to write an amount — $1,250.00, or 1,250.00 in a column already labelled
 * USD — and never "-$0.00", "NaN", or digits that follow the phone's locale.
 */
describe("the amount formatters", () => {
  it("write separators and two decimals", () => {
    expect(fmtUsd(1250)).toBe("$1,250.00");
    expect(fmtAmount(1250)).toBe("1,250.00");
    expect(fmtUsd(-500)).toBe("-$500.00");
    expect(fmtAmount("-500")).toBe("-500.00");
  });

  it("never put a minus on nothing, or print NaN", () => {
    expect(fmtUsd(-0.001)).toBe("$0.00");
    expect(fmtAmount(-0.004)).toBe("0.00");
    expect(fmtAmount(Number.NaN)).toBe("—");
    expect(fmtAmount(null)).toBe("—");
  });

  it("keep a spreadsheet's amounts as numbers", () => {
    expect(csvAmount(1250)).toBe("1250.00");
    expect(csvAmount("12.5")).toBe("12.50");
    expect(csvAmount(-0.001)).toBe("0.00");
    expect(csvAmount(undefined)).toBe("");
  });
});

const SRC = path.resolve(__dirname);
const FILES = [
  "pages/Finance.tsx",
  "pages/CustomerFinance.tsx",
  "pages/Payments.tsx",
  "pages/CustomerDeliveryScanner.tsx",
  "components/BoxInvoiceView.tsx",
  "components/BatchInvoiceView.tsx",
  "components/delivery/BoxSettlementPanel.tsx",
  "components/delivery/SettlementStates.tsx",
  "components/delivery/BoxDetailPanel.tsx",
  "components/delivery/BoxTable.tsx",
  "components/delivery/QuickSettleDialog.tsx",
  "components/delivery/DiscountReport.tsx",
  "components/delivery/DeliveryStats.tsx",
  "components/delivery/BatchPrintBoxesSection.tsx",
];

// A figure put back into an input box is a number to edit, not text to read.
const INPUT_VALUE = /set(Reverse|Adjust)Amount\(/;

describe("the finance screens and the counter write amounts one way", () => {
  it.each(FILES)("%s does not round an amount by hand", (file) => {
    const hand = fs
      .readFileSync(path.join(SRC, file), "utf8")
      .split("\n")
      .map((line, i) => ({ line, at: i + 1 }))
      .filter(({ line }) => /\.toFixed\(/.test(line) && !INPUT_VALUE.test(line))
      .map(({ line, at }) => `${file}:${at}: ${line.trim()}`);
    expect(hand).toEqual([]);
  });

  it("the customer's own report escapes what a person typed, and prints from the opener", () => {
    const src = fs.readFileSync(path.join(SRC, "pages/CustomerFinance.tsx"), "utf8");
    expect(src).toContain('title="${escapeHtml(txn.description)}"');
    expect(src).not.toMatch(/<script[\s>]/);
    expect(src).toContain("printWhenReady(printWindow)");
  });
});
