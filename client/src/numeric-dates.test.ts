import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fmtDate, fmtDateTime, fmtMonth, fmtTime } from "./lib/numericDate";
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

describe("no screen asks the browser for a Kurdish date format", () => {
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "locales"].includes(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(p, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }

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
