import { describe, expect, it } from "vitest";
import { milestoneReached, milestoneGreeting, MILESTONES } from "./milestones";

/**
 * A compliment that arrives twice was not meant the first time. Most of what
 * is guarded here is the not-saying-it-again.
 */

describe("a milestone is reached once", () => {
  it("finds the first parcel, which matters most", () => {
    expect(milestoneReached(1)).toBe(1);
  });

  it("says nothing below the first one", () => {
    expect(milestoneReached(0)).toBeNull();
    expect(milestoneReached(-3)).toBeNull();
  });

  it("says nothing between milestones", () => {
    expect(milestoneReached(7, 1)).toBeNull();
    expect(milestoneReached(99, 50)).toBeNull();
  });

  it("does not repeat one already celebrated", () => {
    // A customer at 120 was being told about their hundredth every time they
    // opened the portal, which turns a compliment into a nag.
    expect(milestoneReached(120, 100)).toBeNull();
    expect(milestoneReached(100, 100)).toBeNull();
  });

  it("fires again once the next one is passed", () => {
    expect(milestoneReached(250, 100)).toBe(250);
  });

  it("gives one message, not four, to somebody arriving with a history", () => {
    // A customer imported from an old system with 300 behind them gets 250,
    // not a climb through 1, 10, 25, 50, 100.
    expect(milestoneReached(300, 0)).toBe(250);
  });

  it("survives a count that is not a number", () => {
    expect(milestoneReached(NaN)).toBeNull();
    expect(milestoneReached(Infinity, 5000)).toBeNull();
  });

  it("thins out as it climbs, so a busy customer is not congratulated weekly", () => {
    const gaps = MILESTONES.slice(1).map((m, i) => m - MILESTONES[i]!);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!, `the gap shrank at ${MILESTONES[i + 1]}`).toBeGreaterThanOrEqual(gaps[i - 1]!);
    }
  });
});

describe("what it says", () => {
  it("welcomes the first rather than congratulating it", () => {
    const g = milestoneGreeting(1);
    expect(g.title.ku).toContain("بەخێربێیت");
    expect(g.message.en).toContain("first parcel");
  });

  it("names the number on every later one", () => {
    for (const count of [10, 100, 1000] as const) {
      const g = milestoneGreeting(count);
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(g.title[lang], `${count} title ${lang}`).toContain(String(count));
      }
    }
  });

  it("is written in all four languages, every one of them", () => {
    for (const count of MILESTONES) {
      const g = milestoneGreeting(count);
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(g.title[lang], `${count} title has no ${lang}`).toBeTruthy();
        expect(g.message[lang], `${count} message has no ${lang}`).toBeTruthy();
      }
    }
  });

  it("talks about the customer, not about the company", () => {
    const g = milestoneGreeting(100);
    expect(g.message.en.toLowerCase()).toContain("thank you");
  });
});
