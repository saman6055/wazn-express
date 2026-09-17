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
  daysWaitingForTracking,
  isOverCreditLimit,
  isTrackingOverdue,
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

describe("a debt past its limit — one rule for the bell, the dashboard and the debtors list", () => {
  it("is a positive balance above the customer's own limit", () => {
    expect(isOverCreditLimit("150.00", "100.00")).toBe(true);
    expect(isOverCreditLimit("100.00", "100.00")).toBe(false);
    expect(isOverCreditLimit(99.5, "100")).toBe(false);
  });

  it("counts a limit nobody set as zero", () => {
    expect(isOverCreditLimit("50", null)).toBe(true);
    expect(isOverCreditLimit("50", undefined)).toBe(true);
    expect(isOverCreditLimit("50", "")).toBe(true);
  });

  it("is never a customer who owes nothing, or a figure that is not a number", () => {
    expect(isOverCreditLimit("0", null)).toBe(false);
    expect(isOverCreditLimit("-20", "0")).toBe(false);
    expect(isOverCreditLimit(null, null)).toBe(false);
    expect(isOverCreditLimit("abc", "10")).toBe(false);
  });
});

describe("an order waiting for its tracking number", () => {
  const now = new Date("2026-09-17T12:00:00Z");

  it("has waited whole days since its order date", () => {
    expect(daysWaitingForTracking("2026-09-10T12:00:00Z", now)).toBe(7);
    expect(daysWaitingForTracking("2026-09-10T12:00:01Z", now)).toBe(6);
    expect(daysWaitingForTracking(new Date("2026-09-17T08:00:00Z"), now)).toBe(0);
  });

  it("has waited no days when there is no usable date", () => {
    expect(daysWaitingForTracking(null, now)).toBe(0);
    expect(daysWaitingForTracking(undefined, now)).toBe(0);
    expect(daysWaitingForTracking("not a date", now)).toBe(0);
  });

  it("is overdue from the owner's 7 days, the page's 7+ bucket", () => {
    expect(ORDER_NO_TRACKING_DAYS).toBe(7);
    expect(isTrackingOverdue(7)).toBe(true);
    expect(isTrackingOverdue(6)).toBe(false);
  });
});
