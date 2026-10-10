import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-10-10, with the customers list and a customer's profile
 * open: «کە کلیکم لەسەر کرد یەکسەر داخلی حسابات بێ» and «کە کلیک لەسەر باڵانس
 * دەکەم وردەکاری تەواوم بداتێ - ئەو قەرزە چۆن چۆنی چێ بووە … هەمان ژمارە
 * دەرچێتەوە».
 *
 * The explanation he asked for was already built (the card «ئەم قەرزە بۆ
 * چییە؟» on the account page: four parts, each opening its parcels, adding
 * up to what the account shows). Nothing led to it: a row of the list did
 * nothing when pressed, and the balance on the profile switched a tab
 * further down the page.
 *
 * Looked at in the local app: a press on a row opens /finance/customer/1;
 * both balance figures on the profile open /finance/customer/1#debt and the
 * card stands under the top bar, its five items each a link to its parcel.
 */
describe("a customer's balance leads to the account that explains it", () => {
  const list = read("pages/Customers.tsx");
  const profile = read("pages/customers/CustomerDetail.tsx");
  const card = read("components/customers/CustomerDebtExplained.tsx");

  it("a press on a row of the list opens the account", () => {
    expect(list).toContain('data-testid="customer-row"');
    expect(list).toContain("setLocation(accountPath(customer.id));");
    // Somebody who may not open the finance pages gets the profile instead.
    expect(list).toContain("canViewPath(`/finance/customer/${id}`) ? `/finance/customer/${id}` : `/customers/${id}`");
  });

  it("a button or a link inside the row keeps its own press", () => {
    expect(list).toContain('closest("button, a, input, [role=\'menuitem\'], [role=\'dialog\']")');
    // The eye still opens the profile.
    expect(list).toContain("onClick={() => setLocation(`/customers/${customer.id}`)}");
  });

  it("both balance figures on the profile open the account, at the card", () => {
    expect(profile).toContain("`/finance/customer/${customerId}${DEBT_ANCHOR}`");
    expect(profile).toContain("balanceHref={accountHref}");
    expect(profile).toContain('<Drill href={accountHref} onClick={() => setTab("finance")}>');
    expect(read("components/customers/CustomerSummaryHeader.tsx")).toContain('data-testid="summary-balance-link"');
  });

  it("the card answers to that address, and comes to whoever asked for it", () => {
    expect(card).toContain('export const DEBT_ANCHOR = "#debt";');
    expect(card).toContain("<Card id={DEBT_ANCHOR.slice(1)}");
    const effect = card.indexOf("window.location.hash !== DEBT_ANCHOR");
    expect(effect).toBeGreaterThan(-1);
    // Before the early returns: a hook under one breaks the page.
    expect(effect).toBeLessThan(card.indexOf('if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;'));
  });
});
