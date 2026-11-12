import { describe, expect, it } from "vitest";
import { balancesByDate, checkPaidOn, earliestPaidOn, enteredLater, erbilToday, shortDay } from "./paidOn";

// 2026-11-12 22:30 in Erbil = 19:30 UTC.
const NOW = new Date("2026-11-12T19:30:00Z");

describe("paid day (owner, 2026-11-12)", () => {
  it("today is Erbil's day, not UTC's", () => {
    expect(erbilToday(new Date("2026-11-12T21:30:00Z"))).toBe("2026-11-13");
    expect(erbilToday(NOW)).toBe("2026-11-12");
  });

  it("today or nothing chosen changes nothing", () => {
    expect(checkPaidOn(undefined, "admin", NOW)).toEqual({ ok: true, paidAt: null });
    expect(checkPaidOn("2026-11-12", "admin", NOW)).toEqual({ ok: true, paidAt: null });
  });

  it("a past day dates the money that day at this moment's Erbil clock time", () => {
    const r = checkPaidOn("2026-11-08", "admin", NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.paidAt!.toISOString()).toBe("2026-11-08T19:30:00.000Z");
      expect(erbilToday(r.paidAt!)).toBe("2026-11-08");
    }
  });

  it("a future day is refused", () => {
    expect(checkPaidOn("2026-11-13", "super_admin", NOW)).toMatchObject({ ok: false, why: "future" });
  });

  it("staff go back 30 days, the main admin a year", () => {
    expect(earliestPaidOn("admin", NOW)).toBe("2026-10-13");
    expect(checkPaidOn("2026-10-12", "admin", NOW)).toMatchObject({ ok: false, why: "too_old" });
    expect(checkPaidOn("2026-10-12", "super_admin", NOW).ok).toBe(true);
    expect(checkPaidOn("2025-11-11", "super_admin", NOW)).toMatchObject({ ok: false, why: "too_old" });
  });

  it("a day that does not exist is refused", () => {
    expect(checkPaidOn("2026-02-30", "admin", NOW)).toMatchObject({ ok: false, why: "format" });
    expect(checkPaidOn("8/11/2026", "admin", NOW)).toMatchObject({ ok: false, why: "format" });
  });

  it("both dates show only when entered on a later day", () => {
    expect(enteredLater("2026-11-08T19:30:00Z", "2026-11-12T19:30:00Z")).toBe(true);
    expect(enteredLater("2026-11-12T19:30:00Z", "2026-11-12T19:31:00Z")).toBe(false);
    expect(enteredLater("2026-11-12T19:30:00Z", null)).toBe(false);
    expect(shortDay("2026-11-08T19:30:00Z")).toBe("08/11");
  });
});

describe("balance column read by date", () => {
  it("works back from the balance now, in whole cents", () => {
    // Owed 100, charged 50 (150), a back-dated payment of 30 sits before the charge by date.
    const rows = [
      { type: "CREDIT_PAYMENT", amountUsd: "30.00" },
      { type: "DEBIT_PACKAGE", amountUsd: "50.00" },
      { type: "ADJUSTMENT_DEBIT", amountUsd: "0.10" },
      { type: "CREDIT_DISCOUNT", amountUsd: "0.20" },
    ];
    expect(balancesByDate(rows, 119.9)).toEqual([70, 120, 120.1, 119.9]);
  });
});
