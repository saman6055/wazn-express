import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's note (Sep 2026): the dashboard header was too big — make it
 * small, refined, modern, and fixed.
 *
 * The old header was a tall coloured banner plus a second row of six stat
 * cards, ~190px before the first table row, and it scrolled away exactly
 * when a long list made the figures worth glancing at. The replacement is
 * one ~49px bar that holds all three things and stays put.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const COMPONENT = "components/layout/StickyDashboardHeader.tsx";
const DASHBOARDS = ["pages/CommissionDashboard.tsx", "pages/FullPackageDashboard.tsx"];

describe("the bar actually sticks, and in the right place", () => {
  const src = read(COMPONENT);

  it("it sticks below the layout's own nav strip, not behind it", () => {
    // DashboardLayout's strip is h-11 (44px) at top-0 on desktop and top-14
    // (56px) on mobile. top-0 here would park the header underneath it.
    expect(src).toContain('"sticky top-[100px] z-20 md:top-[44px]"');
  });

  it("the layout it measures against has not moved", () => {
    const layout = read("components/DashboardLayout.tsx");
    expect(layout, "nav strip height").toContain("h-11");
    expect(layout, "mobile offset").toContain('isMobile ? "top-14" : "top-0"');
    expect(layout, "page padding").toContain('<div className="p-4 md:p-6">');
    // Sticky dies silently if an ancestor scrolls; main must not.
    const main = layout.slice(layout.indexOf("<main"), layout.indexOf("<main") + 400);
    expect(main).not.toContain("overflow-");
  });

  it("its full-bleed margins match that page padding", () => {
    expect(src).toContain('"-mx-4 mb-4 px-4 py-2 md:-mx-6 md:px-6"');
  });
});

describe("one line, not two blocks", () => {
  const src = read(COMPONENT);

  it("the figures live in the bar", () => {
    expect(src).toContain("stats.map((stat)");
    expect(src).toContain("text-[11px] text-muted-foreground");
  });

  it("the figures scroll sideways instead of wrapping into a second row", () => {
    expect(src).toContain("overflow-x-auto");
    // A visible scrollbar inside a 49px bar would be its own eyesore.
    expect(src).toContain("[&::-webkit-scrollbar]:hidden");
    expect(src).toContain("[scrollbar-width:none]");
  });

  it("nothing is taller than it needs to be", () => {
    expect(src).toContain("h-7 w-7");            // the mark
    expect(src).toContain("text-[15px]");        // the title
    expect(src).toContain("py-2");               // the bar's own padding
    expect(src).not.toContain("text-2xl");
  });
});

describe("both dashboards use it, and neither kept the old banner", () => {
  it("each renders the shared bar", () => {
    for (const rel of DASHBOARDS) {
      const src = read(rel);
      expect(src, rel).toContain('import { StickyDashboardHeader } from "@/components/layout/StickyDashboardHeader";');
      expect(src, rel).toContain("<StickyDashboardHeader");
    }
  });

  it("the tall coloured banner is gone from both", () => {
    expect(read("pages/CommissionDashboard.tsx")).not.toContain("from-amber-500 to-yellow-600");
    expect(read("pages/FullPackageDashboard.tsx")).not.toContain("from-emerald-600 to-emerald-700");
  });

  it("the six stat cards are gone, and the six figures are not", () => {
    const commission = read("pages/CommissionDashboard.tsx");
    expect(commission).not.toContain("lg:grid-cols-6");
    for (const key of [
      "commission.totalOrdersLabel", "commission.pendingLabel", "commission.orderedLabel",
      "commission.deliveredLabel", "commission.totalCostLabel", "commission.totalCommissionLabel",
    ]) {
      expect(commission, key).toContain(key);
    }

    const fullPackage = read("pages/FullPackageDashboard.tsx");
    expect(fullPackage).not.toContain("lg:grid-cols-6");
    for (const key of [
      "fullPackage.ordersCountLabel", "fullPackage.pendingLabel", "fullPackage.inTransitLabel",
      "fullPackage.totalPurchaseCost", "fullPackage.grossProfitLabel", "fullPackage.netProfitLabel",
    ]) {
      expect(fullPackage, key).toContain(key);
    }
  });

  it("money still reads left to right on an RTL page", () => {
    for (const rel of DASHBOARDS) {
      expect(read(rel), rel).toContain("ltr: true");
    }
  });
});
