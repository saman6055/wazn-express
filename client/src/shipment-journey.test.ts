import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  JOURNEY_HINT,
  JOURNEY_LABEL,
  JOURNEY_STEPS,
  groupByJourney,
  journeyOf,
  journeyRank,
} from "@/lib/shipmentFilters";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26: «قۆناغەکان زۆر تێکەلن — سەرەتا ئەوانە نیشان بدات کە
 * تازە گەیشتوونەتە مەخزەن، بە گوێرەی تایم لاین، یەکەم ستێپەکان، پاشان دووەم،
 * تا کۆتایی.» The list was sorted by the date the batch was created, which
 * mixes a box waiting to be collected in with goods that landed this morning.
 */
describe("reading the shipments along the road", () => {
  it("starts at the China warehouse and ends in the customer's hands", () => {
    expect([...JOURNEY_STEPS]).toEqual(["in_china", "on_way", "in_iraq", "in_erbil", "delivered"]);
    expect(journeyRank("preparing")).toBe(0);
    expect(journeyRank("delivered")).toBe(4);
    expect(journeyRank("preparing")).toBeLessThan(journeyRank("in_transit"));
    expect(journeyRank("in_transit")).toBeLessThan(journeyRank("at_depot"));
  });

  it("folds the seven statuses into the five steps the timeline has", () => {
    // Two answers to "how far along is it" is one too many: these are the
    // same five as shared/parcelStage.
    expect(journeyOf("customs")).toBe("in_iraq");
    expect(journeyOf("arrived")).toBe("in_iraq");
    expect(journeyOf("at_depot")).toBe("in_erbil");
    expect(journeyOf("closed")).toBe("delivered");
  });

  it("treats a status it has never seen as the beginning, not the end", () => {
    // A shipment that fell off the end of the list is invisible; one that
    // turns up at the top gets looked at.
    expect(journeyOf("something_new")).toBe("in_china");
    expect(journeyOf(null)).toBe("in_china");
    expect(journeyOf(undefined)).toBe("in_china");
  });

  it("groups in road order, newest first inside a step, and drops empty steps", () => {
    const rows = [
      { status: "delivered", createdAt: "2026-08-30" },
      { status: "preparing", createdAt: "2026-09-25" },
      { status: "preparing", createdAt: "2026-09-26" },
      { status: "at_depot", createdAt: "2026-09-24" },
    ];
    const groups = groupByJourney(rows);
    expect(groups.map((g) => g.step)).toEqual(["in_china", "in_erbil", "delivered"]);
    expect(groups[0].rows.map((r) => r.createdAt)).toEqual(["2026-09-26", "2026-09-25"]);
  });

  it("says something in every language, and says nothing twice", () => {
    for (const step of JOURNEY_STEPS) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(JOURNEY_LABEL[step][lang].trim().length, `${step} ${lang}`).toBeGreaterThan(0);
      }
    }
    // Delivered needs no hint: the heading already says it is in their hands.
    expect(JOURNEY_HINT.delivered.ku).toBe("");
    const labels = JOURNEY_STEPS.map((s) => JOURNEY_LABEL[s].ku);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("the shipments page reads it", () => {
  const page = read("client/src/pages/portal/PortalShipments.tsx");

  it("opens on the road, not on the date", () => {
    expect(page).toContain('useState<SortOption>("journey")');
    expect(page).toContain('type SortOption = "journey" | "newest" | "oldest" | "status";');
  });

  it("sorts by step first, then newest within the step", () => {
    const sort = page.slice(page.indexOf('if (sortBy === "journey")'), page.indexOf('if (sortBy === "newest")'));
    expect(sort.length).toBeGreaterThan(20);
    expect(sort).toContain("journeyRank(a.status) - journeyRank(b.status)");
    expect(sort).toContain("new Date(b.createdAt || 0).getTime()");
  });

  it("draws a heading once at each turn of the road", () => {
    expect(page).toContain("const heading = step && step !== previous ? step : null;");
    expect(page).toContain("JOURNEY_LABEL[heading]");
    // And only while reading along the road: the date sorts stay a flat list.
    expect(page).toContain('const step = sortBy === "journey" ? journeyOf(batch.status) : null;');
  });
});
