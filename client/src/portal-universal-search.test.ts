import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cleanSearchPaste } from "./lib/entry/cleanPaste";

/**
 * The centre of the portal's bottom bar is a search (owner's brief,
 * 2026-09-16): a magnifier that opens a full-screen search with the keyboard
 * already up, one box for any number a customer has, three stage tabs with
 * live counts, minimal cards, and a tap that goes to the answer's own place
 * or opens its detail from the bottom of the screen.
 *
 * What would quietly undo it: a skin still carrying the ➕, a focus that
 * comes a frame too late for an iPhone, a sheet that Back walks straight
 * past, a box the phone zooms into, a search that fetches on every keystroke.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

const LAYOUTS = [
  "components/CustomerPortalLayout.tsx",
  "components/ModernPortalLayout.tsx",
  "components/Skin3PortalLayout.tsx",
];

describe("the bottom bar's centre is the search, on all three skins", () => {
  for (const file of LAYOUTS) {
    it(`${path.basename(file)} opens the search from the centre`, () => {
      const src = read(file);
      expect(src).toContain("usePortalSearchSheet()");
      expect(src).toContain("openSearch");
      expect(src, "the sheet has to be rendered to open").toContain("{searchSheet}");
      expect(src, "the ➕ is gone from the bar").not.toMatch(/\bPlus\b/);
      expect(src).not.toContain('path: "/portal/declare"');
    });
  }

  it("the classic centre button is a button with the magnifier, not a link", () => {
    const src = read("components/CustomerPortalLayout.tsx");
    const centre = src.slice(src.indexOf("{/* Center"), src.indexOf("{/* Right Side"));
    expect(centre).toContain("<button");
    expect(centre).toContain("onClick={openSearch}");
    expect(centre).toContain("<Search ");
    expect(centre).toContain('aria-haspopup="dialog"');
    expect(centre).not.toContain("<Link");
  });
});

describe("the sheet opens ready to type", () => {
  const sheet = read("components/portal/PortalSearchSheet.tsx");

  it("renders and focuses inside the tap, so an iPhone raises its keyboard", () => {
    const open = sheet.slice(sheet.indexOf("const openSearch = useCallback"));
    const flush = open.indexOf("flushSync(() => setOpen(true))");
    const focus = open.indexOf("inputRef.current?.focus(");
    expect(flush).toBeGreaterThan(-1);
    expect(focus).toBeGreaterThan(flush);
    expect(open.slice(0, focus)).not.toMatch(/setTimeout|requestAnimationFrame|await /);
  });

  it("does not stack a sheet over the search page — it focuses the page's own box", () => {
    expect(sheet).toContain("document.getElementById(PORTAL_SEARCH_INPUT_ID)");
    expect(read("pages/portal/PortalSearch.tsx")).toContain("id={PORTAL_SEARCH_INPUT_ID}");
  });

  it("covers the whole screen above the bar, and gives the page its scroll back", () => {
    expect(sheet).toContain("createPortal(");
    expect(sheet).toContain("fixed inset-0 z-50");
    expect(sheet).toContain('document.body.style.overflow = "hidden"');
    expect(sheet).toContain("document.body.style.overflow = overflow");
  });

  it("Back closes the sheet instead of leaving the page", () => {
    expect(sheet).toContain("window.history.pushState(withSearchSheet(window.history.state)");
    // The bar's hook follows the history both ways: Back closes the sheet,
    // and Back onto an entry that had it open opens it again.
    expect(sheet).toContain("const onPop = () => setOpen(isMarked())");
    expect(sheet).toContain("useState(isMarked)");
    expect(sheet).toContain('window.removeEventListener("popstate", onPop)');
  });

  it("the answers load behind the box, not before it", () => {
    expect(sheet).toMatch(/lazy\(\(\) => import\("@\/components\/portal\/PortalUniversalSearch"\)\)/);
    expect(sheet).not.toMatch(/from "@\/components\/portal\/PortalUniversalSearch"/);
  });

  it("the box is 16px on a phone, so iOS does not zoom into it", () => {
    expect(sheet).toContain("text-base md:text-sm");
    expect(sheet).toContain('inputMode="search"');
  });

  it("a pasted number is cleaned on its way in", () => {
    expect(sheet).toContain("cleanSearchPaste(e.clipboardData.getData(");
  });
});

/**
 * The owner, 2026-09-16: a tracking's details open beautifully, but the
 * phone's Back button went to the home page. Back must take one step — from
 * the details to the search, from a page the search opened back to the
 * search, and only then out of it.
 */
