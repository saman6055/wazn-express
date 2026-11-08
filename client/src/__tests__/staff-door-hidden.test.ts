import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isCustomerSurface, onOfficeHost } from "@/lib/customerSurface";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-08: a customer opened the staff door thinking it was theirs
 * and the office guard held them. The staff door is hidden from customers.
 */
describe("the staff door is hidden from customers", () => {
  it("knows the customers' addresses from the office's", () => {
    for (const p of ["/", "/portal", "/portal/financial", "/customer-login", "/store/abc", "/t/xyz", "/portal?x=1"]) expect(isCustomerSurface(p), p).toBe(true);
    for (const p of ["/dashboard", "/batches", "/staff-login", "/customers/3", "/portal-center"]) expect(isCustomerSurface(p), p).toBe(false);
  });

  it("the office host is admin. (or staff., or a developer's localhost); waznexpress.com is not", () => {
    expect(onOfficeHost("admin.waznexpress.com")).toBe(true);
    expect(onOfficeHost("staff.waznexpress.com")).toBe(true);
    expect(onOfficeHost("waznexpress.com")).toBe(false);
    expect(onOfficeHost("www.waznexpress.com")).toBe(false);
  });

  it("the router sends a customer off an office page before it draws, and /staff-login off the customers' host", () => {
    const app = read("client/src/App.tsx");
    const router = app.slice(app.indexOf("function Router() {"), app.indexOf("<Switch>"));
    expect(router).toContain('if (location === "/staff-login" && !onOfficeHost()) return <Redirect to="/customer-login" replace />;');
    expect(router).toContain('if (office && isCustomer) return <Redirect to="/portal" replace />;');
    expect(router).toContain("if (office && loading) return <LoadingSkeleton />;");
    expect(read("client/src/components/DashboardLayout.tsx")).toContain("if (loading || (user && (user as any).isCustomer)) {");
  });

  it("the customer sign-in has no staff link, and the staff sign-in points customers away", () => {
    const customer = read("client/src/pages/public/CustomerLogin.tsx");
    expect(customer).not.toContain('t("auto.text_9b64a9")');
    expect(customer).not.toContain("If you are staff");
    expect(read("client/src/pages/public/StaffLogin.tsx")).toContain('data-testid="staff-login-customer-door"');
    expect(read("client/src/const.ts")).toContain('isCustomerSurface || !officeHost ? "/customer-login" : "/staff-login"');
  });
});
