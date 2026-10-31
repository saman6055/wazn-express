import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Nothing in the office is painted pure white any more.
 *
 * The owner, 2026-10-31: «باکگراوندەکان تەواو سپی بن … تەرکیز کەم دەکەن،
 * هێزی چاو زۆر دەبەن». Light mode is looked at for whole days, and every
 * card was oklch(1 0 0) — the brightest a screen can paint — with the page
 * behind them at 0.985, so the screen was glare and a card did not part
 * from the page it sat on.
 *
 * The surfaces are tokens now (--card, --background, --muted), tinted and
 * stepped apart, so one edit changes the whole system. This test is what
 * keeps it that way: a hand-written `bg-white` ignores the tokens and is a
 * bright patch on an otherwise calm screen, and `bg-slate-50` / `bg-gray-50`
 * are lighter than the page, so a panel meant to look recessed looks raised.
 */

const SRC = path.join(__dirname);

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(SRC);
  return out;
}

/** Opaque white only: `bg-white/10` over a photo or a dark header is fine. */
const WHITE = /(?<!dark:)\bbg-white\b(?!\/)/g;
const NEAR_WHITE = /(?<!dark:)\bbg-(?:slate|gray)-50\b(?!\/)/g;

function count(re: RegExp): { total: number; where: string[] } {
  let total = 0;
  const where: string[] = [];
  for (const file of sources()) {
    const hits = (fs.readFileSync(file, "utf8").match(re) ?? []).length;
    if (hits) {
      total += hits;
      where.push(`${path.relative(SRC, file)} ×${hits}`);
    }
  }
  return { total, where };
}

describe("light mode is not glare", () => {
  it("no new hand-written white", () => {
    /*
     * 240 became 8. What is left means white in both modes on purpose — a
     * chip that sits on a coloured active state and has to stay legible.
     * The number may fall; it may not rise. Use bg-card for a card or a
     * panel, bg-background for a page's own backdrop.
     */
    const { total, where } = count(WHITE);
    expect(total, where.join("\n")).toBeLessThanOrEqual(8);
  });

  it("no near-white grey standing in for a recessed panel", () => {
    // 107 became 0: bg-muted is that level, and it follows the theme.
    const { total, where } = count(NEAR_WHITE);
    expect(total, where.join("\n")).toBe(0);
  });

  it("the tokens themselves are off-white, and cards part from the page", () => {
    const css = fs.readFileSync(path.join(SRC, "index.css"), "utf8").replace(/\r\n/g, "\n");
    const root = css.slice(css.indexOf("\n:root {"), css.indexOf("\n.dark {"));
    const lightness = (name: string): number => {
      const m = root.match(new RegExp(`--${name}:\\s*oklch\\(([0-9.]+)`));
      expect(m, `--${name} is not an oklch value in :root`).toBeTruthy();
      return Number(m![1]);
    };

    const card = lightness("card");
    const page = lightness("background");
    expect(card, "a card may not be pure white").toBeLessThan(1);
    expect(page, "the page may not be near-white").toBeLessThanOrEqual(0.96);
    // The step between them is what makes a card readable as an object.
    expect(card - page).toBeGreaterThanOrEqual(0.02);
    // And the page still sits above its own recessed panels.
    expect(page).toBeGreaterThan(lightness("muted"));
  });

  it("paper stays white, whatever the screen is set to", () => {
    // A receipt is read once, on paper: a tinted card there is a wash of
    // ink, or a border with nothing inside it.
    const css = fs.readFileSync(path.join(SRC, "index.css"), "utf8").replace(/\r\n/g, "\n");
    // The pin is a :root inside a print block; the file has several print
    // blocks, so find the pin itself and check it is inside one of them.
    const pin = css.indexOf("  :root {\n    --background: oklch(1 0 0);");
    expect(pin, "no :root pinning white inside @media print").toBeGreaterThan(-1);
    const print = css.lastIndexOf("@media print {", pin);
    expect(print, "the pin is not inside a print block").toBeGreaterThan(-1);
    expect(css.slice(pin, pin + 400)).toContain("--card: oklch(1 0 0)");
  });
});
