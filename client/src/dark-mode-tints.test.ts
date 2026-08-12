import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A tinted card needs a dark-mode background, not just a dark-mode border.
 *
 * Every section card in the batch dialogs carried `dark:border-…` but no
 * `dark:bg-…`, so in dark mode a near-white tint at 30–50% opacity sat over
 * a dark surface and came out muddy grey. Sixteen cards, the same omission
 * in each — the kind of thing that reads as fine in review because the
 * `dark:` prefix is right there on the line.
 *
 * The border is the tell: a class list that bothers to theme its border for
 * dark mode but leaves a light `bg-…-50` untouched is the exact shape of
 * this bug.
 */

const SRC = __dirname;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

describe("dark mode tints", () => {
  const files = walk(SRC);

  it("scans a meaningful number of components", () => {
    // Guard the guard: if the walk ever returns nothing, the test below
    // would pass by finding no violations rather than by there being none.
    expect(files.length).toBeGreaterThan(100);
  });

  it("a card that themes its border for dark mode also themes its background", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const match of src.matchAll(/className="([^"]*)"/g)) {
        const classes = match[1];
        // Only the pale tints are at risk: -50 and -100 are near-white, so
        // over a dark surface they read as grey no matter the opacity.
        const lightBg = classes.match(/(?:^|\s)bg-([a-z]+)-(?:50|100)(?:\/\d+)?(?=\s|$)/);
        if (!lightBg) continue;
        if (!/\bdark:border-/.test(classes)) continue;
        if (/\bdark:bg-/.test(classes)) continue;
        offenders.push(`${path.relative(SRC, file)}: ${lightBg[0].trim()}`);
      }
    }

    expect(offenders, "add a dark:bg-… to each of these").toEqual([]);
  });
});
