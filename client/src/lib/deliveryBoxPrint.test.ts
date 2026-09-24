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
 * The system keeps no advance on a receipt — owner, 2026-09-17.
 *
 * Both receipts used to subtract each item's `advanceAppliedUsd` and print
 * the rest as the amount due. The owner: there is no advance in the system,
 * only account credit — a balance the account uses, or else a debt. The only
 * advance a receipt shows now is one received by hand and typed in just
 * before printing (shared/receiptDinar), and it changes that paper only.
 */
describe("no system advance on either receipt", () => {
  it("neither the full receipt nor the compact one takes off a recorded advance", () => {
    expect(src).not.toContain("advanceAndDue");
    // The field stays on the item type (callers pass it through, the staff
    // panel shows it); nothing on paper reads it.
    expect(src).not.toMatch(/\.advanceAppliedUsd/);
    const a = src.indexOf("export function printBoxLabel");
    const b = src.indexOf("export function buildBoxReceiptHtml");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    const label = src.slice(a, b);
    expect(label).not.toContain("delivery.advancePaid");
    expect(label).not.toContain("delivery.amountDue");
  });
});

/**
 * The receipt in dinars — owner, 2026-09-17 (example 4 of the mockups).
 *
 * The counter used to convert the total to dinars by hand, take off the
 * advance and write the result with a pen. The rules are unit-tested in
 * shared/receiptDinar.test.ts; this pins them to the paper.
 */
describe("the receipt in dinars", () => {
  const between = (start: string, end: string) => {
    const a = src.indexOf(start);
    expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
    const b = src.indexOf(end, a + start.length);
    expect(b, `end marker not found after ${start}`).toBeGreaterThan(a);
    return src.slice(a, b);
  };

  it("counts its dinars from the very dollar figure it prints", () => {
    const receipt = between("export function buildBoxReceiptHtml", "export function downloadBoxReceiptPDF");
    expect(receipt).toContain("const dinar = receiptDinar(afterDiscountNum, options?.dinar);");
    expect(receipt).toContain('${dinar ? dinarRowsHtml(dinar, t) : ""}');
  });

  it("the window before printing counts from the same sum", () => {
    // receiptAmountUsd is what the window previews; the receipt's own line
    // is the same expression, so the two cannot drift apart.
    expect(between("export function receiptAmountUsd", "function dinarRowsHtml")).toContain("Math.max(0, grandTotalNum - discountNum)");
    expect(between("export function buildBoxReceiptHtml", "export function downloadBoxReceiptPDF")).toContain("Math.max(0, grandTotalNum - discountNum)");
  });

  it("prints the lines in the order the owner approved", () => {
    const rows = between("function dinarRowsHtml", "\n}\n");
    // An advance in dollars: off the dollars, then the rest in dinars.
    const usd = rows.slice(rows.indexOf('if (d.advance?.currency === "USD")'), rows.indexOf("if (d.advance) {"));
    expect(usd.indexOf('t("delivery.advancePaid")')).toBeLessThan(usd.indexOf('t("delivery.amountDue")'));
    expect(usd.indexOf('t("delivery.amountDue")')).toBeLessThan(usd.indexOf('t("delivery.amountDueInIqd")'));
    // An advance in dinars: the total in dinars, the advance, what remains.
    const iqd = rows.slice(rows.indexOf("if (d.advance) {"));
    expect(iqd.indexOf('t("delivery.totalInIqd")')).toBeLessThan(iqd.indexOf('t("delivery.advancePaid")'));
    expect(iqd.indexOf('t("delivery.advancePaid")')).toBeLessThan(iqd.indexOf('t("delivery.amountDueInIqd")'));
    // The rate is always on the paper beside the dinars.
    expect(rows).toContain('t("delivery.dollarRate")');
  });

  it("a PDF carries the same dinars as the printout", () => {
    expect(between("export function downloadBoxReceiptPDF", "\n}\n")).toContain("dinar: options?.dinar,");
  });

  it("has all four languages for every dinar line", () => {
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      const raw = fs.readFileSync(path.join(__dirname, "..", "locales", `${lang}.json`), "utf8").replace(/^\uFEFF/, "");
      const delivery = JSON.parse(raw).delivery ?? {};
      for (const key of ["dollarRate", "totalInIqd", "amountDueInIqd", "advancePaid", "amountDue"]) {
        expect(delivery[key], `${lang}.delivery.${key} is missing`).toBeTruthy();
      }
    }
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
    const a = src.indexOf("export function buildBoxReceiptHtml");
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
    expect(panel).toContain("settlement: { ...settlementForPrint, ...receiptDiscount(lang, given) },");
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
