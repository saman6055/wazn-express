import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { absoluteLogoUrl } from "./absoluteLogoUrl";

/**
 * The box receipt is what money is collected against.
 *
 * It is handed over at the counter and the customer pays what it says, so a
 * missing line or a stray page is not a cosmetic matter. Two sentences and a
 * pair of signature lines were breaking onto a second sheet — a whole page of
 * paper to say thank you.
 */

const src = fs.readFileSync(path.join(__dirname, "deliveryBoxPrintUtils.ts"), "utf8");

describe("a receipt fits the paper it is printed on", () => {
  it("keeps the signatures and the closing line together", () => {
    // Split across a page break they cost an entire extra sheet.
    expect(src).toContain('class="receipt-close"');
    expect(src).toContain(".receipt-close {");
    const rule = src.slice(src.indexOf(".receipt-close {"), src.indexOf(".receipt-close {") + 160);
    expect(rule).toContain("page-break-inside: avoid");
  });

  it("says thank you on one line rather than two", () => {
    // Same words, half the height. On a receipt that is the difference
    // between one sheet and two.
    const footer = src.slice(src.indexOf(".receipt-footer {"), src.indexOf(".receipt-footer {") + 320);
    expect(footer).toContain("display: flex");
  });

  it("repeats the table header when a big box does spill", () => {
    // A hundred-item box legitimately needs two sheets; the second must
    // still be readable.
    expect(src).toContain("thead { display: table-header-group; }");
    expect(src).toContain("tr { page-break-inside: avoid; }");
  });
});

describe("the mark is on it", () => {
  it("sits in the header row rather than above it", () => {
    // A banner of its own costs a strip of every sheet and says nothing the
    // row does not.
    expect(src).toContain('class="header-logo"');
    const rule = src.slice(src.indexOf(".header-logo {"), src.indexOf(".header-logo {") + 200);
    expect(rule, "an uncapped logo pushes the table down the page").toContain("max-height");
  });

  it("is left out cleanly when there is none", () => {
    expect(src).toContain("options?.logoUrl ?");
  });
});

describe("the logo resolves from a print window", () => {
  // A receipt prints from a document with no base URL of ours, so a stored
  // path resolves against nothing and the mark silently fails to appear.
  it("passes absolute urls and data uris straight through", () => {
    expect(absoluteLogoUrl("https://waznexpress.com/logo.png")).toBe("https://waznexpress.com/logo.png");
    expect(absoluteLogoUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("gives nothing when there is nothing", () => {
    expect(absoluteLogoUrl("")).toBeUndefined();
    expect(absoluteLogoUrl(null)).toBeUndefined();
    expect(absoluteLogoUrl(undefined)).toBeUndefined();
    expect(absoluteLogoUrl("   ")).toBeUndefined();
  });
});

/**
 * The receipt is what money is collected against at the counter.
 *
 * The server has always enriched each item with `advanceAppliedUsd`, and its
 * own doc comment says the receipt subtracts the sum "so the customer sees
 * only the balance still owed at delivery". The receipt did not — it printed
 * the full total, and a customer who had already paid an advance was asked
 * for it a second time. The staff panel showed the balance; the sheet handed
 * over did not, and the sheet is what gets read.
 */
describe("a prepayment is on the receipt", () => {
  const helper = src.slice(src.indexOf("function advanceAndDue"), src.indexOf("function totalMeasure"));

  it("sums what has been paid across the items", () => {
    expect(helper).toContain("advanceAppliedUsd");
    expect(helper).toContain("reduce");
  });

  it("never shows a negative amount due", () => {
    // An advance larger than the box is a credit to settle on the account,
    // not cash to hand back at the door.
    expect(helper).toContain("Math.max(0, grandTotal - advance)");
  });

  it("shows the paid line and the balance on both receipts", () => {
    // The A4 sheet and the compact one are both handed over.
    expect(src.split("delivery.advancePaid").length - 1, "one of the two receipts is missing it").toBe(2);
    expect(src.split("delivery.amountDue").length - 1).toBe(2);
  });

  it("leaves a receipt with no prepayment exactly as it was", () => {
    // Two extra rows on every receipt would be two rows of nothing on most
    // of them.
    expect(src).toContain("a4Advance.hasAdvance ?");
    expect(src).toContain("labelAdvance.hasAdvance ?");
  });

  it("subtracts from the same grand total it prints", () => {
    // Computing the balance from a separately derived total is how the two
    // figures come to disagree on the same sheet.
    expect(src).toContain("advanceAndDue(items, grandTotalNum)");
    expect(src).toContain("advanceAndDue(items, grandTotalNumber)");
  });
});
