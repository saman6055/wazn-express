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

/**
 * The discount reaches the paper.
 *
 * A discount is nearly always agreed before the receipt is printed — the box
 * is nine hundred, call it eight-eighty. Two things follow, and the owner
 * asked for both: the total on the sheet has to be the discounted one,
 * because that is the figure money is collected against; and the discount has
 * to appear as its own line, because a sheet that quietly shows 880 invites
 * the question of what the other twenty was.
 */
describe("a discounted box prints as a discounted box", () => {
  const receipt = () => {
    const a = src.indexOf("export function printBoxReceipt");
    expect(a, "printBoxReceipt not found").toBeGreaterThan(-1);
    const b = src.indexOf("export function downloadBoxReceiptPDF", a);
    expect(b, "the receipt builder has moved").toBeGreaterThan(a);
    return src.slice(a, b);
  };

  it("subtracts the discount from the grand total", () => {
    const body = receipt();
    expect(body).toContain("const afterDiscountNum = Math.max(0, grandTotalNum - discountNum)");
  });

  it("never prints a negative amount to collect", () => {
    // A discount larger than the box is a mistake, not money owed back at
    // the counter.
    expect(receipt()).toContain("Math.max(0, grandTotalNum - discountNum)");
  });

  it("shows the discount on its own line, not only in the total", () => {
    const body = receipt();
    expect(body).toContain('t("delivery.discount")');
    expect(body).toContain('t("delivery.afterDiscount")');
  });

  it("moves the bold total line down to the discounted figure", () => {
    // Two lines both styled as the total is two totals, and the customer
    // reads the first one.
    const body = receipt();
    expect(body).toContain('class="financial-row${discountNum > 0 ? "" : " total"}"');
  });

  it("prints what was handed over in dinars, and at what rate", () => {
    // "We took 1,305,000" means nothing a month later without the rate.
    const body = receipt();
    expect(body).toContain('t("delivery.paidInIqd")');
    expect(body).toContain("settlement.exchangeRate");
  });

  it("says plainly when money is still owed", () => {
    expect(receipt()).toContain('t("delivery.remainingDebt")');
  });

  it("prints exactly as before when no money has been taken yet", () => {
    // Everything the settlement adds is behind a check on it existing.
    const body = receipt();
    expect(body).toContain("const settlement = options?.settlement");
    expect(body).toContain("Number(settlement?.discountUsd || 0)");
  });

  it("has all four languages for every line it added", () => {
    const locales = ["ku", "en", "ar", "zh"] as const;
    for (const lang of locales) {
      const raw = fs.readFileSync(
        path.join(__dirname, "..", "locales", `${lang}.json`),
        "utf8",
      ).replace(/^\uFEFF/, "");
      const delivery = JSON.parse(raw).delivery ?? {};
      for (const key of ["discount", "afterDiscount", "paidInIqd", "remainingDebt"]) {
        expect(delivery[key], `${lang}.delivery.${key} is missing`).toBeTruthy();
      }
    }
  });
});

/**
 * What the screen shows and what the paper shows must be one number.
 */
describe("the paper and the screen read from the same place", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "..", "components", "delivery", "BoxDetailPanel.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("builds the printed figures from the settlement query", () => {
    expect(panel).toContain("trpc.deliveryBox.settlementView.useQuery({ boxId })");
    expect(panel).toContain("settlement: settlementForPrint");
  });

  it("leaves reversed receipts off the paper", () => {
    // Their money went back; printing them would overstate what was paid.
    expect(panel).toContain('s.status === "confirmed"');
  });

  it("adds up every receipt on the box, not just the last one", () => {
    // A box paid in two visits has two receipts, and the sheet has to
    // account for both.
    expect(panel).toContain("confirmed.reduce((total, s)");
  });
});
