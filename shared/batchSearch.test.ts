import { describe, expect, it } from "vitest";
import {
  BATCH_SEARCH_FIELDS,
  MIN_BATCH_SEARCH_LENGTH,
  batchFieldMatch,
  escapeLikeTerm,
  likePattern,
} from "./batchSearch";

describe("escapeLikeTerm", () => {
  it("leaves ordinary text alone", () => {
    expect(escapeLikeTerm("AIR-2026-041")).toBe("AIR-2026-041");
  });

  it("escapes the LIKE wildcards so they match themselves", () => {
    expect(escapeLikeTerm("100%_done")).toBe("100\\%\\_done");
    expect(escapeLikeTerm("a\\b")).toBe("a\\\\b");
  });

  it("wraps the trimmed term in percent signs", () => {
    expect(likePattern("  MSCU12  ")).toBe("%MSCU12%");
  });
});

describe("batchFieldMatch", () => {
  const batch = {
    batchCode: "AIR-2026-041",
    containerNumber: null,
    awbNumber: "235-77881234",
    flightNumber: "TK123",
    vesselName: null,
    shipmentTrackings: ["SF1443332211", "YT7788990011"],
  };

  it("refuses queries below the minimum length", () => {
    expect(batchFieldMatch(batch, "4")).toBeNull();
    expect(MIN_BATCH_SEARCH_LENGTH).toBe(2);
  });

  it("names the field that matched", () => {
    expect(batchFieldMatch(batch, "2026-041")).toEqual({
      kind: "field",
      field: "batchCode",
      value: "AIR-2026-041",
    });
    expect(batchFieldMatch(batch, "77881234")).toEqual({
      kind: "field",
      field: "awbNumber",
      value: "235-77881234",
    });
    expect(batchFieldMatch(batch, "tk12")).toEqual({
      kind: "field",
      field: "flightNumber",
      value: "TK123",
    });
  });

  it("is case-insensitive, like MySQL's default collation", () => {
    expect(batchFieldMatch(batch, "air-2026")).not.toBeNull();
    expect(batchFieldMatch({ vesselName: "MSC Oscar" }, "msc os")).toEqual({
      kind: "field",
      field: "vesselName",
      value: "MSC Oscar",
    });
  });

  it("reports the batch code when a query matches more than one field", () => {
    // "20" is in both the code and the AWB; the code is the answer the
    // searcher already understands, so it must win.
    const both = { ...batch, awbNumber: "2026" };
    expect(batchFieldMatch(both, "2026")).toMatchObject({ field: "batchCode" });
  });

  it("finds a courier tracking inside shipmentTrackings", () => {
    expect(batchFieldMatch(batch, "7788990")).toEqual({
      kind: "shipmentTracking",
      value: "YT7788990011",
    });
  });

  it("returns null when nothing on the row matches", () => {
    expect(batchFieldMatch(batch, "SEA-2026")).toBeNull();
    expect(batchFieldMatch({}, "anything")).toBeNull();
  });

  it("covers exactly the fields the SQL side searches", () => {
    // If a field is added to one side and not the other, the search returns
    // rows it cannot explain (or explains rows it cannot return). This pin
    // makes that drift a failing test instead of a quiet oddity.
    expect(BATCH_SEARCH_FIELDS).toEqual([
      "batchCode",
      "containerNumber",
      "awbNumber",
      "flightNumber",
      "vesselName",
    ]);
  });
});