describe("the phone's Back button takes one step at a time", () => {
  const hook = read("hooks/usePortalSearchView.ts");
  const search = read("components/portal/PortalUniversalSearch.tsx");
  const detail = read("components/portal/PortalSearchDetail.tsx");

  it("opening an answer's details is a step of its own", () => {
    const open = hook.slice(hook.indexOf("const openDetail = useCallback"), hook.indexOf("const closeDetail"));
    expect(open).toContain("remember({ detail: null })");
    expect(open).toContain("window.history.pushState(");
    expect(open.indexOf("remember(")).toBeLessThan(open.indexOf("pushState("));
    expect(search).toContain("view.openDetail(item.key)");
  });

  it("closing the details takes that step back, and nothing more", () => {
    const close = hook.slice(hook.indexOf("const closeDetail = useCallback"), hook.indexOf("const leave = useCallback"));
    expect(close).toContain("window.history.back()");
    expect(search).toContain("onRequestClose={view.closeDetail}");
    expect(search).toContain("open={!!detailItem}");
    // The drawer never closes itself behind the history's back.
    expect(detail).not.toMatch(/useState\(true\)/);
    expect(detail).toContain("if (!isOpen) onRequestClose()");
  });

  it("leaving for an answer's page adds a step — it never replaces the search's", () => {
    const leave = hook.slice(hook.indexOf("const leave = useCallback"), hook.indexOf("const submit = useCallback"));
    expect(leave).toContain("remember();");
    expect(leave).toContain("navigate(href);");
    expect(leave.indexOf("remember();")).toBeLessThan(leave.indexOf("navigate(href);"));
    expect(hook).not.toMatch(/replace:\s*true|replace:\s*marked/);
    expect(read("components/portal/PortalSearchSheet.tsx")).not.toContain("replace: marked");
    for (const target of ['view.leave("/portal/declare")', 'view.leave("/portal/no-mark")', "view.leave(registerHref)", "view.leave(href)"]) {
      expect(search, target).toContain(target);
    }
    expect(search).not.toContain("onNavigate(");
  });

  it("coming back shows the search as it was left — words, tab, details and scroll", () => {
    expect(hook).toContain("readSearchView(window.history.state)");
    expect(hook).toContain("useState(restored?.q ?? options.initialQuery");
    expect(hook).toContain("useState<SearchTab | null>(restored?.tab ?? null)");
    expect(hook).toContain("useState<string | null>(restored?.detail ?? null)");
    expect(hook).toContain("const target = restored?.scroll ?? 0");
  });

  it("the page and the sheet keep the same steps", () => {
    expect(read("pages/portal/PortalSearch.tsx")).toContain("usePortalSearchView({");
    expect(read("components/portal/PortalSearchSheet.tsx")).toContain("usePortalSearchView({ scrollRef, onLeave: onClosed })");
  });
});

describe("a paste into the search", () => {
  it("keeps only the number when the paste is a number", () => {
    expect(cleanSearchPaste("运单号： YT 7524 6012 34567")).toBe("YT7524601234567");
    expect(cleanSearchPaste(" sf1400998877\n")).toBe("SF1400998877");
    expect(cleanSearchPaste("FP-00070")).toBe("FP-00070");
  });

  it("leaves words alone — cleaning a product's name would delete it", () => {
    expect(cleanSearchPaste("جانتای چەرم")).toBeNull();
    expect(cleanSearchPaste("iPhone 15 case")).toBeNull();
    expect(cleanSearchPaste("4567")).toBeNull();
  });
});

