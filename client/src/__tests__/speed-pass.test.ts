import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** This test's old home: paths below are read from here. */
const ROOT_DIR = path.resolve(__dirname, "..");

/**
 * Speed, measured on a full database (2026-11-02). The database was never the
 * problem: the size of the answers and the redrawing of whole pages were.
 */
const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), "utf8").replace(/\r\n/g, "\n");
const server = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, "..", "..", "server", rel), "utf8").replace(/\r\n/g, "\n");

describe("a picker asks for what a picker reads", () => {
  it("keeps the receipt's language", () => {
    // Read through a cast in the box panel, so the compiler would not say so.
    const db = server("db/customers.db.ts");
    const columns = db.slice(db.indexOf("const CUSTOMER_PICKER_COLUMNS"), db.indexOf("/** The customer beside a balance"));
    expect(columns).toContain("nationality: customers.nationality");
  });

  it("the customers page alone reads the full list", () => {
    expect(read("hooks/useCustomers.ts")).toContain("trpc.customers.list.useQuery");
    expect(read("components/CommandPalette.tsx")).toContain("trpc.customers.picker.useQuery");
  });
});

describe("the dashboard", () => {
  it("asks for numbers, not for lists to count", () => {
    const page = read("pages/dashboard/Dashboard.tsx");
    expect(page).toContain("trpc.dashboard.customerCounts.useQuery");
    // The late tiles are counted on the server too (dashboard.lateAlerts, 2026-11-05).
    expect(page).toContain("trpc.dashboard.lateAlerts.useQuery");
    expect(page).not.toContain("pageSize: 500");
    expect(page).not.toContain("trpc.customers.picker");
  });
});

describe("the order list", () => {
  it("finds its page before it opens any photo", () => {
    const db = server("db/fullPackage.db.ts");
    const body = db.slice(db.indexOf("let ordersResult;"));
    expect(body.indexOf(".select({ id: fullPackageOrders.id })")).toBeLessThan(body.indexOf("hasImage: HAS_IMAGE"));
  });
});

describe("one slow answer does not hold the others", () => {
  it("sends the slow few on their own", () => {
    const main = read("main.tsx");
    expect(main).toContain("condition: (op) => op.type === \"query\" && SENT_ALONE.has(op.path)");
    for (const slow of ["audit.brief", "customers.picker", "deliveryBox.awaitingPayment"]) expect(main).toContain(`"${slow}"`);
  });
});

describe("typing", () => {
  it("redraws the box, not the page", () => {
    for (const page of ["pages/packages/Packages.tsx", "pages/customers/Customers.tsx", "pages/finance/Finance.tsx", "pages/orders/FullPackageDashboard.tsx", "pages/orders/CommissionDashboard.tsx", "pages/orders/UnifiedOrdersDashboard.tsx"]) {
      expect(read(page), page).toContain("<DebouncedSearchInput");
    }
  });

  it("Enter does not wait: a scanner sends one", () => {
    const box = read("components/DebouncedSearchInput.tsx");
    expect(box).toContain('if (e.key === "Enter") {');
    expect(box).toContain("latest.current(text);");
  });

  it("the accounts list draws a page at a time", () => {
    const page = read("pages/finance/Finance.tsx");
    expect(page).toContain("accountPage.pageRows.map(");
    expect(page).toContain("<ListPager {...accountPage} />");
  });
});
