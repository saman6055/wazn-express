import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A surface or a text colour chosen for a white page needs a dark-mode
 * counterpart, or it goes unreadable when the theme flips.
 *
 * Two reports, both the same underlying omission: the batch dialog's cards
 * came out muddy grey, and the portal's notification cards did too with body
 * text that faded into them. A pale tint at 30–50% opacity over a dark
 * surface reads as grey no matter which colour it started as, and a
 * `text-gray-600` written for white paper is nearly invisible on it.
 *
 * Excluded, deliberately:
 *
 *  - class lists that branch on `isDark` or the theme context. Those already
 *    answer the question their own way, and a `dark:` class would be a second,
 *    competing answer.
 *  - a translucent `bg-white/10`. That is a highlight painted over something
 *    else — a gradient banner, a glass panel — not a surface of its own.
 *  - anything that is meant to be a sheet of paper: a printed label, an
 *    invoice preview, the white thumb of a slider. Those stay white in both
 *    modes, because paper does.
 */

const SRC = __dirname;

const KEEP_WHITE = new Set([
  "components/ui/slider.tsx",
  "pages/LabelTemplateSettings.tsx",
  "pages/BatchLabelTemplateSettings.tsx",
  "pages/LabelPrinting.tsx",
  "components/delivery/BatchPrintBoxesSection.tsx",
]);

const COLORS =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

/** A background pale enough to disappear against a dark page. */
const PALE_BG = new RegExp(`(?:^|\\s)(bg-white|bg-(?:${COLORS})-(?:50|100|200))(?:\\/\\d+)?(?=\\s|$)`);
/** A text colour dark enough to disappear against a dark page. */
const DARK_TEXT = new RegExp(`(?:^|\\s)(text-(?:${COLORS})-(?:500|600|700|800|900))(?:\\/\\d+)?(?=\\s|$)`);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

/** Every className="..." / className={...} expression, with its file. */
function classExpressions(): Array<{ file: string; body: string }> {
  const out: Array<{ file: string; body: string }> = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/className=(?:"[^"]*"|\{[\s\S]*?\}(?=\s|>|\/>))/g)) {
      out.push({ file: rel, body: m[0] });
    }
  }
  return out;
}

/** The literals inside one expression, minus the ones we never police. */
function literals(body: string): string[] {
  if (/\bprint:/.test(body) || /wazn-paper/.test(body)) return [];
  if (/isDark|theme\s*===\s*['"]dark['"]/.test(body)) return [];
  return [...body.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

describe("dark mode", () => {
  const expressions = classExpressions();

  it("scans a meaningful amount of the app", () => {
    // Guard the guard: were either regex to stop matching, the tests below
    // would pass by finding nothing rather than by there being nothing.
    expect(expressions.length).toBeGreaterThan(5000);
  });

  it("every pale surface has a dark counterpart", () => {
    const offenders: string[] = [];
    for (const { file, body } of expressions) {
      if (KEEP_WHITE.has(file)) continue;
      if (/\bdark:bg-/.test(body)) continue;
      for (const classes of literals(body)) {
        const hit = classes.match(PALE_BG);
        // A translucent white is an overlay, not a surface.
        if (!hit || /bg-white\/\d/.test(hit[0])) continue;
        offenders.push(`${file}: ${hit[1]}`);
      }
    }
    expect([...new Set(offenders)], "each of these needs a dark:bg-…").toEqual([]);
  });

  it("every text colour written for white paper has a dark counterpart", () => {
    const offenders: string[] = [];
    for (const { file, body } of expressions) {
      if (/\bdark:text-/.test(body)) continue;
      for (const classes of literals(body)) {
        const hit = classes.match(DARK_TEXT);
        if (!hit) continue;
        offenders.push(`${file}: ${hit[1]}`);
      }
    }
    expect([...new Set(offenders)], "each of these needs a dark:text-…").toEqual([]);
  });
});
