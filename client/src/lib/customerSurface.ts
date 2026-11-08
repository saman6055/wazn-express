/**
 * Which addresses belong to customers, and which host is the office's.
 *
 * Owner, 2026-11-08: a customer opened the staff door thinking it was theirs,
 * and the office guard held them for "probing". The staff door is hidden
 * from customers everywhere:
 *
 *  - waznexpress.com is the customers' address: /staff-login there goes to
 *    the customer sign-in. Staff sign in at admin.waznexpress.com.
 *  - A customer session that reaches an office page is sent to the portal
 *    before the page draws or asks the server anything (App.tsx), so no
 *    office call is ever made in a customer's name by accident.
 */

/** Addresses a customer may be on. Everything else is an office page. */
export function isCustomerSurface(path: string): boolean {
  const p = path.split(/[?#]/)[0] || "/";
  return (
    p === "/" ||
    p === "/portal" || p.startsWith("/portal/") ||
    p === "/customer-login" ||
    p === "/store" || p.startsWith("/store/") ||
    p.startsWith("/t/") ||
    p === "/404"
  );
}

/** The office's own host: admin.waznexpress.com (staff. kept as an alias), and a developer's localhost. */
export function onOfficeHost(host: string = typeof window !== "undefined" ? window.location.hostname : ""): boolean {
  return host.startsWith("admin.") || host.startsWith("staff.") || host === "localhost" || host === "127.0.0.1";
}

/** Where a customer signs in, from any host. */
export const CUSTOMER_LOGIN_URL = "https://waznexpress.com/customer-login";
