import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { isReceiptPage } from "@shared/customerFeatures";

/**
 * The Portal Center's features tab, phase 3 of the owner's brief
 * (2026-09-18): each customer holding a feature shows when it was given, by
 * whom, and when they last opened their invoices in the portal — with a link
 * to their profile (phase 1).
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the pages where a customer sees their invoices", () => {
  it("are the finance section and the invoice reports", () => {
    expect(isReceiptPage("/portal/financial")).toBe(true);
    expect(isReceiptPage("/portal/invoice-reports")).toBe(true);
    expect(isReceiptPage("/portal/shipments")).toBe(false);
    expect(isReceiptPage(null)).toBe(false);
  });

  it("are the pages the portal records, as the portal names them", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/portal/financial"');
    expect(app).toContain('path="/portal/invoice-reports"');
    expect(read("client/src/components/CustomerPortalLayout.tsx")).toContain("trackActivity.mutate({ path: location });");
  });
});

describe("each grant says when, by whom, and whether it is used", () => {
  it("the server sends who gave it and when the customer last opened their invoices", () => {
    expect(read("server/db/portal.db.ts")).toContain("grantedByName: users.name,");
    const router = read("server/routers/portalCenter.router.ts");
    expect(router).toContain("const seen = await db.lastReceiptViewsFor(grants.map((g) => g.customerId));");
    expect(read("server/db/portalCenter.db.ts")).toContain("RECEIPT_PAGE_PREFIXES.map((prefix) => like(customerActivityLog.path, `${prefix}%`))");
  });

  it("the page shows all three, and the customer's code opens the profile", () => {
    const page = read("client/src/pages/PortalCenter.tsx");
    expect(page).toContain('<bdi dir="ltr" className="font-mono">{fmtDateTime(g.createdAt)}</bdi>');
    expect(page).toContain("{g.grantedByName ? (");
    expect(page).toContain("{g.lastReceiptViewAt ? (");
    expect(page).toContain("<CustomerCodeLink id={g.customerId} code={g.customerCode} />");
  });
});
