import { describe, expect, it } from "vitest";
import {
  DASHBOARD_FIGURE_IDS,
  DOES_NOT_RECONCILE,
  EXPLAIN_HINT,
  HOW_CALCULATED,
  NO_PARTS,
  OPEN_RECORDS,
  RECONCILES,
  THE_PARTS,
  THE_WINDOW,
  figureMeta,
  reconcile,
  type FigurePart,
} from "./dashboardExplain";
import { readBatchesLink, readCustomersLink, readPackagesLink } from "./listLinks";

/**
 * The dashboard was twenty numbers with no source. The value of explaining
 * them rests entirely on the explanation being true, so what is tested here
 * is that each figure's link opens the rows it counted, and that a panel
 * never quietly disagrees with the card above it.
 */

describe("every figure can account for itself", () => {
  it("says what it is, how, and where to look", () => {
    for (const id of DASHBOARD_FIGURE_IDS) {
      const meta = figureMeta(id);
      expect(meta.id, id).toBe(id);
      expect(meta.href, `${id} has no link`).toBeTruthy();
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(meta.label[lang]?.trim(), `${id}.label.${lang}`).toBeTruthy();
        expect(meta.formula[lang]?.trim(), `${id}.formula.${lang}`).toBeTruthy();
        expect(meta.hrefLabel[lang]?.trim(), `${id}.hrefLabel.${lang}`).toBeTruthy();
      }
    }
  });

  it("states the window for every figure that has one", () => {
    // "This week" is the one people misread, so a period figure that does not
    // say which days it means is the failure this guards.
    for (const id of ["todayIncome", "weekIncome", "monthIncome"] as const) {
      const window = figureMeta(id).window;
      expect(window, `${id} does not say which period`).toBeTruthy();
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(window![lang]?.trim(), `${id}.window.${lang}`).toBeTruthy();
      }
    }
  });

  it("warns that income means received, not invoiced", () => {
    // A reader who assumes it means invoiced would read every income figure
    // on the page wrongly.
    expect(figureMeta("todayIncome").formula.en.toLowerCase()).toContain("not invoiced");
    expect(figureMeta("weekIncome").formula.en.toLowerCase()).toContain("not invoiced");
  });

  it("says the last seven days rather than a calendar week", () => {
    expect(figureMeta("weekIncome").window!.en.toLowerCase()).toContain("rolling");
  });
});

describe("each link opens what the figure counted", () => {
  it("new customers opens the same seven days", () => {
    const link = readCustomersLink(figureMeta("newCustomers").href);
    expect(link.createdWithin).toBe(7);
  });

  it("total customers opens every customer, filtered by nothing", () => {
    const meta = figureMeta("totalCustomers");
    expect(meta.href).toBe("/customers");
    const link = readCustomersLink(meta.href);
    expect(link.status).toBeUndefined();
    expect(link.createdWithin).toBeUndefined();
  });

  it("active shipments opens the active filter", () => {
    expect(readBatchesLink(figureMeta("activeBatches").href).status).toBe("active");
  });

  it("delivered parcels opens the delivered tab", () => {
    expect(readPackagesLink(figureMeta("deliveredPackages").href).tab).toBe("delivered");
  });

  it("total parcels opens the table with no tab forced", () => {
    expect(readPackagesLink(figureMeta("totalPackages").href).tab).toBeUndefined();
  });

  it("says out loud that active leaves customs out", () => {
    // The dashboard query counts three statuses. A reader who assumes it
    // means "not yet delivered" would think shipments had gone missing.
    expect(figureMeta("activeBatches").formula.en.toLowerCase()).toContain("customs");
  });
});

describe("whether the parts add up", () => {
  const part = (value: number, key = "k"): FigurePart => ({
    key,
    label: { ku: "", en: "", ar: "", zh: "" },
    value,
  });

  it("agrees when they do", () => {
    const r = reconcile(100, [part(60, "a"), part(40, "b")]);
    expect(r).toEqual({ partTotal: 100, reconciles: true });
  });

  it("forgives a rounding tail", () => {
    expect(reconcile(0.3, [part(0.1), part(0.2)]).reconciles).toBe(true);
  });

  it("says so when they do not", () => {
    // Two numbers of equal authority and no way to tell which is wrong is
    // worse than no drill-down at all — so it is stated, not hidden.
    const r = reconcile(100, [part(60), part(30)]);
    expect(r.reconciles).toBe(false);
    expect(r.partTotal).toBe(90);
  });

  it("treats a figure with no parts as not reconciling to zero by accident", () => {
    expect(reconcile(0, []).reconciles).toBe(true);
    expect(reconcile(500, []).reconciles).toBe(false);
  });

  it("ignores a part whose value is not a number", () => {
    const broken = { ...part(NaN), value: NaN };
    expect(reconcile(60, [part(60), broken]).reconciles).toBe(true);
  });
});

describe("the words around the panel", () => {
  it("exist in all four languages", () => {
    const strings = {
      HOW_CALCULATED, THE_WINDOW, THE_PARTS, OPEN_RECORDS,
      RECONCILES, DOES_NOT_RECONCILE, NO_PARTS, EXPLAIN_HINT,
    };
    for (const [name, value] of Object.entries(strings)) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(value[lang]?.trim(), `${name}.${lang}`).toBeTruthy();
      }
    }
  });
});
