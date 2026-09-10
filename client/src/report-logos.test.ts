import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every report, every PDF, carries the mark — the owner's request.
 *
 * An inventory in September 2026 found 36 printable documents and a logo on
 * two of them. Each report builds its own HTML and opens its own window, so
 * there is no shared header to fix once; these tests hold each one to it.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

/** Reports written into a window of their own. */
const PRINT_WINDOWS = [
  "pages/BatchFinancialReport.tsx",
  "pages/CustomerFinance.tsx",
  "pages/portal/PortalFinancial.tsx",
  "pages/portal/PortalInvoiceReports.tsx",
  "pages/Finance.tsx",
  "pages/BatchReports.tsx",
  "pages/CommissionDashboard.tsx",
  "pages/FullPackageDashboard.tsx",
  "pages/InvoiceReports.tsx",
  "pages/ServicesManagement.tsx",
  "pages/ServicesReport.tsx",
  "pages/AuditLogs.tsx",
  "hooks/useDataManagement.ts",
  "lib/labelPrintUtils.ts",
  "lib/batchLabelPrintUtils.ts",
];

/** Pages printed in place with window.print(), where the sidebar logo is hidden. */
const IN_PAGE = [
  "components/DailyBrief.tsx",
  "pages/ProfitReports.tsx",
  "pages/ProfitDashboardByType.tsx",
  "components/BoxInvoiceView.tsx",
  "components/BatchInvoiceView.tsx",
];

describe("the mark on every printed report", () => {
  it("every report window puts it in its header", () => {
    const missing = PRINT_WINDOWS.filter((rel) => !read(rel).includes("reportLogoHtml("));
    expect(missing, `no logo in: ${missing.join(", ")}`).toEqual([]);
  });

  it("both portal documents carry it — the invoice and the payment receipt", () => {
    const portal = read("pages/portal/PortalFinancial.tsx");
    expect(portal.split("reportLogoHtml(company.logoUrl)").length - 1).toBe(2);
  });

  it("every page printed in place shows it on paper", () => {
    const missing = IN_PAGE.filter((rel) => !read(rel).includes("<PrintOnlyLogo"));
    expect(missing, `no print-only logo in: ${missing.join(", ")}`).toEqual([]);
  });

  it("never takes the raw stored logo, which may point at a file that is gone", () => {
    // getCompanyInfoFromSettings reads Settings as stored; only the server's
    // getCompanyInfo (useCompanyInfo) knows whether that file still exists.
    const offenders = PRINT_WINDOWS.filter((rel) => {
      const src = read(rel);
      return src.includes("getCompanyInfoFromSettings") && src.includes("reportLogoHtml(company.logoUrl)");
    });
    expect(offenders).toEqual([]);
  });

  it("the labels draw the real mark, not the old box-icon placeholder", () => {
    expect(read("lib/labelPrintUtils.ts")).not.toContain("M21 16V8a2 2 0 0 0-1-1.73l-7-4");
  });

  it("the invoice page gives its print window an address it can load", () => {
    // The print window is about:blank: a relative "/brand/…" resolves to nothing.
    expect(read("pages/InvoiceView.tsx")).toContain("absoluteLogoUrl(company.logoUrl)");
  });
});

describe("a report prints after its logo has loaded", () => {
  it("the reports that printed at once now wait for their images", () => {
    for (const rel of [
      "pages/BatchFinancialReport.tsx",
      "pages/BatchReports.tsx",
      "pages/ServicesManagement.tsx",
      "pages/ServicesReport.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("printWhenReady(printWindow)");
      expect(src, rel).not.toContain("printWindow.document.close();\n      printWindow.print();");
    }
  });
});
