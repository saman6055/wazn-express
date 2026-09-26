import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The office system on a phone.
 *
 * The owner, 2026-09-26: «کاتێ من سیستەم لەسەر مۆبایل بکەمەوە، سیستەم خۆی
 * لەگەڵ شاشەی مۆبایل بگونجێنێ وەکو پۆرتاڵی موشتەری، بۆ ئەوەی بتوانم بە دڵی
 * خۆم لەسەر مۆبایلیش کارەکانی خۆم بە ئاسانی ڕاپەڕێنم.»
 *
 * Two things break a working screen on a 375-pixel phone, and both are
 * written rather than judged: a grid that keeps four columns, and a panel
 * with a width wider than the phone. Everything else — the tables — already
 * scrolls inside itself (components/ui/table).
 */

const ROOT = path.resolve(__dirname, "..", "..", "client", "src");

function screens(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) out.push(p);
    }
  };
  walk(ROOT);
  return out;
}

const CLASS = /className=\{?"([^"]*)"/g;

describe("a screen fits the phone it is opened on", () => {
  it("never holds four columns at phone width", () => {
    // Two across on a phone, the designed count from md up. Three is left
    // alone: three small cells fit, and a row of three choices that folds
    // is worse than one that does not (the portal's own rule).
    const offenders: string[] = [];
    for (const file of screens()) {
      const src = fs.readFileSync(file, "utf8");
      for (const match of src.matchAll(CLASS)) {
        const classes = match[1];
        if (!/(?<![:\w-])grid-cols-([4-9]|1[0-2])\b/.test(classes)) continue;
        if (/(sm|md|lg|xl|2xl):grid-cols-/.test(classes)) continue;
        offenders.push(`${path.relative(ROOT, file)}  ${classes.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never sets a width wider than a phone without a way out", () => {
    // `sm:max-w-[600px]` is fine — below sm it is full width. A bare
    // `w-[400px]` is not: it simply hangs off the side.
    const offenders: string[] = [];
    for (const file of screens()) {
      const src = fs.readFileSync(file, "utf8");
      for (const match of src.matchAll(CLASS)) {
        const classes = match[1];
        for (const hit of classes.matchAll(/(?<![:\w-])w-\[(\d{3,4})px\]/g)) {
          if (Number(hit[1]) < 380) continue;
          // Decoration that is positioned out of flow cannot push anything.
          if (/\babsolute\b|\bfixed\b/.test(classes)) continue;
          offenders.push(`${path.relative(ROOT, file)}  ${hit[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the office's own furniture out of the way of a thumb", () => {
    // The chat bubble and the task list sit where a thumb reaches, and
    // neither is printed.
    const chat = fs.readFileSync(path.join(ROOT, "components/chat/StaffChat.tsx"), "utf8");
    expect(chat).toContain("fixed bottom-4 end-4");
    expect(chat).toContain("max-w-[calc(100vw-2rem)]");
  });
});
