import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** This test's old home: paths below are read from here. */
const ROOT_DIR = path.resolve(__dirname, "..");

/**
 * What opening the real app found that the source alone had not (2026-11-01).
 * Each of these had passed tsc, the tests and the build.
 */
const SRC = ROOT_DIR;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const server = (rel: string) => fs.readFileSync(path.join(SRC, "..", "..", "server", rel), "utf8").replace(/\r\n/g, "\n");

describe("the portal's first colours", () => {
  const hook = read("components/portal/PortalHeaderControls.tsx");

  it("asks the portal's own key, because ThemeContext writes `theme` by itself", () => {
    // Testing `theme` looked right and meant no new customer ever got the
    // portal's default: any page opened before it had already written it.
    const effect = hook.slice(hook.indexOf("useEffect(() => {"), hook.indexOf("setModeState(modeFromTheme(theme, accent));"));
    expect(effect).toContain("localStorage.getItem(PORTAL_MODE_KEY)");
    expect(effect).not.toContain('localStorage.getItem("theme")');
  });

  it("records that the default was given, so it is given once", () => {
    expect(hook).toContain("localStorage.setItem(PORTAL_MODE_KEY, DEFAULT_PORTAL_MODE);");
  });

  it("leaves the office's theme alone during a look", () => {
    expect(hook).toContain("sessionStorage.getItem(VIEW_AS_TOKEN_KEY)");
  });
});

describe("paper", () => {
  it("takes dark mode off for the print and puts it back", () => {
    // Tokens alone were not enough: every `dark:` class stayed on, and an
    // accent's `.dark[data-theme]` outranks a `html.dark` override.
    const main = read("main.tsx");
    expect(main).toContain('addEventListener("beforeprint"');
    expect(main).toContain('addEventListener("afterprint"');
  });

  it("an accent cannot tint the page, and a white title does not vanish", () => {
    const css = read("index.css");
    expect(css).toContain(":root,\n  :root[data-theme] {");
    expect(css).toContain('main [class*="bg-gradient"] {\n    background: none !important;');
  });
});

describe("debt reminders", () => {
  const page = read("pages/finance/DebtReminders.tsx");
  const router = server("routers/finance.router.ts");

  it("go through the door the list's own readers can use", () => {
    // sendNotificationToCustomer is adminProcedure, but an accountant reads
    // this list: every reminder they sent was refused.
    expect(page).toContain("trpc.ledger.sendDebtReminders.useMutation()");
    expect(page).not.toContain("sendNotificationToCustomer");
    expect(router).toContain("sendDebtReminders: accountantProcedure");
  });

  it("the amount is the server's, never the browser's", () => {
    const proc = router.slice(router.indexOf("sendDebtReminders: accountantProcedure"), router.indexOf("// Get total debt"));
    expect(proc).toContain("db.getDebtors(0)");
    expect(proc).not.toMatch(/balanceUsd:\s*z\./);
    expect(proc).not.toMatch(/amount/i);
  });
});

describe("orders dashboard", () => {
  it("has one gutter on a phone, not three", () => {
    const page = read("pages/orders/UnifiedOrdersDashboard.tsx");
    expect(page).toContain('<div className="space-y-6 md:p-6">');
    expect(page).not.toContain('<CardContent className="p-6">');
  });
});
