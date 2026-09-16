import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A discount given at the counter is something the customer can see (owner,
 * 2026-09-16, BOX-20260910-005).
 *
 * The box row said "… · RCP-20260910-0001 · Discount $…" and the phone cut
 * the line before the amount; the box document stopped at the total. So the
 * one piece of good news on the receipt was the piece nobody could read.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

describe("the discount on a box is never the part that gets cut off", () => {
  it("has its own chip on the row, in the portal and in the office", () => {
    for (const page of ["pages/portal/PortalFinancial.tsx", "pages/CustomerFinance.tsx"]) {
      const src = read(page);
      expect(src, page).toContain("highlight: Number(b.settledDiscountUsd) > 0");
      // …and is no longer the tail of the one-line meta.
      expect(src, page).not.toMatch(/b\.settlementNumber \|\| null,\s*Number\(b\.settledDiscountUsd\)/);
    }
    const row = read("components/AccountRowList.tsx");
    expect(row).toContain("{row.highlight && (");
  });

  it("is on the box document, with the advance and the payment beside it", () => {
    const doc = read("components/BoxInvoiceView.tsx");
    expect(doc).toContain('data-testid="box-discount"');
    expect(doc).toContain('data-testid="box-advance"');
    expect(doc).toContain('data-testid="box-paid"');
    expect(read("pages/portal/PortalFinancial.tsx")).toContain("money={boxInvoice.money}");
    expect(read("pages/CustomerFinance.tsx")).toContain("money={officeBoxInvoice.money}");
  });

  it("comes from the receipts and the orders, for the customer's own box", () => {
    const portal = fs.readFileSync(path.join(__dirname, "../../server/routers/portal.router.ts"), "utf8");
    expect(portal).toContain("money: boxMoneyIn(items, box),");
  });
});
