import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { escapeHtml, openExternal } from "./lib/html";

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("escapeHtml", () => {
  it("turns markup into text", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("prints nothing for a missing value, and a number as its digits", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(12.5)).toBe("12.5");
    expect(escapeHtml(0)).toBe("0");
  });
});

describe("openExternal", () => {
  const open = vi.fn();
  beforeEach(() => {
    open.mockReset();
    vi.stubGlobal("window", { open });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never runs a script address stored in a record", () => {
    openExternal("javascript:alert(1)");
    openExternal("  JavaScript:alert(1)");
    openExternal("data:text/html,<script>alert(1)</script>");
    openExternal("");
    openExternal(null);
    expect(open).not.toHaveBeenCalled();
  });

  it("opens http(s), a same-site path, and a bare domain as https — with no opener", () => {
    openExternal("https://shop.1688.com/x");
    openExternal("/uploads/chat/a.jpg");
    openExternal("shop.1688.com");
    expect(open.mock.calls).toEqual([
      ["https://shop.1688.com/x", "_blank", "noopener,noreferrer"],
      ["/uploads/chat/a.jpg", "_blank", "noopener,noreferrer"],
      ["https://shop.1688.com", "_blank", "noopener,noreferrer"],
    ]);
  });
});

/**
 * Every print window is opened with window.open("") and document.write, so it
 * runs on the app's origin with the session of whoever pressed Print. A value
 * a customer typed in the portal — a tracking number, a product name — must
 * arrive there as text.
 */
describe("print windows print text, never markup", () => {
  // `${x ? `…` : ""}` only asks whether x is there; the value itself is
  // printed (escaped) inside the branch, so a bare condition is not a sink.
  const NOT_A_CONDITION = "(?!\\s*\\?(?![.?]))";
  // Print-only modules: no raw value anywhere.
  const RAW = (names: string) => new RegExp(`\\$\\{(${names})\\b${NOT_A_CONDITION}`);
  // Pages: no raw value right after a tag or inside an attribute.
  const RAW_IN_HTML = (names: string) =>
    new RegExp(`(>|=")\\s*\\$\\{(${names})\\b${NOT_A_CONDITION}`);

  const cases: [string, RegExp][] = [
    ["lib/labelPrintUtils.ts", RAW("tracking|cust\\.(name|code|phone|city)|company\\.name|batchCode|dimensions|weight|t\\.(fontFamily|primaryColor)")],
    ["lib/batchLabelPrintUtils.ts", RAW("cust\\.(name|code)|company\\.name|batchCode|t\\.(fontFamily|primaryColor)")],
    ["lib/deliveryBoxPrintUtils.ts", RAW_IN_HTML("item\\.trackingNumber|customer\\??\\.(fullName|customerCode|city|mobileNumber)|box\\.(boxCode|notes|destinationCity|destinationAddress|recipientPhone)|description|documentTitle|options\\.logoUrl")],
    ["pages/AuditLogs.tsx", RAW_IN_HTML("log\\.|company\\.name")],
    ["pages/BatchFinancialReport.tsx", RAW_IN_HTML("customer\\?\\.(name|code)|company\\.(name|nameKu)|batch\\?\\.batchCode|pkg\\.trackingNumber|title")],
    ["pages/portal/PortalFinancial.tsx", RAW_IN_HTML("customer\\.(fullName|customerCode)|transaction\\.transactionNumber|company\\.name|companyName")],
    ["pages/CommissionDashboard.tsx", RAW_IN_HTML("order\\.(orderCode|productName)|\\(order as any\\)\\.customer|company\\.name")],
    ["pages/FullPackageDashboard.tsx", RAW_IN_HTML("order\\.(orderCode|productName)|\\(order as any\\)\\.customer|company\\.name")],
    ["pages/InvoiceReports.tsx", RAW_IN_HTML("c\\.customer(Name|Code)|company\\.name|title")],
    ["pages/ServicesManagement.tsx", RAW_IN_HTML("getCustomerName|service\\.(description|serviceType)|company\\.name")],
    ["pages/ServicesReport.tsx", RAW_IN_HTML("company\\.(name|nameKu)|type\\.name|customer\\.name")],
    ["pages/BatchReports.tsx", RAW_IN_HTML("company\\.name|batch\\.batchCode")],
    ["hooks/useDataManagement.ts", RAW_IN_HTML("company\\.name")],
    ["pages/Finance.tsx", RAW_IN_HTML("account\\.customer\\?\\.(customerCode|fullName|mobileNumber)|account\\.accountNumber|company\\.name")],
    ["pages/CustomerFinance.tsx", RAW_IN_HTML("customer\\?\\.(customerCode|fullName|mobileNumber)|company\\.name|txn\\.(transactionNumber|description)")],
  ];

  for (const [file, raw] of cases) {
    it(file, () => {
      const src = read(file);
      expect(src, file).toContain("escapeHtml(");
      const hit = src.match(raw);
      expect(hit?.[0] ?? null, file).toBeNull();
    });
  }

  it("the invoice's line items are escaped too", () => {
    expect(read("pages/portal/PortalFinancial.tsx")).not.toContain("'<tr><td>' + item.description");
  });

  it("the box receipt uses the one shared escaper", () => {
    const src = read("lib/deliveryBoxPrintUtils.ts");
    expect(src).toContain('import { escapeHtml } from "./html"');
    expect(src).not.toContain("function escapeHtml");
  });
});

describe("stored addresses open safely", () => {
  it("a supplier's website and a chat attachment go through openExternal", () => {
    expect(read("pages/Suppliers.tsx")).toContain("openExternal((supplier as any).website)");
    expect(read("pages/CustomerMessages.tsx")).toContain("openExternal(msg.attachmentUrl)");
  });
});
