import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { DASHBOARD_FIGURE_IDS, figureMeta } from "@shared/dashboardExplain";

/**
 * No headline figure on the dashboard is a dead number.
 *
 * The complaint that started this: twenty-odd numbers, none of them clickable,
 * none saying where they came from. Answering "which ones?" meant opening a
 * list and rebuilding the filter by hand.
 *
 * These read source text, because the dashboard needs a database to render.
 * They check the two things that actually go wrong: a figure wired to nothing,
 * and a figure whose explanation was written but never reached the card.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const DASHBOARD = read("client/src/pages/Dashboard.tsx");

describe("the file this is checking", () => {
  it("is the admin dashboard", () => {
    expect(DASHBOARD.length).toBeGreaterThan(20_000);
    expect(DASHBOARD).toContain("FinancialCard");
    expect(DASHBOARD).toContain("StatsCard");
  });
});

describe("every headline figure can be opened", () => {
  /** The figures that must be wired to a card on this page. */
  const ON_DASHBOARD = [
    "todayIncome",
    "weekIncome",
    "monthIncome",
    "totalDebt",
    "newCustomers",
    "totalCustomers",
    "activeBatches",
    "totalPackages",
    "deliveredPackages",
  ] as const;

  it("is wired to a card", () => {
    const missing = ON_DASHBOARD.filter((id) => !DASHBOARD.includes(`figure="${id}"`));
    expect(
      missing,
      `these figures have an explanation nobody can reach:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("has an explanation for everything that is wired", () => {
    // The other direction: a card claiming a figure id that the registry has
    // never heard of would open an empty panel.
    const wired = [...DASHBOARD.matchAll(/figure="([a-zA-Z]+)"/g)].map((m) => m[1]);
    expect(wired.length).toBeGreaterThanOrEqual(ON_DASHBOARD.length);
    const unknown = wired.filter((id) => !(DASHBOARD_FIGURE_IDS as string[]).includes(id));
    expect(unknown, `no explanation for:\n${unknown.join("\n")}`).toEqual([]);
  });

  it("every registered figure is used somewhere", () => {
    // An explanation nobody shows is documentation pretending to be a feature.
    const unused = DASHBOARD_FIGURE_IDS.filter((id) => !DASHBOARD.includes(`figure="${id}"`));
    expect(unused, `written but never shown:\n${unused.join("\n")}`).toEqual([]);
  });
});

describe("nothing on the page is a dead end", () => {
  it("a point on the daily chart opens that day's parcels", () => {
    // The chart drops the real date when it formats "Aug 16" for the axis,
    // so the day is carried separately — without it a click could only ever
    // open the whole table.
    expect(DASHBOARD).toContain("openChartDay");
    expect(DASHBOARD).toMatch(/packagesHref\(\{\s*day\s*\}\)/);
    expect(DASHBOARD).toContain("onClick={openChartDay}");
  });

  it("the parcels table honours the day it is given", () => {
    // Otherwise the link lands on an unfiltered list, which looks like an
    // answer and is not one.
    const packages = read("client/src/pages/Packages.tsx");
    expect(packages).toContain("dayFilter");
    expect(packages).toContain("readPackagesLink");
    expect(packages).toContain("FilteredByLinkBanner");
  });

  it("a debtor, a shipment and a top customer each open their own record", () => {
    expect(DASHBOARD).toContain("/finance/customer/${debtor.customerId}");
    expect(DASHBOARD).toContain("/batches/${batch.id}/financial");
    expect(DASHBOARD).toContain("/finance/customer/${customer.customerId}");
  });

  it("the self-order tiles all open the self orders", () => {
    // Three of the four were plain divs, so two thirds of the card was inert
    // beside a fourth tile that linked.
    const links = [...DASHBOARD.matchAll(/href="\/self-orders"/g)];
    expect(links.length).toBeGreaterThanOrEqual(4);
  });
});

describe("the panel is one panel", () => {
  it("every card goes through the same component", () => {
    // A dozen slightly different drill-downs is how they drift apart, and the
    // whole value here is that the number on the card and the number in the
    // panel are the same number.
    for (const file of [
      "client/src/components/dashboard/FinancialCard.tsx",
      "client/src/components/dashboard/StatsCard.tsx",
      "client/src/pages/Dashboard.tsx",
    ]) {
      expect(read(file), file).toContain("ExplainableStat");
    }
  });

  it("the panel is told the number the card is showing", () => {
    // Not fetched a second time: two queries against a moving table would
    // disagree with each other for reasons nobody could explain.
    const component = read("client/src/components/dashboard/ExplainableStat.tsx");
    expect(component).toContain("value: number");
    expect(component).toContain("figure: DashboardFigureId");
  });
});

describe("every link lands on real records", () => {
  const APP = read("client/src/App.tsx");
  const routes = [...APP.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

  it("found the routes", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("no figure links to a page that does not exist", () => {
    // A drill-down that ends on a 404 is worse than one that ends nowhere.
    const dead = DASHBOARD_FIGURE_IDS
      .map((id) => ({ id, href: figureMeta(id).href }))
      .filter(({ href }) => !routes.includes(href.split("?")[0]));
    expect(
      dead.map((d) => `${d.id} → ${d.href}`),
      "these links go nowhere",
    ).toEqual([]);
  });
});
