import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

/** Every path the router knows, as a matcher (":id" matches one segment). */
const ROUTES = [...read("App.tsx").matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => {
  const pattern = m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z]+/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
});

// Files, not pages: served as they are, never by the router.
const NOT_PAGES = /^\/(api|uploads|icons|brand|app-icons|manifest\.json|site|sw\.js|theme-init\.js|favicon)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("every internal link lands on a page", () => {
  it("no literal link, redirect or navigation points at an address the router does not have", () => {
    const LINK = /(?:href=|setLocation\(|navigate\(|window\.location\.href\s*=\s*|<Redirect\s+to=)\s*["'](\/[^"'#?\s]*)/g;
    const dead: string[] = [];
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(LINK)) {
        const target = m[1] === "" ? "/" : m[1];
        if (NOT_PAGES.test(target)) continue;
        if (!ROUTES.some((r) => r.test(target))) {
          dead.push(`${path.relative(SRC, file).replace(/\\/g, "/")}: ${target}`);
        }
      }
    }
    expect(dead).toEqual([]);
  });

  it("an audit-log batch opens the batch's own page", () => {
    expect(read("pages/AuditLogs.tsx")).toContain("return `/batches/${entityId}/financial`;");
  });

  it("a purchase request is not a link to nowhere", () => {
    const src = read("components/customers/CustomerPendingOrdersSection.tsx");
    expect(src).not.toContain("/purchase-request/");
    expect(src).toContain("onClick={route ? () => navigate(route) : undefined}");
  });
});

describe("Back and home", () => {
  it("the 404 page goes to the reader's own home, and Back never does nothing", () => {
    const src = read("pages/NotFound.tsx");
    expect(src).toContain("goBackOr(home, setLocation)");
    expect(src).toMatch(/const home = location\.startsWith\("\/portal"\) \|\| isCustomer \? "\/portal" : user \? "\/dashboard" : "\/"/);
    expect(src).not.toMatch(/"h-4 w-4" \+/);
  });

  it("the staff header's Back button has a way home", () => {
    const src = read("components/DashboardLayout.tsx");
    expect(src).not.toContain("window.history.back()");
    expect(src).toContain('goBackOr("/dashboard", setLocation)');
  });
});

describe("a page the account has no permission for", () => {
  it("is refused only once permissions have really arrived", () => {
    expect(read("hooks/usePermissions.ts")).toContain('isReady: userRole === "super_admin" || Boolean(userPermissions)');
    const layout = read("components/DashboardLayout.tsx");
    expect(layout).toContain("permissionsReady && !canViewPath(location) ? (");
    expect(layout).toContain("<NoAccessPanel />");
  });
});
