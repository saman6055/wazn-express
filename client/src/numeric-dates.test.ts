import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fmtDate, fmtDateTime, fmtMonth, fmtTime, fmtWhen } from "./lib/numericDate";
import { formatPortalDate } from "./lib/portalClock";

/**
 * One date standard for the whole system — 28/07/2026 — the owner's pick,
 * taken from the portal.
 *
 * Staff screens used to ask the browser for 'ku', 'ku-IQ' or 'ku-Arab'.
 * Chrome ships none of them, so every call quietly fell back to the
 * machine's own locale: on an American-English Windows, 28 July 2026
 * printed as 7/28/2026 — month first, the one order nobody here reads.
 */

describe("the one format", () => {
  const d = new Date(2026, 6, 28, 9, 5, 7);

  it("is day/month/year, padded", () => {
    expect(fmtDate(d)).toBe("28/07/2026");
    expect(fmtDate(new Date(2026, 2, 5))).toBe("05/03/2026");
  });

  it("is the portal's format, character for character", () => {
    expect(fmtDate(d)).toBe(formatPortalDate(d, "ku"));
  });

  it("tells the time on a 24-hour clock", () => {
    expect(fmtTime(d)).toBe("09:05");
    expect(fmtTime(d, true)).toBe("09:05:07");
    expect(fmtDateTime(d)).toBe("09:05 · 28/07/2026");
  });

  it("names a month by its number", () => {
    expect(fmtMonth(d)).toBe("07/2026");
  });

  it("prints a dash for a date that cannot be read — never 'Invalid Date'", () => {
    const bad = new Date("not a date");
    for (const f of [fmtDate, fmtTime, fmtDateTime, fmtMonth]) expect(f(bad)).toBe("—");
  });
});

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "locales"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("no screen asks the browser for a Kurdish date format", () => {
  it("every date goes through lib/numericDate instead", () => {
    const ASKS = /(?:toLocale(?:Date|Time)?String|DateTimeFormat)\(\s*["'](?:ku|ckb)(?:-[A-Za-z]+)*["']/;
    const files = sourceFiles(path.resolve(__dirname));
    const offenders: string[] = [];
    for (const file of files) {
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (ASKS.test(line) && !/^\s*(\*|\/\/)/.test(line)) {
          offenders.push(`${path.relative(__dirname, file).replace(/\\/g, "/")}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(files.length, "the walk found no source").toBeGreaterThan(200);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

/**
 * No date is written as a distance from now (owner, 2026-09-23).
 *
 * "Take out all these dates written as today, yesterday, this week, last
 * week. Write the date properly — and when we go into the detail of a thing,
 * write the clock as well."
 *
 * "3 days ago" is a different sentence every day it is read: two people
 * looking at the same record a week apart see different text for one fact,
 * and neither can quote it back to a customer. A period FILTER may still be
 * called "today" — that names a range, not a moment — and a duration ("33
 * days in the depot") is an age, not a date. What is banned is a moment
 * printed as a distance.
 */
describe("a moment is written, never counted back from today", () => {
  it("takes whatever a payload holds, and says when the clock matters", () => {
    const d = new Date(2026, 6, 28, 9, 5, 0);
    expect(fmtWhen(d)).toBe("28/07/2026");
    expect(fmtWhen(d.toISOString())).toBe("28/07/2026");
    expect(fmtWhen(d.getTime())).toBe("28/07/2026");
    expect(fmtWhen(d, true)).toBe("09:05 · 28/07/2026");
  });

  it("prints a dash for nothing and for nonsense", () => {
    for (const bad of [null, undefined, "", "not a date", Number.NaN]) {
      expect(fmtWhen(bad as never), String(bad)).toBe("—");
    }
  });

  it("no screen measures a date against now", () => {
    // Counting how many invoices were written today is a figure, not a
    // date, and stays; what is banned is a moment RENDERED as a distance.
    const BANNED = [/formatDistanceToNow\s*\(/, /formatDistance\s*\(/, /toDateString\(\)\s*===\s*today\.toDateString\(\)/];
    const files = sourceFiles(path.resolve(__dirname));
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const rule of BANNED) {
        if (rule.test(src)) offenders.push(`${path.relative(__dirname, file)}  ${rule}`);
      }
    }
    expect(offenders, offenders.join(" | ")).toEqual([]);
  });

  it("the screens that used to are written out now", () => {
    const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8");
    expect(read("pages/CustomerMessages.tsx")).toContain("const formatTime = (date: any) => fmtWhen(date, true);");
    expect(read("pages/portal/PortalMessages.tsx")).toContain("const formatDate = (date: Date | string) => formatPortalDate(date, language);");
    expect(read("pages/portal/PortalNotifications.tsx")).toContain("return formatPortalDateTime(d, language);");
    expect(read("pages/SystemMonitorDashboard.tsx")).toContain("const formatTimeAgo = (date: Date | string) => fmtWhen(date, true);");
    expect(read("pages/BackupManagement.tsx")).toContain("fmtWhen(backup.createdAt, true)");
    expect(read("pages/UnclaimedPackages.tsx")).toContain("{fmtWhen(pkg.createdAt)}");
    expect(read("components/customers/CustomerPendingOrdersSection.tsx")).toContain("fmtWhen(order.updatedAt)");
  });
});
