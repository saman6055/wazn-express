import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The debtors report, read rather than displayed.
 *
 * The owner, 2026-09-22: "this one too — every part linked and clickable and
 * full of information, not just display."
 *
 * Two of its columns were empty for every row, and one of them was quietly
 * wrong: the page read `customerCode` and `lastTransactionDate` off the
 * account, where neither exists. The customer's code sits on the customer the
 * account carries, and the column is `lastTransactionAt`. The second of those
 * decided the ages: with no last activity, every debtor was aged from the day
 * their account was opened, so somebody who paid last week sat in "90+".
 */

const SRC = __dirname;
const page = fs.readFileSync(path.join(SRC, "pages", "DebtorsReport.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("the figures are real", () => {
  it("ages a debtor by their last movement, not by when the account was opened", () => {
    expect(page).toContain("const lastActivity = acc.lastTransactionAt ?? acc.lastTransactionDate ?? null;");
    expect(page).toContain("const lastActivityDate = lastActivity ? new Date(lastActivity) : new Date(acc.createdAt);");
    // The name that never existed must not be read anywhere any more.
    expect(page).not.toContain("acc.lastTransactionDate ? new Date");
    expect(page).not.toContain("debtor.lastTransactionDate");
  });

  it("takes the customer's code and name from the customer, where they live", () => {
    expect(page).toContain("customerCode: acc.customer?.customerCode ?? acc.customerCode ?? null,");
    expect(page).toContain("customerName: acc.customer?.fullName ?? null,");
    expect(page).toContain("customerMobile: acc.customer?.mobileNumber ?? null,");
  });

  it("searches by the name as well as the code", () => {
    expect(page).toContain("acc.customerName?.toLowerCase().includes(term)");
  });
});

describe("every cell that stands for something opens it", () => {
  it("the code opens the customer, the account number and the debt open the statement", () => {
    expect(page).toContain("href={`/customers/${debtor.customerId}`}");
    expect((page.match(/href=\{`\/finance\/customer\/\$\{debtor\.customerId\}`\}/g) ?? []).length).toBe(3);
  });

  it("the age chip filters the table to its own bucket", () => {
    expect(page).toContain("onClick={() => setAgingFilter(agingFilter === debtor.agingCategory ? 'all' : debtor.agingCategory)}");
  });

  it("and a row offers their parcels and a message to them", () => {
    expect(page).toContain("packagesHref({ search: customerCodeOnly(debtor.customerCode) })");
    expect(page).toContain("`https://wa.me/${whatsappNumber(debtor.customerMobile)}`");
    // Nothing is offered when there is nothing to offer.
    expect(page).toContain("{debtor.customerMobile && whatsappNumber(debtor.customerMobile) && (");
  });

  it("the buckets at the top still filter, as they did", () => {
    for (const bucket of ["0-30", "30-60", "60-90", "90+"]) {
      expect(page, bucket).toContain(`setAgingFilter(agingFilter === '${bucket}' ? 'all' : '${bucket}')`);
    }
  });

  it("says something rather than a dash when a debtor has never moved", () => {
    expect(page).toContain("pickLang(language, NO_ACTIVITY_WORDS)");
    expect(page).toContain('ku: "هیچ کارێک"');
  });
});
