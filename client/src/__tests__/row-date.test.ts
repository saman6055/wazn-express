import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { formatRowDate, formatRowTime } from "../components/ui/relative-time";

/** This test's old home: paths below are read from here. */
const ROOT_DIR = path.resolve(__dirname, "..");

/** Owner, 2026-10-20: the full date on a row, never "last month"; the time beside it. */
describe("a row's date is written in full", () => {
  it("day-first date and a 24-hour time, Latin digits", () => {
    const d = new Date(2026, 9, 20, 14, 5);
    expect(formatRowDate(d)).toBe("20/10/2026");
    expect(formatRowTime(d)).toBe("14:05");
  });

  it("no list says 'last month' any more", () => {
    const src = fs.readFileSync(path.resolve(ROOT_DIR, "components/ui/relative-time.tsx"), "utf8");
    expect(src).not.toContain("RelativeTimeFormat(");
  });
});
