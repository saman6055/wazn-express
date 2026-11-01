import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The portal asks the app for its colours.
 *
 * It was built dark, and light mode was added afterwards, one page at a time.
 * By 2026-09-30 every page carried its own palette, written out as
 * `isDark ? "bg-slate-800" : "bg-white"` — 661 of those pairs across 30 files,
 * each page deciding for itself what a card, a border or a quiet line of text
 * should look like. Two complaints came out of it on the same day, and they
 * were the same fault:
 *
 *   «لە پۆرتال وایت مۆد بەس لە یەک پەڕە کاردەکات»
 *   «پۆرتالی هەموان یەکگرتوو بێت، نەک هەر کۆدەیەک بە جۆرێک»
 *
 * A page that never learned the light half stayed dark; a page that did
 * learned its own version of it.
 *
 * The app already carries those roles as tokens — `bg-card`, `bg-muted`,
 * `text-foreground`, `text-muted-foreground`, `border-border` — with a value
 * for each mode, and the mode is already on the document. So the pairs became
 * the token, and the portal stopped asking which mode it was in.
 *
 * Brand colour is not in this: a banner painted in the mode's own blue, and
 * red for debt or green for success, mean something and are left alone.
 */

const DIRS = [
  path.resolve(__dirname, "pages", "portal"),
  path.resolve(__dirname, "components", "portal"),
];

const files = DIRS.flatMap((dir) =>
  fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => path.join(dir, f)),
);

const source = new Map(files.map((f) => [path.basename(f), fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n")]));
const all = [...source.values()].join("\n");

/** `isDark ? "…" : "…"` — a page painting a surface by hand. */
const HAND_PAINTED = /isDark\s*\?\s*"[^"]*"\s*:\s*"[^"]*"/g;

describe("one look, both modes", () => {
  it("the neutral surfaces are tokens, not hand-written pairs", () => {
    // Every one of these was written out on page after page. They are roles
    // the app already names, so the page says the role.
    const gone = [
      'isDark ? "text-slate-400" : "text-slate-500"',
      'isDark ? "text-white" : "text-slate-800 dark:text-slate-200"',
      'isDark ? "bg-slate-800" : "bg-white"',
      'isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60"',
      'isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40"',
    ];
    for (const shape of gone) expect(all, shape).not.toContain(shape);
  });

  it("what is left may only shrink", () => {
    /*
     * 661 pairs became 166, and those are one-offs — a violet chip, a shadow
     * written as two box-shadows, a button that is its own thing. They are
     * not wrong, they are simply not worth a token each.
     *
     * The number is here so the next person to reach for `isDark ? … : …`
     * has to look at this file and decide whether the role deserves a name.
     */
    const remaining = (all.match(HAND_PAINTED) ?? []).length;
    expect(remaining).toBeLessThanOrEqual(166);
  });

  it("a card is a card on every page", () => {
    // The pages a customer lives in, all asking for the same surface.
    for (const page of ["PortalHome.tsx", "PortalShipments.tsx", "PortalFinancial.tsx", "PortalProfile.tsx"]) {
      const src = source.get(page);
      expect(src, page).toBeTruthy();
      expect(src, page).toMatch(/bg-card|bg-muted|text-muted-foreground|text-foreground/);
    }
  });

  it("brand colour is untouched — it is not a mode, it is the company", () => {
    // The banner still takes its blue from the mode's own palette, and a
    // figure in the red of debt stays red in both modes.
    const modes = fs.readFileSync(path.resolve(__dirname, "lib", "portalModes.ts"), "utf8");
    expect(modes).toContain("export interface PortalPalette");
    expect(modes).toContain("Only brand colour goes through here");
  });
});
