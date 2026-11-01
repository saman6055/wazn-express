import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's list, item 5 (2026-09-11): every staff screen is drawn inside
 * the staff frame — the sidebar, the way back, and the frame's sign-in check.
 * These ten rendered bare; a signed-out visitor saw the page's shell and a
 * row of failed requests instead of the sign-in prompt.
 */
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");
const APP = read("App.tsx");

const ONCE_BARE = [
  "AdvancedSettings",
  "BackupManagement",
  "BankAccounts",
  "BulkOrderForm",
  "CurrencyManagement",
  "EmailTemplatesManagement",
  "IpWhitelistManagement",
  "ScheduledBackups",
  "SystemMonitorDashboard",
  "TaxRatesManagement",
];

describe("staff screens are drawn inside the staff frame", () => {
  it.each(ONCE_BARE)("%s gets the frame exactly once", (name) => {
    const framedByApp = new RegExp(`const ${name} = staffPage\\(\\(\\) => import\\("\\./pages/${name}"\\)\\);`).test(APP);
    const framesItself = read(`pages/${name}.tsx`).includes("<DashboardLayout");
    expect(framedByApp || framesItself, `${name} is drawn without the frame and its sign-in check`).toBe(true);
    expect(framedByApp && framesItself, `${name} would draw the frame twice`).toBe(false);
  });

  it("the frame goes around the page, not beside it", () => {
    const helper = APP.slice(APP.indexOf("function staffPage("), APP.indexOf("function staffPage(") + 400);
    expect(helper).toMatch(/<DashboardLayout>\s*<Page \/>\s*<\/DashboardLayout>/);
  });
});
