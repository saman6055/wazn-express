import { describe, expect, it } from "vitest";
import {
  EMPTY_SEARCH_VIEW,
  isSearchSheetEntry,
  readSearchView,
  withSearchSheet,
  withSearchView,
  SEARCH_SHEET_MARK,
} from "./portalSearchHistory";

/**
 * A stand-in for the browser's history with the three calls the search makes,
 * so the owner's walk — search, details, Back, Back — can be followed step by
 * step without a browser.
 */
function fakeHistory(initial: unknown = null) {
  const entries: unknown[] = [initial];
  let at = 0;
  return {
    get state() {
      return entries[at];
    },
    get length() {
      return entries.length;
    },
    get index() {
      return at;
    },
    pushState(state: unknown) {
      entries.splice(at + 1);
      entries.push(state);
      at = entries.length - 1;
    },
    replaceState(state: unknown) {
      entries[at] = state;
    },
    back() {
      if (at > 0) at--;
    },
    forward() {
      if (at < entries.length - 1) at++;
    },
  };
}

describe("what an entry remembers", () => {
  it("reads back what was written", () => {
    const view = { q: "SF1400", tab: "onTheWay" as const, detail: "parcel:2", scroll: 480 };
    expect(readSearchView(withSearchView(null, view))).toEqual(view);
  });

  it("leaves everything else the entry carries alone", () => {
    const state = withSearchView({ other: 1, [SEARCH_SHEET_MARK]: true }, EMPTY_SEARCH_VIEW);
    expect(state.other).toBe(1);
    expect(isSearchSheetEntry(state)).toBe(true);
  });

  it("an entry the search never wrote remembers nothing", () => {
    expect(readSearchView(null)).toBeNull();
    expect(readSearchView({ some: "router state" })).toBeNull();
    expect(isSearchSheetEntry(null)).toBe(false);
    expect(isSearchSheetEntry({ [SEARCH_SHEET_MARK]: "yes" })).toBe(false);
  });

  it("a damaged memory reads as the empty search, not as an error", () => {
    expect(readSearchView({ portalSearchView: { q: 5, tab: "elsewhere", detail: "", scroll: -3 } })).toEqual(
      EMPTY_SEARCH_VIEW,
    );
  });
});

describe("the owner's walk: Back takes one step at a time", () => {
  it("home → search → details → Back → Back", () => {
    const h = fakeHistory(null);

    // The magnifier: the sheet is one step.
    h.pushState(withSearchSheet(h.state));
    expect(isSearchSheetEntry(h.state)).toBe(true);

    // A tracking typed, a card tapped: the list's entry remembers the list,
    // and the details are a step of their own on top of it.
    h.replaceState(withSearchView(h.state, { q: "SF14", tab: null, detail: null, scroll: 120 }));
    h.pushState(withSearchView(h.state, { q: "SF14", tab: null, detail: "parcel:2", scroll: 120 }));
    expect(readSearchView(h.state)?.detail).toBe("parcel:2");

    // Back: the details close, the search is still there with its words.
    h.back();
    expect(isSearchSheetEntry(h.state)).toBe(true);
    expect(readSearchView(h.state)).toEqual({ q: "SF14", tab: null, detail: null, scroll: 120 });

    // Back again: the page the search was opened on.
    h.back();
    expect(isSearchSheetEntry(h.state)).toBe(false);
    expect(h.index).toBe(0);
  });

  it("search → an order's page → Back returns to the search as it was left", () => {
    const h = fakeHistory(null);
    h.pushState(withSearchSheet(h.state));
    // Leaving writes the view into the sheet's entry, then the order is pushed
    // — never replacing the search's step.
    h.replaceState(withSearchView(h.state, { q: "FP-00070", tab: "onTheWay", detail: null, scroll: 0 }));
    h.pushState(null);
    expect(h.length).toBe(3);

    h.back();
    expect(isSearchSheetEntry(h.state)).toBe(true);
    expect(readSearchView(h.state)).toMatchObject({ q: "FP-00070", tab: "onTheWay" });
  });

  it("details → a shipment's page → Back reopens the same details", () => {
    const h = fakeHistory(null);
    h.pushState(withSearchSheet(h.state));
    h.replaceState(withSearchView(h.state, { q: "4567", tab: null, detail: null, scroll: 0 }));
    h.pushState(withSearchView(h.state, { q: "4567", tab: null, detail: "parcel:1", scroll: 0 }));
    h.pushState(null); // the shipment page

    h.back();
    expect(readSearchView(h.state)?.detail).toBe("parcel:1");
    h.back();
    expect(readSearchView(h.state)?.detail).toBeNull();
    h.back();
    expect(isSearchSheetEntry(h.state)).toBe(false);
  });
});
