import { describe, it, expect } from "vitest";
import {
  toArabicIndic,
  formatClockTime,
  formatClockDate,
  msUntilNextMinute,
} from "./portalClock";

// Friday 31 July 2026, 09:41:30 local time.
const friday = new Date(2026, 6, 31, 9, 41, 30, 250);

describe("toArabicIndic", () => {
  it("converts digits and leaves everything else alone", () => {
    expect(toArabicIndic("09:41")).toBe("٠٩:٤١");
    expect(toArabicIndic("31ی تەممووز")).toBe("٣١ی تەممووز");
  });

  it("returns a string with no digits unchanged", () => {
    expect(toArabicIndic("هەینی")).toBe("هەینی");
  });
});

describe("formatClockTime", () => {
  it("pads to a stable width so the header does not jump on the minute", () => {
    expect(formatClockTime(new Date(2026, 6, 31, 9, 5), "en")).toBe("09:05");
    expect(formatClockTime(new Date(2026, 6, 31, 0, 0), "en")).toBe("00:00");
  });

  it("uses a 24-hour clock, avoiding an AM/PM marker Kurdish has no short form for", () => {
    expect(formatClockTime(new Date(2026, 6, 31, 21, 7), "en")).toBe("21:07");
  });

  it("switches to Arabic-Indic digits for Kurdish and Arabic", () => {
    expect(formatClockTime(friday, "ku")).toBe("٠٩:٤١");
    expect(formatClockTime(friday, "ar")).toBe("٠٩:٤١");
    expect(formatClockTime(friday, "en")).toBe("09:41");
    expect(formatClockTime(friday, "zh")).toBe("09:41");
  });
});

describe("formatClockDate", () => {
  it("writes the Kurdish weekday and month, which Intl has no locale for", () => {
    expect(formatClockDate(friday, "ku")).toBe("هەینی، ٣١ی تەممووز");
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

  it("returns something non-empty for the other three languages", () => {
    for (const lang of ["en", "ar", "zh"]) {
      const text = formatClockDate(friday, lang);
      expect(text.length, lang).toBeGreaterThan(3);
    }
  });

  it("puts the day number in the English date", () => {
    expect(formatClockDate(friday, "en")).toContain("31");
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
