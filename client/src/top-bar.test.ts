import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The staff top bar, laid out like the Windows 11 taskbar (owner, 2026-09-17).
 *
 * His notes, each pinned here:
 *  - icons with nothing written on them are no use to anyone;
 *  - the pages used most: batches, buying at cost, boxes, all parcels, quick
 *    register;
 *  - beautiful, delicate, prominent, and every function genuinely useful;
 *  - compact mode changed nothing — remove it or make it really work.
 *
 * What would undo it: a bare icon back in the bar, a pinned page shown to
 * someone who may not open it, the old settings icons returning one by one, or
 * compact mode shrinking back to a few pixels nobody sees.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

const layout = read("components/DashboardLayout.tsx");
const pins = read("components/topbar/PinnedPages.tsx");
const settings = read("components/topbar/QuickSettings.tsx");
const search = read("components/topbar/TopBarSearch.tsx");

function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}`).toBeGreaterThan(a);
  return src.slice(a, b);
}

describe("the pinned pages", () => {
  it("are the owner's five, in the order a parcel travels", () => {
    const order = ["/packages/quick-register", "/packages/all", "/batches", "/customer-delivery-scanner", "/commission"];
    const list = between(pins, "export const PINNED_PAGES", "];");
    const positions = order.map((p) => list.indexOf(`path: "${p}"`));
    for (const [i, pos] of positions.entries()) expect(pos, order[i]).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("each says its name — never an icon alone", () => {
    expect(pins).toContain('<span className="whitespace-nowrap">{pickLang(language, pin.label)}</span>');
    const list = between(pins, "export const PINNED_PAGES", "];");
    expect(list.match(/label: \{ ku: "/g)?.length).toBe(5);
  });

  it("only for pages this person may open", () => {
    expect(pins).toContain("PINNED_PAGES.filter((p) => canViewPath(p.path))");
  });

  it("marks the page you are on with the taskbar's line", () => {
    expect(pins).toContain('aria-current={active ? "page" : undefined}');
    expect(pins).toContain("isPinActive(location, pin.path)");
    expect(pins).toContain("location.startsWith(`${path}/`)");
  });
});

describe("the bar", () => {
  const bar = between(layout, "{/* Search: the Start of this bar", "{/* Said out loud, on every screen");

  it("opens with a labelled search, then the pages, then quick create", () => {
    expect(bar).toContain("<TopBarSearch onOpen={() => setCmdOpen(true)}");
    expect(bar.indexOf("<TopBarSearch")).toBeLessThan(bar.indexOf("<PinnedPages"));
    expect(bar.indexOf("<PinnedPages")).toBeLessThan(bar.indexOf("<QuickCreate />"));
    expect(search).toContain('<span className="hidden xl:inline">{label}</span>');
  });

  it("keeps a tray: the bell, quick settings, the clock and the person", () => {
    const tray = between(layout, "{/* Tray (RTL: the far left)", "</DropdownMenuContent>");
    for (const part of ["<RiskBell />", "<QuickSettings fullScreen={fullScreen}", "<TopBarClock", "{/* User profile */}"]) {
      expect(tray, part).toContain(part);
    }
  });

  it("keeps dark mode on the bar itself, beside quick settings (owner, 2026-09-17)", () => {
    const tray = between(layout, "{/* Tray (RTL: the far left)", "{/* User profile */}");
    expect(tray).toContain('data-testid="topbar-theme"');
    expect(tray).toContain("onClick={toggleTheme}");
    expect(tray.indexOf('data-testid="topbar-theme"')).toBeLessThan(tray.indexOf("<QuickSettings"));
  });

  it("no longer carries the bare settings icons one by one", () => {
    for (const gone of ["<ThemePicker", "<DensityToggle", "<AppearanceDialog", "<RecentlyViewed", "const PINNED", '<Select value={language}']) {
      expect(layout, gone).not.toContain(gone);
    }
  });

  it("recent pages and the recycle bin are in the person's own menu", () => {
    const menu = between(layout, "{/* User profile */}", "</DropdownMenu>\n          </div>");
    expect(menu).toContain("recentItems.slice(0, 10).map((item)");
    expect(menu).toContain('canViewPath("/trash") && (');
    expect(menu).toContain('<Link href="/trash">');
  });

  it("stays the height the sticky page headers measure against", () => {
    expect(layout).toContain("h-11");
  });
});

describe("quick settings", () => {
  it("is one labelled button", () => {
    expect(settings).toContain('button: { ku: "ڕێکخستن"');
    expect(settings).toContain('<span className="hidden xl:inline">{L(TXT.button)}</span>');
  });

  it("holds every setting the bar used to scatter, each with its name", () => {
    for (const id of ['testId="qs-dark"', 'testId="qs-compact"', 'testId="qs-fullscreen"']) {
      expect(settings, id).toContain(id);
    }
    expect(settings).toContain("ACCENTS.map((a)");
    expect(settings).toContain("LANGUAGES.map((l)");
    expect(settings).toContain("<AppearanceDialog open={appearanceOpen} onOpenChange={setAppearanceOpen} hideTrigger />");
  });
});

describe("compact mode really works", () => {
  const css = read("index.css");

  it("takes real room out of every table row and the page itself", () => {
    const rules = between(css, "Compact mode — <html data-density=\"compact\">", "/* Faster numeric data entry:");
    expect(rules).toContain('html[data-density="compact"] main :is(td, th) {');
    expect(rules).toContain("padding-top: 0.125rem;");
    expect(rules).toContain('html[data-density="compact"] main td [data-slot="button"] {');
    expect(rules).toContain('html[data-density="compact"] main > div.p-4 {');
  });

  it("the page padding it tightens is the layout's own", () => {
    expect(layout).toContain('<div className="p-4 md:p-6">');
  });

  it("is one switch, kept for the browser", () => {
    const hook = read("hooks/useDensity.ts");
    expect(hook).toContain('document.documentElement.dataset.density = compact ? "compact" : "comfortable";');
    expect(hook).toContain('localStorage.setItem(KEY, next ? "compact" : "comfortable")');
    expect(settings).toContain("const [compact, setCompact] = useDensity();");
  });
});
