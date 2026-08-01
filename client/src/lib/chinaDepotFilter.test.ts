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
