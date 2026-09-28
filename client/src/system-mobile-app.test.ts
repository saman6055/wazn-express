import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { MOBILE_TABS, TAB_ROOTS, currentItem } from "./components/mobile/MobileAppShell";

/**
 * The owner, 2026-09-27: «کردنەوەی سیستەم لە مۆبایل هێشتا وەکو دیسک تۆپە…
 * وەکو ئەپی پۆرتال بێت». On a phone the office is an app: its own top bar,
 * a tab bar, a scan sheet and a «زیاتر» grid instead of the desktop chrome.
 */

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

describe("the office on a phone", () => {
  const layout = read("components/DashboardLayout.tsx");

  it("draws the app bars on a phone and keeps the desktop chrome for a desktop", () => {
    expect(layout).toContain("<MobileTopBar");
    expect(layout).toContain("<MobileTabBar");
    expect(layout).toContain("<MobileMoreSheet");
    expect(layout).toContain("<MobileScanSheet");
    // The tool strip and the rail step aside on a phone, only there.
    expect(layout).toContain('isMobile && "hidden",');
    expect(layout).toContain('className={cn(isMobile && "hidden")}');
    // Room for both bars, the notch and the home indicator.
    expect(layout).toContain("pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]");
  });

  it("five tabs, the scan button in the middle", () => {
    expect(MOBILE_TABS.map((t) => t.key)).toEqual(["home", "parcels", "scan", "batches", "more"]);
    expect(TAB_ROOTS).toEqual(["/dashboard", "/packages/all", "/batches"]);
  });

  it("the sheets use the menu the desktop uses — permissions decided once", () => {
    expect(layout).toContain("groups={menuGroups}");
    const shell = read("components/mobile/MobileAppShell.tsx");
    expect(shell).toContain("MOBILE_TABS.filter((t) => !t.path || canViewPath(t.path))");
  });

  it("a sheet is one step of history, and leaving from it is not undone by that step", () => {
    const shell = read("components/mobile/MobileAppShell.tsx");
    expect(shell).toContain("useBackCloses(sheet !== null, () => setSheet(null));");
    expect(shell).toContain('window.addEventListener("popstate", open);');
  });

  it("names the page by the longest menu path that matches", () => {
    const Icon = (() => null) as never;
    const groups = [
      { id: "a", title: "A", icon: Icon, color: "blue", items: [
        { icon: Icon, label: "Packages", path: "/packages" },
        { icon: Icon, label: "All parcels", path: "/packages/all" },
      ] },
    ];
    expect(currentItem(groups, "/packages/all")?.label).toBe("All parcels");
    expect(currentItem(groups, "/packages/123")?.label).toBe("Packages");
    expect(currentItem(groups, "/elsewhere")).toBeNull();
  });

  it("the corner buttons sit above the tab bar on a phone", () => {
    const corner = read("lib/floatingCorner.ts");
    expect(corner).toContain("bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-4");
  });
});

describe("lists on a phone are cards (phase 2)", () => {
  it("the parcels list draws one card per parcel, with the row's own pieces", () => {
    const page = read("pages/Packages.tsx");
    expect(page).toContain("{isMobile ? (");
    expect(page).toContain("<PackageMobileCard");
    // One status menu, one weight rule, one age badge for table and card.
    for (const piece of ["<PackageStatusMenu", "<PackageWeight", "<PackageAge"]) {
      expect((page.match(new RegExp(piece, "g")) ?? []).length, piece).toBeGreaterThanOrEqual(2);
    }
  });

  it("any table becomes cards on a phone with one prop, labelled by its own header", () => {
    const table = read("components/ui/table.tsx");
    expect(table).toContain('data-mobile-cards={mobileCards ? "" : undefined}');
    expect(table).toContain('el.setAttribute("data-label", label)');
    const css = read("index.css");
    expect(css).toContain("table[data-mobile-cards] > thead {");
    expect(css).toContain("content: attr(data-label);");
    for (const f of ["pages/Batches.tsx", "pages/Customers.tsx", "components/delivery/BoxTable.tsx", "pages/CommissionOrders.tsx", "pages/Invoices.tsx"]) {
      expect(read(f), f).toContain("<Table ");
      expect(read(f), f).toMatch(/<Table[^>]*mobileCards/);
    }
  });

  it("the first render already knows it is a phone — no desktop flash, no slide", () => {
    expect(read("hooks/useMobile.tsx")).toContain("window.innerWidth < MOBILE_BREAKPOINT\n  );");
  });

  it("a page's title row wraps on a phone instead of pushing the page wider", () => {
    expect(read("index.css")).toContain("main div.flex.justify-between:has(h1) {");
  });

  it("the dashboard starts with the day's jobs on a phone", () => {
    expect(read("pages/Dashboard.tsx")).toContain("<MobileQuickActions");
  });
});

describe("tested against a real database, 2026-09-28 (phase 4)", () => {
  it("nothing can make a phone or tablet page wider than the screen", () => {
    const css = read("index.css");
    const block = css.slice(css.indexOf("@media (max-width: 1023px) {"));
    expect(block).toContain("html:has(main) body {\n    overflow-x: clip;");
    expect(block).toContain("main {\n    overflow-x: clip;");
    // Rows of buttons and tab lists wrap instead of being cut.
    expect(block).toContain('main [data-slot="tabs-list"]');
    expect(block).toContain("main .grid > * {\n    min-width: 0;");
    // Wide tables scroll inside themselves below lg instead.
    expect(read("components/ui/table.tsx")).toContain("md:[--tbl-sticky-top:44px] max-lg:overflow-x-auto");
  });

  it("the batch-number buttons on the dashboard and batches page wrap, touch screens too", () => {
    for (const f of ["pages/Dashboard.tsx", "pages/Batches.tsx"]) {
      expect(read(f), f).toContain('className={cn("h-auto pointer-coarse:h-auto min-h-8 pointer-coarse:min-h-10 max-w-full flex-wrap');
    }
  });

  it("the phone's Back closes the search instead of leaving the page", () => {
    expect(read("components/DashboardLayout.tsx")).toContain("useBackCloses(cmdOpen && isMobile, () => setCmdOpen(false));");
  });

  it("opening the system on a phone asks to install it as an app", () => {
    const prompt = read("components/PWAInstallPrompt.tsx");
    expect(prompt).toContain("const staffOnPhone =");
    expect(prompt).toContain("const onPortal = inPortal || staffOnPhone;");
    expect(prompt).toContain("inPortal ? company.name : staffAppName");
  });

  it("the named pinned pages wait for lg — at tablet width they widened every page", () => {
    expect(read("components/topbar/PinnedPages.tsx")).toContain('className={cn("hidden items-center gap-0.5 lg:flex", className)}');
  });

  it("business analytics survives weights that arrive as text", () => {
    expect(read("pages/BusinessAnalytics.tsx")).toContain("Number(stat.totalWeight ?? 0).toFixed(1)");
  });
});
