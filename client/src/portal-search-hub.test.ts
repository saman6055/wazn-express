import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cleanSearchPaste } from "./lib/entry/cleanPaste";
import { SEARCH_TABS } from "./lib/portalSearch";

/**
 * The search is the portal's hub: the centre button opens it, and the home's
 * three cards open it too, each on its own place, counting what that place
 * lists.
 *
 * The owner's brief (2026-09-19), fourth part. Before it the cards filtered
 * the home's own list in place, and two of them counted shipments while the
 * search counted parcels — a card could say 2 and open a list of 14.
 */

const SRC = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

describe("the home's three cards", () => {
  const home = read("pages/portal/PortalHome.tsx");

  it("each open the search on its own tab", () => {
    for (const tab of SEARCH_TABS) {
      expect(home, tab).toContain(`href="/portal/search?tab=${tab}"`);
    }
    expect(home).not.toContain("togglePipeline");
    expect(home).not.toContain("pipelineFilter");
  });

  it("count what that tab lists — the search's own rule over the search's own lists", () => {
    expect(home).toContain("countByTab(");
    expect(home).toContain("searchItems(");
    expect(home).toContain("buildSearchIndex({ parcels: parcelsQuery.data as any, orders: ordersQuery.data as any, batches: batches as any })");
    expect(home).toContain('parseSearch("")');
    for (const tab of SEARCH_TABS) {
      expect(home, tab).toContain(`stageCounts.${tab}`);
      expect(home, tab).toContain(`SEARCH_TAB_LABEL.${tab}`);
    }
  });

  it("keep the days-left line under the blue card", () => {
    expect(home).toContain("nextEtaDays !== null");
  });
});

describe("the search starts where the card said", () => {
  it("reads ?tab= and knows only its three tabs", () => {
    const page = read("pages/portal/PortalSearch.tsx");
    expect(page).toContain('new URLSearchParams(window.location.search).get("tab")');
    expect(page).toContain("SEARCH_TABS.find((t) => t === tab) ?? null");
    expect(page).toContain("initialTab: getInitialSearchTab(),");
  });

  it("a remembered step wins over the address, and the address keeps the tab", () => {
    const view = read("hooks/usePortalSearchView.ts");
    expect(view).toContain("useState<SearchTab | null>(restored?.tab ?? options.initialTab ?? null)");
    expect(view).toContain('if (tab) params.set("tab", tab);');
    expect(view).toContain("}, [query, tab, urlPath]);");
  });
});

describe("a paste from a chat goes in clean", () => {
  it("drops the Chinese label and the spaces, and keeps the number", () => {
    expect(cleanSearchPaste("运单号：YT 7580 0123 4567 8")).toBe("YT7580012345678");
    expect(cleanSearchPaste("ｙｔ７５８００１２３４５６７８")).toBe("YT7580012345678");
    // A product's name is left as it was typed.
    expect(cleanSearchPaste("جانتای چەرم")).toBeNull();
  });
});