describe("the answers", () => {
  const search = read("components/portal/PortalUniversalSearch.tsx");

  it("come from the lists the portal already keeps, kept live", () => {
    for (const proc of ["getMyPackages", "getMyFullPackageOrders", "getMyBatches", "getMyDeliveryBoxes", "getMyDeclaredPackages"]) {
      const at = search.indexOf(`.${proc}.useQuery(`);
      expect(at, `${proc} is not read`).toBeGreaterThan(-1);
      expect(search.slice(at, search.indexOf(")", at) + 1), `${proc} is not live`).toContain("PORTAL_LIVE_QUERY");
    }
    // Same input as the orders page and the thumbnails, so it is one cache entry.
    expect(search).toContain("getMyFullPackageOrders.useQuery({}, PORTAL_LIVE_QUERY)");
  });

  it("ask the server only when nothing loaded holds the number, and only once typing pauses", () => {
    expect(search).toContain("shouldAskServer(parsed, matches.length)");
    expect(search).toMatch(/useDebouncedValue\(wanted, \d+\)/);
    for (const proc of ["searchPackage", "searchOrder", "searchTrackingExtra"]) {
      const at = search.indexOf(`.${proc}.useQuery(`);
      expect(at).toBeGreaterThan(-1);
      expect(search.slice(at, search.indexOf("\n", at))).toContain("serverOptions");
    }
    expect(search).toContain("enabled: askServer");
  });

  it("an empty tab stays in view, dimmed, and cannot be chosen; the chosen one can always be tapped off", () => {
    expect(search).toContain("const isEmpty = count === 0 && !isActive");
    expect(search).toContain("disabled={isEmpty}");
    expect(search).toContain('isEmpty && "opacity-45"');
    expect(search).toContain("setTab(isActive ? null : id)");
  });

  it("a card writes the tracking left to right, its date the portal's way, and survives a dead picture", () => {
    expect(search).toContain('<bdi dir="ltr" className="font-mono tracking-wide">{item.title}</bdi>');
    expect(search).toContain("formatPortalDate(item.date, language)");
    expect(search).toMatch(/<img[\s\S]{0,300}onError=\{onImageError\}/);
  });

  it("a failed list says so, with a retry", () => {
    expect(search).toContain("parcelsQ.isError");
    expect(search).toContain("<PortalErrorState onRetry=");
  });

  it("a number nobody has can be registered from the answer", () => {
    expect(search).toContain("/portal/declare?tracking=");
    expect(read("pages/portal/PortalDeclarePackage.tsx")).toContain('get("tracking")');
  });

  it("box receipts are linked only where a money page shows them", () => {
    expect(search).toContain('hasFeature(features, "finance_detail")');
    expect(search).toContain('portalTheme !== "modern" && portalTheme !== "skin3"');
  });
});

describe("the detail from the bottom of the screen", () => {
  const detail = read("components/portal/PortalSearchDetail.tsx");

  it("never shows the weight of goods sold at one agreed price", () => {
    expect(detail).toContain("parcel?.sizeConcealed === true");
    expect(detail).toMatch(/!concealed && Number\(parcel\.weightKg\) > 0/);
  });

  it("names the shipment «بار», never «باچ»", () => {
    expect(detail).toContain('label: { ku: "بار"');
    for (const file of [
      "components/portal/PortalSearchDetail.tsx",
      "components/portal/PortalUniversalSearch.tsx",
      "components/portal/PortalSearchSheet.tsx",
      "lib/portalSearch.ts",
    ]) {
      expect(read(file), file).not.toContain("باچ");
    }
  });

  it("draws the journey with where the parcel was registered, so Erbil parcels skip China", () => {
    expect(detail).toContain("registeredAtOrigin={journeyQ.data?.registeredAtOrigin ?? null}");
  });

  it("fetches the journey only once it is opened", () => {
    expect(detail).toContain("enabled: !!parcel && !!lookup");
    expect(detail).toContain("enabled: !!parcel,");
  });
});

describe("a parcel's box is one tap away", () => {
  it("the server says which parcels each box holds, from the same bounded, allow-listed query", () => {
    const src = fs.readFileSync(path.resolve(SRC, "../../server/db/deliveryBoxes.db.ts"), "utf8").replace(/\r\n/g, "\n");
    const fn = src.slice(
      src.indexOf("export async function getCustomerVisibleBoxes"),
      src.indexOf("export async function getCustomerBoxedPackages"),
    );
    expect(fn).toContain("db.select(CUSTOMER_BOX_FIELDS)");
    expect(fn).toContain(".limit(limit)");
    expect(fn).toContain("packageIds: packageIdsByBox.get(r.id) ?? []");
  });

  it("the money page opens the linked box on its own tab", () => {
    const money = read("pages/portal/PortalFinancial.tsx");
    expect(money).toContain('urlTab === "transactions" || urlTab === "batches" || urlTab === "boxes"');
    expect(money).toContain("useState<number | null>(() => boxFromUrl(searchString))");
    expect(money, "a customer without the tabs lands on the overview").toMatch(
      /if \(activeTab === "batches" \|\| activeTab === "boxes"\) setActiveTab\("overview"\)/,
    );
  });

  it("the linked row is drawn even when it sits below the first few", () => {
    const list = read("components/AccountRowList.tsx");
    expect(list).toContain("Math.max(initialVisible, openIndex + 1)");
  });
});
