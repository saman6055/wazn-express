import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { formatClockTime, formatClockDate, msUntilNextMinute, monthName } from "./portalClock";

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

  it("marks before and after noon in a form each language actually reads", () => {
    expect(formatClockTime(at(9, 41), "ku", true)).toBe("9:41 AM");
    expect(formatClockTime(at(15, 41), "ku", true)).toBe("3:41 PM");
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
  it("writes the Kurdish weekday, which Intl has no locale for, plus a numeric date", () => {
    expect(formatClockDate(friday, "ku")).toBe("هەینی، 31/7");
  });

  it("keeps the whole date short enough for the clock box", () => {
    // The month was spelled out at first and overflowed the box on a phone.
    for (const lang of ["ku", "en", "ar", "zh"]) {
      expect(formatClockDate(friday, lang).length, lang).toBeLessThanOrEqual(14);
    }
  });

  it("writes day then month, the order the region reads dates in", () => {
    // 31/7, never 7/31 — a US-style date would be read as a wrong day here.
    expect(formatClockDate(friday, "ku")).toContain("31/7");
    expect(formatClockDate(friday, "en")).toContain("31/7");
  });

  it("does not pad the month, so January reads 1 rather than 01", () => {
    expect(formatClockDate(new Date(2026, 0, 5), "ku")).toContain("5/1");
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

  it("numbers the month from 1, not from 0", () => {
    expect(formatClockDate(new Date(2026, 0, 1), "ku")).toContain("1/1");
    expect(formatClockDate(new Date(2026, 11, 31), "ku")).toContain("31/12");
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

describe("digits and clocks do not follow the device", () => {
  const DIRS = [
    path.resolve(__dirname, "../pages/portal"),
    path.resolve(__dirname, "../components/portal"),
  ];
  const walk = (d: string, o: string[] = []): string[] => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, o);
      else if (/\.tsx?$/.test(e.name)) o.push(p);
    }
    return o;
  };
  const FILES = DIRS.flatMap((d) => walk(d));

  /**
   * `toLocaleString()` with no argument follows the device, not the language
   * the customer picked. On an Arabic handset that meant a parcel count in
   * Eastern digits (٤٢) directly beside money the money helpers had already
   * printed in Western ones — two number systems in one card.
   */
  it("every toLocaleString names its locale", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/\.toLocale(?:Date|Time)?String\(\s*\)/g)) {
        offenders.push(`${path.basename(f)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * "ku" is a valid language subtag with no locale data behind it, so
   * `toLocaleTimeString("ku")` silently falls back to the device — the same
   * bug wearing a Kurdish label. Times go through formatClockTime, which
   * builds them from the parts rather than asking Intl for a language it does
   * not have.
   */
  it("no screen asks Intl for a Kurdish locale", () => {
    const offenders: string[] = [];
    for (const f of [...FILES, path.resolve(__dirname, "portalClock.ts")]) {
      // Comment lines are stripped first: several of these files carry a note
      // quoting the bug they used to have, and a quotation is not a call.
      const src = fs.readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\*|\/\/)/.test(l))
        .join("\n");
      for (const m of src.matchAll(/toLocale\w*String\(\s*[^)]*["'`]ku(?:-\w+)?["'`]/g)) {
        offenders.push(`${path.basename(f)}: ${m[0].slice(0, 60)}`);
      }
      for (const m of src.matchAll(/Intl\.\w+\(\s*["'`]ku(?:-\w+)?["'`]/g)) {
        offenders.push(`${path.basename(f)}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("names a month in all four languages", () => {
    // The invoice report kept an English array and a Kurdish array, and the
    // CSV took the English one whatever the customer was reading.
    expect(monthName(0, "ku")).toBe("کانوونی دووەم");
    expect(monthName(0, "en")).toMatch(/January/i);
    expect(monthName(0, "ar")).toMatch(/[\u0600-\u06FF]/);
    expect(monthName(0, "zh")).toMatch(/[\u4e00-\u9fff]/);
    // Out-of-range indices wrap rather than returning undefined.
    expect(monthName(12, "ku")).toBe(monthName(0, "ku"));
    expect(monthName(-1, "ku")).toBe(monthName(11, "ku"));
  });
});
