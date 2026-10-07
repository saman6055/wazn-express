import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A floating element must pick its corner by reading direction, not by a
 * hardcoded left or right.
 *
 * The sidebar sits at the start of the reading direction: on the right in
 * Kurdish and Arabic, on the left in English. Anything pinned with a literal
 * `left-4` therefore looks correct in Kurdish — the away corner — and lands
 * on top of the sidebar the moment somebody switches to English, clipped by
 * the screen edge. That is exactly what happened to the tip-of-the-day card
 * and the scroll buttons.
 *
 * `start-*` and `end-*` follow the direction, so one class is right in all
 * four languages.
 *
 * Full-width bars (`left-0 right-0`) and centred elements (`left-1/2` with a
 * transform) are not affected: they pin both edges or the middle, so there is
 * no side to get wrong.
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

/** A class list that positions something floating. */
function floatingClassLists(): Array<{ file: string; classes: string }> {
  const out: Array<{ file: string; classes: string }> = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    const src = fs.readFileSync(file, "utf8");
    for (const match of src.matchAll(/"([^"]*\bfixed\b[^"]*)"/g)) {
      out.push({ file: rel, classes: match[1] });
    }
  }
  return out;
}

describe("floating elements follow the reading direction", () => {
  const lists = floatingClassLists();

  it("finds the floating elements at all", () => {
    // Guard the guard: no matches would make the test below pass by checking
    // nothing.
    expect(lists.length).toBeGreaterThan(10);
  });

  it("never pins one to a physical side", () => {
    const offenders: string[] = [];

    for (const { file, classes } of lists) {
      const side = classes.match(/(?:^|\s)(left|right)-([\w./[\]-]+)(?=\s|$)/);
      if (!side) continue;

      // Both edges pinned — a full-width bar has no side to get wrong.
      if (/(?:^|\s)left-\S+/.test(classes) && /(?:^|\s)right-\S+/.test(classes)) continue;
      // Centred, and moved back by half its own width.
      if (/-(?:translate-x|translate-x)-/.test(classes) && side[2] === "1/2") continue;

      offenders.push(`${file}: ${side[0].trim()}`);
    }

    expect(
      [...new Set(offenders)],
      "use start-* / end-* so the corner follows the language"
    ).toEqual([]);
  });

  it("opens the chat's and the lamp's panel on the rail's side, through one module", () => {
    /*
     * Three rules in a row, each for a reason that still holds.
     *
     * `end-4`, at first: the corner away from the sidebar in either language.
     *
     * Physical `right-*` from 2026-09-27 — «من وتم شوێنی نامە ناردن لەلای دەستی
     * ڕاست دروست بکە نەک چەپ» — because a corner is a place a thumb goes to,
     * not a reading direction. That was the one exception this file allowed.
     *
     * `start`, from 2026-10-07, when the two buttons left the page for the
     * foot of the menu rail («دەکەونە سەر نووسین و شت لە سیستەمدا»). With the
     * buttons in the rail, their panel belongs beside the rail: the right in
     * Kurdish, which is still the side he asked for, and the left in English
     * or Chinese, next to the button that was pressed. So the exception is
     * gone, and nothing is pinned to a physical side any more.
     */
    const corner = fs.readFileSync(path.join(SRC, "lib/floatingCorner.ts"), "utf8");
    expect(corner).toContain("start-4 md:start-24 z-40");
    expect(corner).not.toMatch(/(?:left|right)-\d/);
    const tips = fs.readFileSync(path.join(SRC, "components/StaffTips.tsx"), "utf8");
    expect(tips).toContain("${CORNER_PANEL}");
    expect(tips).not.toContain("fixed bottom-4 end-4");
    expect(tips).not.toContain("bottom-4 left-4");
  });
});
