import { describe, it, expect } from "vitest";
import { PAID_WINDOWS, paidWindowStart, unpaidSummary, withoutMoney, type BoxOverview } from "./boxOverview";
import { receivedWindows } from "./workingCapital";

/**
 * The figures on top of the delivery page (owner, 2026-10-06 and 2026-10-07):
 * the money not paid yet and the box that owes most; the boxes whose money
 * was taken today, this week and ever. Each is the count of a list a press
 * opens. The reads were proved on a real MySQL - see
 * client/src/delivery-overview.test.ts for the figures.
 */
describe("what is not paid yet", () => {
  const now = new Date("2026-10-07T09:00:00Z");
  const box = (boxId: number, usd: number, customerId: number | null, daysAgo: number) => ({
    boxId,
    boxCode: `BOX-${boxId}`,
    customerId,
    outstandingUsd: usd,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000),
  });

  it("adds every box on the list, in whole cents", () => {
    const s = unpaidSummary([box(1, 0.1, 7, 1), box(2, 0.2, 7, 2), box(3, 142.5, 8, 3)], now);
    expect(s.usd).toBe(142.8);
    expect(s.boxes).toBe(3);
  });

  it("counts a customer once however many boxes they have", () => {
    const s = unpaidSummary([box(1, 10, 7, 1), box(2, 20, 7, 2), box(3, 30, 8, 3), box(4, 5, null, 1)], now);
    expect(s.customers).toBe(2);
    expect(s.boxes).toBe(4);
  });

  it("names the box that owes the most", () => {
    const s = unpaidSummary([box(1, 10, 7, 1), box(2, 142.5, 8, 2), box(3, 30, 9, 3)], now);
    expect(s.top).toEqual({ boxId: 2, boxCode: "BOX-2", customerId: 8, usd: 142.5 });
  });

  it("between two that owe the same, the one waiting longer", () => {
    const s = unpaidSummary([box(1, 50, 7, 2), box(2, 50, 8, 9)], now);
    expect(s.top?.boxId).toBe(2);
  });

  it("names no box when none owes anything, but still counts the list", () => {
    // A box whose parcels are not priced yet is on the list and owes nothing so far.
    const s = unpaidSummary([box(1, 0, 7, 4), box(2, 0, 8, 1)], now);
    expect(s.top).toBeNull();
    expect(s.usd).toBe(0);
    expect(s.boxes).toBe(2);
    expect(s.oldestDays).toBe(4);
  });

  it("an overpaid line never lowers the total", () => {
    const s = unpaidSummary([box(1, -5, 7, 1), box(2, 20, 8, 1)], now);
    expect(s.usd).toBe(20);
  });

  it("says how long the oldest has waited, and nothing when the list is empty", () => {
    expect(unpaidSummary([box(1, 10, 7, 2), box(2, 10, 8, 12)], now).oldestDays).toBe(12);
    const none = unpaidSummary([], now);
    expect(none).toEqual({ boxes: 0, customers: 0, usd: 0, oldestDays: null, top: null });
  });
});

describe("today, this week, ever", () => {
  it("are the office's own day and week - Baghdad's clock, Saturday first", () => {
    // Wednesday 2026-10-07, 09:00 UTC = 12:00 in Baghdad.
    const now = new Date("2026-10-07T09:00:00Z");
    expect(paidWindowStart("today", now).toISOString()).toBe("2026-10-06T21:00:00.000Z");
    // The Saturday before is 2026-10-03.
    expect(paidWindowStart("week", now).toISOString()).toBe("2026-10-02T21:00:00.000Z");
    expect(paidWindowStart("all", now).getTime()).toBe(0);
  });

  it("are the same windows the money-received card uses", () => {
    const now = new Date("2026-10-07T22:30:00Z"); // already Thursday in Baghdad
    const w = receivedWindows(now);
    expect(paidWindowStart("today", now)).toEqual(w.today);
    expect(paidWindowStart("week", now)).toEqual(w.week);
  });

  it("each window holds the one before it", () => {
    const now = new Date("2026-10-07T09:00:00Z");
    const [today, week, all] = PAID_WINDOWS.map((w) => paidWindowStart(w, now).getTime());
    expect(today).toBeGreaterThanOrEqual(week);
    expect(week).toBeGreaterThan(all);
  });
});

describe("somebody who does not answer for the books", () => {
  const full: BoxOverview = {
    unpaid: {
      boxes: 11, customers: 8, usd: 605.37, oldestDays: 12,
      top: { boxId: 4, boxCode: "BOX-20261003-004", customerId: 3, customerCode: "AZ173", customerName: "Sayf", usd: 142.5 },
    },
    received: {
      today: { boxes: 3, usd: 210, discountUsd: 5 },
      week: { boxes: 12, usd: 1040, discountUsd: 12 },
      all: { boxes: 418, usd: 51234.5, discountUsd: 310 },
    },
  };

  it("keeps every count and every link, and loses every dollar", () => {
    const quiet = withoutMoney(full);
    expect(quiet.unpaid.boxes).toBe(11);
    expect(quiet.unpaid.customers).toBe(8);
    expect(quiet.unpaid.oldestDays).toBe(12);
    expect(quiet.unpaid.top?.boxId).toBe(4);
    expect(quiet.received.week.boxes).toBe(12);
    expect(JSON.stringify(quiet)).not.toMatch(/605\.37|142\.5|1040|51234|"usd":[0-9]|"discountUsd":[0-9]/);
  });

  it("does not change what the others are sent", () => {
    withoutMoney(full);
    expect(full.unpaid.usd).toBe(605.37);
    expect(full.received.all.usd).toBe(51234.5);
  });
});
