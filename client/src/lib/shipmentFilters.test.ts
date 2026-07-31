import { describe, it, expect } from "vitest";
import { stageOf, matchesStage, countByStage, type BatchStatus } from "./shipmentFilters";

const ALL_STATUSES: BatchStatus[] = [
  "preparing",
  "in_transit",
  "arrived",
  "customs",
  "delivered",
  "closed",
];

describe("stageOf", () => {
  it("puts a batch still being prepared in China", () => {
    expect(stageOf("preparing")).toBe("in_china");
  });

  it("counts goods already in Iraq as still on the way", () => {
    // The bug this file exists for: "arrived" and "customs" used to be grouped
    // with "preparing", so a shipment sitting at Erbil customs would have been
    // listed under "in the China warehouse".
    expect(stageOf("arrived")).toBe("in_transit");
    expect(stageOf("customs")).toBe("in_transit");
    expect(stageOf("in_transit")).toBe("in_transit");
  });

  it("only calls it arrived once the customer has it", () => {
    expect(stageOf("delivered")).toBe("delivered");
    expect(stageOf("closed")).toBe("delivered");
  });

  it("never puts anything in China except preparing", () => {
    const inChina = ALL_STATUSES.filter((s) => stageOf(s) === "in_china");
    expect(inChina).toEqual(["preparing"]);
  });

  it("gives every database status a stage, so none can vanish from the list", () => {
    for (const status of ALL_STATUSES) {
      expect(stageOf(status), status).not.toBeNull();
    }
  });

  it("returns null for a status it does not know rather than guessing", () => {
    expect(stageOf("cancelled")).toBeNull();
    expect(stageOf("")).toBeNull();
  });
});

describe("matchesStage", () => {
  it("shows everything when no stage is chosen — the old All chip", () => {
    for (const status of ALL_STATUSES) {
      expect(matchesStage(status, ""), status).toBe(true);
    }
  });

  it("keeps the three stages disjoint, so nothing is listed twice", () => {
    for (const status of ALL_STATUSES) {
      const matched = (["in_china", "in_transit", "delivered"] as const).filter((stage) =>
        matchesStage(status, stage),
      );
      expect(matched, status).toHaveLength(1);
    }
  });

  it("hides an unknown status from every stage but still shows it unfiltered", () => {
    expect(matchesStage("cancelled", "in_china")).toBe(false);
    expect(matchesStage("cancelled", "in_transit")).toBe(false);
    expect(matchesStage("cancelled", "delivered")).toBe(false);
    expect(matchesStage("cancelled", "")).toBe(true);
  });
});

describe("countByStage", () => {
  it("counts each batch exactly once", () => {
    const counts = countByStage(ALL_STATUSES);
    expect(counts).toEqual({ in_china: 1, in_transit: 3, delivered: 2 });
    const total = counts.in_china + counts.in_transit + counts.delivered;
    expect(total).toBe(ALL_STATUSES.length);
  });

  it("returns zeros rather than an empty object when there is nothing to count", () => {
    expect(countByStage([])).toEqual({ in_china: 0, in_transit: 0, delivered: 0 });
  });

  it("ignores a status it does not recognise instead of miscounting it", () => {
    const counts = countByStage(["preparing", "cancelled"]);
    expect(counts).toEqual({ in_china: 1, in_transit: 0, delivered: 0 });
  });
});
