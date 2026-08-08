import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Half of this portal's customers read right to left.
 *
 * Tailwind's physical classes — ml/mr, pl/pr, left/right, text-left/right —
 * do not flip with the document direction. The logical ones — ms/me, ps/pe,
 * start/end, text-start/end — do. A physical class is therefore a layout that
 * is correct in English and wrong in Kurdish and Arabic, and it looks
 * perfectly fine to whoever wrote it.
 *
 * The clearest case was the search boxes. An icon pinned with `left-4` and an
 * input padded `pl-12` to clear it: read right to left, the icon stays on the
 * left, the padding opens on the left, and the customer's own typing runs
 * straight underneath the magnifying glass. Four screens did this, including
 * the two search fields customers use most.
 */

const DIRS = [
  path.resolve(__dirname, "pages/portal"),
  path.resolve(__dirname, "components/portal"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const FILES = DIRS.flatMap((d) => walk(d));

/**
 * Decoration is exempt: a blurred translucent circle behind a header sits in
 * whichever corner it likes and nobody can tell. So is anything already
 * branching on `isRTL` or scoped with `rtl:`/`[dir=…]`, and `left-1/2`, which
 * centres rather than sides.
 */
const DECORATIVE =
  /(blur-|opacity-\d|pointer-events-none|-z-|bg-\w+(-\d+)?\/\d+\s|radial-gradient|rounded-full["'\s].*\bw-\d+\s+h-\d+)/;
const HANDLED = /isRTL|isRtl|\[dir=|rtl:|ltr:/;

const MOVES = /(?<![\w-])(ml|mr|pl|pr)-(\d+|px|\[[^\]]+\]|auto)(?![\w-])/g;
const POSITION = /(?<![\w-])(left|right)-(\d+(?:\.\d+)?|px|full|auto|\[[^\]]+\])(?![\w-])/g;
const ALIGN = /(?<![\w-])text-(left|right)(?![\w-])/g;

describe("the layout reads in both directions", () => {
  it("covers the whole portal", () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  it("no screen positions content with a class that cannot flip", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/^\s*(\*|\/\/)/.test(line)) return;
        if (HANDLED.test(line) || DECORATIVE.test(line)) return;

        const hits: string[] = [];
        for (const re of [MOVES, POSITION, ALIGN]) {
          re.lastIndex = 0;
          for (const m of line.matchAll(re)) {
            // `left-1/2` with a -translate-x-1/2 is centring, not siding.
            if (/^(left|right)-1$/.test(m[0]) && /-translate-x-1\/2/.test(line)) continue;
            hits.push(m[0]);
          }
        }
        if (hits.length) {
          offenders.push(`${path.basename(file)}:${i + 1} [${[...new Set(hits)].join(" ")}]`);
        }
      });
    }

    expect(
      offenders,
      offenders.length ? `use the logical class (ms/me, ps/pe, start/end, text-start/end):\n  ${offenders.join("\n  ")}` : "",
    ).toEqual([]);
  });
});
