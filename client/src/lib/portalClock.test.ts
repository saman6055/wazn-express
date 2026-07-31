import { describe, it, expect } from "vitest";
import { formatClockTime, formatClockDate, msUntilNextMinute } from "./portalClock";

// Friday 31 July 2026, 09:41:30 local time.
const friday = new Date(2026, 6, 31, 9, 41, 30, 250);

const at = (h: number, m = 0) => new Date(2026, 6, 31, h, m);

describe("formatClockTime — 24 hour", () => {
  it("pads to a stable width so the header does not jump on the minute", () => {
    expect(formatClockTime(at(9, 5), "en")).toBe("09:05");
    expect(formatClockTime(at(0, 0), "en")).toBe("00:00");
    expect(formatClockTime(at(21, 7), "en")).toBe("21:07");
  });

  it("keeps digits Latin in every language — a clock is read at a glance", () => {
    for (const lang of ["ku", "ar", "en", "zh"]) {
      expect(formatClockTime(friday, lang), lang).toBe("09:41");
    }
  });
});

describe("formatClockTime — 12 hour", () => {
  it("shows midnight and noon as 12, not 0", () => {
    expect(formatClockTime(at(0, 0), "en", true)).toBe("12:00 AM");
    expect(formatClockTime(at(12, 0), "en", true)).toBe("12:00 PM");
  });

  it("drops the leading zero on the hour but keeps it on the minute", () => {
    expect(formatClockTime(at(9, 5), "en", true)).toBe("9:05 AM");
  });

  it("wraps the afternoon back to a 12-hour hand", () => {
    expect(formatClockTime(at(13, 30), "en", true)).toBe("1:30 PM");
    expect(formatClockTime(at(23, 59), "en", true)).toBe("11:59 PM");
  });

  it("marks before and after noon in each language's own convention", () => {
    expect(formatClockTime(at(9, 41), "ku", true)).toBe("9:41 پ.ن");
    expect(formatClockTime(at(15, 41), "ku", true)).toBe("3:41 د.ن");
    expect(formatClockTime(at(9, 41), "ar", true)).toBe("9:41 ص");
    expect(formatClockTime(at(15, 41), "ar", true)).toBe("3:41 م");
    expect(formatClockTime(at(9, 41), "zh", true)).toBe("9:41 上午");
  });

  it("falls back to AM/PM for a language with no marker of its own", () => {
    expect(formatClockTime(at(9, 41), "fr", true)).toBe("9:41 AM");
  });

  it("keeps the digits Latin here too", () => {
    expect(formatClockTime(at(9, 41), "ku", true)).toContain("9:41");
    expect(formatClockTime(at(9, 41), "ar", true)).toContain("9:41");
  });
});

describe("formatClockDate", () => {
  it("writes the Kurdish weekday and month, which Intl has no locale for", () => {
    expect(formatClockDate(friday, "ku")).toBe("هەینی، 31ی تەممووز");
  });

  it("names each Kurdish weekday correctly across a full week", () => {
    const week = [26, 27, 28, 29, 30, 31, 25].map((d) => new Date(2026, 6, d));
    expect(week.map((d) => formatClockDate(d, "ku").split("،")[0])).toEqual([
      "یەکشەممە", // Sun 26 July 2026
      "دووشەممە",
      "سێشەممە",
      "چوارشەممە",
      "پێنجشەممە",
      "هەینی",
      "شەممە", // Sat 25 July 2026
    ]);
  });

  it("picks the right Kurdish month at both ends of the year", () => {
    expect(formatClockDate(new Date(2026, 0, 1), "ku")).toContain("کانوونی دووەم");
    expect(formatClockDate(new Date(2026, 11, 31), "ku")).toContain("کانوونی یەکەم");
  });

  it("uses Latin digits so the date matches the time above it", () => {
    // Arabic would otherwise render ٣١ beside a Latin 09:41.
    for (const lang of ["ku", "ar", "en", "zh"]) {
      expect(formatClockDate(friday, lang), lang).toMatch(/31/);
    }
  });

  it("returns something readable for the other three languages", () => {
    for (const lang of ["en", "ar", "zh"]) {
      expect(formatClockDate(friday, lang).length, lang).toBeGreaterThan(3);
    }
  });
});

describe("msUntilNextMinute", () => {
  it("waits out the rest of the current minute", () => {
    // 30.250s elapsed, so 29.750s remain.
    expect(msUntilNextMinute(friday)).toBe(29_750);
  });

  it("never returns zero, which would spin the timer", () => {
    expect(msUntilNextMinute(new Date(2026, 6, 31, 9, 41, 0, 0))).toBe(60_000);
    expect(msUntilNextMinute(new Date(2026, 6, 31, 9, 41, 59, 999))).toBe(1);
  });
});
