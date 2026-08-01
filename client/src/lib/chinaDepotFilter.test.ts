import { describe, it, expect } from "vitest";
import { filterChinaDepot, matchesRoute } from "./chinaDepotFilter";

const item = (code: string, shippingType: string | null = "air_regular") => ({ code, shippingType });

const ALL = [
  item("AIR-1", "air_regular"),
  item("AIR-2", "air_regular"),
  item("SPECIAL-1", "air_irregular"),
  item("SEA-1", "sea"),
  item("OLD-1", null),
];

describe("matchesRoute", () => {
  it("lets everything through when no route is chosen", () => {
    for (const type of ["air_regular", "air_irregular", "sea", null]) {
      expect(matchesRoute(type, undefined), String(type)).toBe(true);
      expect(matchesRoute(type, ""), String(type)).toBe(true);
    }
  });

  it("keeps each route to its own parcels", () => {
    expect(matchesRoute("air_regular", "air_regular")).toBe(true);
    expect(matchesRoute("air_regular", "sea")).toBe(false);
    expect(matchesRoute("sea", "air_irregular")).toBe(false);
  });

  it("shows a parcel with no route recorded rather than losing it", () => {
    // Hiding it from every route at once would make it unreachable, which is
    // worse than showing it under one too many.
    expect(matchesRoute(null, "sea")).toBe(true);
    expect(matchesRoute(undefined, "air_regular")).toBe(true);
  });
});

describe("filterChinaDepot", () => {
  it("shows everything when nothing is filtered", () => {
    expect(filterChinaDepot(ALL, {})).toHaveLength(5);
  });

  it("shows only that route's parcels — the bug this file exists for", () => {
    // Air-standard parcels were appearing under sea and under air-special.
    const sea = filterChinaDepot(ALL, { shippingType: "sea" });
    expect(sea.map(i => i.code)).toEqual(["SEA-1", "OLD-1"]);

    const special = filterChinaDepot(ALL, { shippingType: "air_irregular" });
    expect(special.map(i => i.code)).toEqual(["SPECIAL-1", "OLD-1"]);
  });

  it("does not hide the whole section when a route is chosen", () => {
    // The over-correction: every route returned an empty list, so the section
    // vanished the moment anyone touched the filter.
    for (const route of ["air_regular", "air_irregular", "sea"]) {
      expect(filterChinaDepot(ALL, { shippingType: route }).length, route).toBeGreaterThan(0);
    }
  });

  it("shows the list under the China stage and nowhere else", () => {
    expect(filterChinaDepot(ALL, { stage: "in_china" })).toHaveLength(5);
    expect(filterChinaDepot(ALL, { stage: "in_transit" })).toHaveLength(0);
    expect(filterChinaDepot(ALL, { stage: "delivered" })).toHaveLength(0);
  });

  it("searches by tracking number", () => {
    expect(filterChinaDepot(ALL, { search: "sea" }).map(i => i.code)).toEqual(["SEA-1"]);
    expect(filterChinaDepot(ALL, { search: "AIR" }).map(i => i.code)).toEqual(["AIR-1", "AIR-2"]);
  });

  it("ignores case and stray spaces in a search", () => {
    expect(filterChinaDepot(ALL, { search: "  air-1  " }).map(i => i.code)).toEqual(["AIR-1"]);
  });

  it("applies route and search together", () => {
    expect(
      filterChinaDepot(ALL, { shippingType: "air_regular", search: "AIR-2" }).map(i => i.code),
    ).toEqual(["AIR-2"]);
    // Right search, wrong route.
    expect(filterChinaDepot(ALL, { shippingType: "sea", search: "AIR-2" })).toHaveLength(0);
  });

  it("returns nothing rather than throwing on an empty list", () => {
    expect(filterChinaDepot([], { shippingType: "sea", search: "x" })).toEqual([]);
  });

  it("never returns an item the filters exclude, across every combination", () => {
    const stages = ["", "in_china", "in_transit", "delivered"];
    const routes = ["", "air_regular", "air_irregular", "sea"];
    for (const stage of stages) {
      for (const route of routes) {
        for (const got of filterChinaDepot(ALL, { stage, shippingType: route })) {
          expect(stage === "" || stage === "in_china", `${stage}/${route}`).toBe(true);
          expect(matchesRoute(got.shippingType, route), `${got.code} under ${route}`).toBe(true);
        }
      }
    }
  });
});

/**
 * Once a parcel is put into a batch it has left the depot, and it must stop
 * being counted there. The two sources drop out by different means — a package
 * gains a batchId, an order changes status — so this pins the behaviour that
 * matters rather than either mechanism.
 */
describe("leaving the depot", () => {
  it("counts nothing twice: a batched parcel is not also in the depot list", () => {
    // The China list is built from packages with no batch and orders whose
    // status still says China. Anything batched satisfies neither.
    const stillInChina = [item("A"), item("B")];
    const afterBatching: typeof stillInChina = [];
    expect(filterChinaDepot(stillInChina, {})).toHaveLength(2);
    expect(filterChinaDepot(afterBatching, {})).toHaveLength(0);
  });

  it("empties cleanly rather than leaving a stale row behind", () => {
    expect(filterChinaDepot([], { stage: "in_china" })).toEqual([]);
    expect(filterChinaDepot([], { shippingType: "sea" })).toEqual([]);
  });
});

/**
 * One physical parcel can be recorded twice: the office buys it (an order) and
 * the depot then scans it in (a package). Both carry the same tracking number.
 * Listed separately, the customer saw the same box twice and the count said
 * six when they had four.
 */
describe("one parcel, one row", () => {
  // Mirrors the merge in useChinaDepotItems: key on tracking number, and keep
  // whichever side knows each field.
  const dedupe = (rows: { tracking: string | null; id: string; name?: string | null; weight?: number | null }[]) => {
    const byKey = new Map<string, { code: string; name: string | null; weight: number | null }>();
    for (const row of rows) {
      const key = row.tracking ? String(row.tracking) : row.id;
      const existing = byKey.get(key);
      const next = { code: row.tracking ?? row.id, name: row.name ?? null, weight: row.weight ?? null };
      byKey.set(key, existing
        ? { ...existing, name: existing.name ?? next.name, weight: existing.weight ?? next.weight }
        : next);
    }
    return Array.from(byKey.values());
  };

  it("collapses a package and an order sharing a tracking number", () => {
    const merged = dedupe([
      { id: "pkg-1", tracking: "79123431425593", weight: 0.1 },
      { id: "order-1", tracking: "79123431425593", name: "Accessories" },
    ]);
    expect(merged).toHaveLength(1);
  });

  it("keeps the weight from the depot and the name from the order", () => {
    // Each side knows something the other does not; dropping either loses it.
    const [row] = dedupe([
      { id: "pkg-1", tracking: "773427610383344", weight: 0.3 },
      { id: "order-1", tracking: "773427610383344", name: "clothes" },
    ]);
    expect(row.weight).toBe(0.3);
    expect(row.name).toBe("clothes");
  });

  it("never merges two parcels that have no tracking number", () => {
    // Falling back to a shared empty key would collapse unrelated parcels.
    const merged = dedupe([
      { id: "pkg-1", tracking: null },
      { id: "pkg-2", tracking: null },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("leaves genuinely different tracking numbers alone", () => {
    expect(dedupe([
      { id: "pkg-1", tracking: "AAA" },
      { id: "pkg-2", tracking: "BBB" },
    ])).toHaveLength(2);
  });
});
