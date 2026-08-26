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
