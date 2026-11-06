/** The debtors report: the company's own code is not a debtor; each row says why and reminds on WhatsApp (owner, 2026-11-05, point 12). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("debtors report detail", () => {
  const page = read("client/src/pages/finance/DebtorsReport.tsx");
  it("leaves the house account out", () => {
    expect(page).toContain("!acc.customer?.isHouseAccount");
    expect(read("server/db/customers.db.ts")).toContain("isHouseAccount: customers.isHouseAccount,");
  });
  it("each row opens why, and the WhatsApp button carries the reminder", () => {
    expect(page).toContain("<DebtWhyRow customerId={debtor.customerId} />");
    expect(page).toContain("<DebtWhatsAppButton");
    expect(page).not.toContain("https://wa.me/${whatsappNumber(debtor.customerMobile)}");
  });
});
