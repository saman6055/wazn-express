import { describe, expect, it } from "vitest";
import { erbilDay, erbilDayStart, summarizeStations, type StationEvent } from "./stationActivity";

describe("station activity is counted on Erbil days", () => {
  it("splits days at Erbil midnight, not UTC midnight", () => {
    // 22:30 UTC on the 6th is 01:30 on the 7th in Erbil.
    expect(erbilDay(Date.parse("2026-11-06T22:30:00Z"))).toBe("2026-11-07");
    expect(erbilDay(Date.parse("2026-11-06T20:59:00Z"))).toBe("2026-11-06");
    expect(new Date(erbilDayStart("2026-11-07")).toISOString()).toBe("2026-11-06T21:00:00.000Z");
  });

  it("counts each station, today, yesterday up to the same hour, and who did it", () => {
    const now = Date.parse("2026-11-07T09:00:00Z"); // 12:00 in Erbil
    const ev = (station: StationEvent["station"], iso: string, userId: number | null = 1): StationEvent => ({ station, at: new Date(iso), userId });
    const events = [
      ev("registered", "2026-11-07T06:00:00Z", 1),
      ev("registered", "2026-11-07T07:00:00Z", 2),
      ev("in_batch", "2026-11-07T08:00:00Z", 2),
      ev("delivered", "2026-11-07T08:30:00Z", null),
      ev("received_local", "2026-11-06T07:00:00Z", 1), // yesterday 10:00 - before this hour
      ev("received_local", "2026-11-06T12:00:00Z", 1), // yesterday 15:00 - after it
      ev("registered", "2026-11-07T10:00:00Z", 1), // in the future: ignored
      ev("registered", "2026-10-20T10:00:00Z", 1), // outside the week
    ];
    const s = summarizeStations(events, now, 7);
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
    expect(s.today).toEqual({ registered: 2, in_batch: 1, received_local: 0, delivered: 1 });
    expect(s.todayTotal).toBe(4);
    expect(s.yesterdaySoFar).toBe(1);
    expect(s.days[5]!.received_local).toBe(2);
    expect(s.days[6]!.total).toBe(4);
    expect(s.byUser).toEqual([{ userId: 2, count: 2 }, { userId: 1, count: 1 }]);
  });
});
