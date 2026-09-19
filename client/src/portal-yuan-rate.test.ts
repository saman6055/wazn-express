import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The yuan a customer sees is the yuan they can buy, and the office edits one
 * rate from either screen (owner, 2026-09-19). The server side is tested in
 * server/shared-rmb-rate.test.ts.
 */

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

describe("the home ticker's yuan", () => {
  const home = read("pages/portal/PortalHome.tsx");

  it("is the price of buying yuan, and only while buying yuan is on", () => {
    expect(home).toContain("trpc.customerPortal.getYuanExchangeInfo.useQuery(undefined, PORTAL_SETTINGS_QUERY)");
    expect(home).toContain("const yuanRate = yuanInfo?.enabled && Number(yuanInfo.rate) > 0 ? Number(yuanInfo.rate) : null;");
    expect(home).not.toContain("priceList?.rates?.rmb");
  });

  it("says so, opens the page where yuan is bought, and wraps instead of cutting a figure off", () => {
    expect(home).toContain('<Link href="/portal/yuan-exchange"');
    expect(home).toContain('ku: "کڕینی یوان:"');
    const ticker = home.slice(home.indexOf("{(yuanRate || iqdRate) && ("), home.indexOf("{/* Hero action"));
    expect(ticker.length).toBeGreaterThan(100);
    expect(ticker).toContain("flex flex-wrap");
    expect(ticker).not.toContain("whitespace-nowrap");
  });
});

describe("both screens say it is one rate", () => {
  it("the Portal Center's yuan card and Settings → Currency point at each other", () => {
    expect(read("pages/PortalCenter.tsx")).toContain("هەمان نرخی ڕێکخستنەکان ← دراوە");
    expect(read("pages/Settings.tsx")).toContain("هەمان نرخی کڕینی یوانی پۆرتاڵە");
  });

  it("a save on either side refreshes the other", () => {
    expect(read("pages/PortalCenter.tsx")).toContain("utils.exchangeRates.invalidate();");
    expect(read("pages/Settings.tsx")).toContain("utils.portalCenter.getYuanSettings.invalidate();");
  });
});
