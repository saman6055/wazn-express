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
