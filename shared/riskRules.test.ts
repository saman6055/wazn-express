import { describe, expect, it } from "vitest";
import {
  levelRank,
  staleDepotLevel,
  volumetricLevel,
  worstLevel,
  ORDER_NO_TRACKING_DAYS,
  RISK_LEVEL_LABEL,
  RISK_LEVELS,
  STALE_IN_DEPOT_AFTER_DAYS,
  STALE_IN_DEPOT_CRITICAL_DAYS,
  VOLUMETRIC_CRITICAL_RATIO,
} from "./riskRules";

describe("the owner's risk levels", () => {
  it("a parcel waits 15 days before it is a risk, and is critical after 30", () => {
    expect(STALE_IN_DEPOT_AFTER_DAYS).toBe(15);
    expect(STALE_IN_DEPOT_CRITICAL_DAYS).toBe(30);
    expect(staleDepotLevel(15)).toBe("high");
    expect(staleDepotLevel(30)).toBe("high");
    expect(staleDepotLevel(31)).toBe("critical");
    expect(staleDepotLevel(136)).toBe("critical");
  });

  it("a volumetric parcel billed at three times its weight or more is critical", () => {
    expect(VOLUMETRIC_CRITICAL_RATIO).toBe(3);
    expect(volumetricLevel(2.99)).toBe("high");
    expect(volumetricLevel(3)).toBe("critical");
    expect(volumetricLevel(3.41)).toBe("critical");
  });

  it("an order is late for its tracking number after 7 days", () => {
    expect(ORDER_NO_TRACKING_DAYS).toBe(7);
  });
});

describe("ordering risks", () => {
  it("reads worst first", () => {
    expect(RISK_LEVELS).toEqual(["critical", "high", "notice"]);
    expect(levelRank("critical")).toBeLessThan(levelRank("high"));
    expect(levelRank("high")).toBeLessThan(levelRank("notice"));
  });

  it("names the most serious of several, and nothing for none", () => {
    expect(worstLevel(["notice", "high", "notice"])).toBe("high");
    expect(worstLevel(["high", "critical"])).toBe("critical");
    expect(worstLevel([])).toBeNull();
  });

  it("every level has a name in four languages", () => {
    for (const level of RISK_LEVELS) {
      const words = RISK_LEVEL_LABEL[level];
      expect(words.ku && words.en && words.ar && words.zh, level).toBeTruthy();
    }
    expect(RISK_LEVEL_LABEL.critical.ku).toBe("زۆر مەترسیدار");
  });
});
