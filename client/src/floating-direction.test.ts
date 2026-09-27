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

      // The two corner buttons are placed by hand, through one module, on
      // the side the owner asked for and clear of the rail. Everything else
      // still follows the language.
      if (file === "lib/floatingCorner.ts") continue;

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

  it("keeps the corner buttons off the sidebar, on the side the owner asked for", () => {
    /*
     * This used to insist on `end-4` for the tip card: the corner away from
     * the sidebar in either language.
     *
     * The owner overruled it on 2026-09-27 — «من وتم شوێنی نامە
     * ناردن لەلای دەستی ڕاست دروست بکە نەک چەپ» — because a corner
     * is a place a thumb goes to, not a reading direction. The reason the
     * old rule existed is still honoured: the row starts clear of the 80px
     * rail from `md` up, so nothing lands on the sidebar in either
     * language (lib/floatingCorner).
     *
     * The rule below still holds for everything else: only these two
     * buttons and their panels are placed by hand, and they are placed
     * through that one module.
     */
    const tips = fs.readFileSync(path.join(SRC, "components/StaffTips.tsx"), "utf8");
    expect(tips).toContain("cornerSlot(CORNER.tips)");
    expect(tips).not.toContain("fixed bottom-4 end-4");
    expect(tips).not.toContain("bottom-4 left-4");
  });
});
