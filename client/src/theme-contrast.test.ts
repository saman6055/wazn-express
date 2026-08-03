import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Every hardcoded colour must work in both themes.
 *
 * The design tokens (text-foreground, bg-card, …) adapt on their own, and most
 * of the app uses them. The trouble is the raw Tailwind palette: a card that
 * keeps `bg-amber-50` while the page behind it goes near-black, or text left at
 * `text-slate-800` on a surface that does adapt — near-black on near-black.
 * Roughly 2700 such classes had accumulated before this was swept.
 *
 * These tests are the guard rail. They fail on the next one, while it is still
 * one line in a diff rather than a screen somebody cannot read.
 */

const SEMANTIC = 'red|amber|emerald|green|blue|sky|violet|purple|teal|rose|orange|indigo|fuchsia|cyan|lime|pink|yellow';
const GREY = 'slate|gray|zinc|neutral|stone';

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(p));
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const ROOT = path.resolve(__dirname);
const FILES = tsxFiles(ROOT);

/**
 * Report offenders with enough context to fix them without hunting.
 *
 * A semantic colour must stay in its own family — a danger chip that turns
 * blue in dark mode has lost the only thing it was saying. The neutrals are
 * interchangeable: pairing bg-gray-100 with dark:bg-slate-800 is a choice, not
 * a mistake, so any grey counts as a pair for any other grey.
 */
function findUnpaired(pattern: RegExp, darkPrefix: string): string[] {
  const greys = new Set(GREY.split('|'));
  const hits: string[] = [];

  for (const file of FILES) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(pattern)) {
        const family = m[3];
        const accepted = greys.has(family) ? [...greys].join('|') : family;
        if (new RegExp(`${darkPrefix}-(?:${accepted})-`).test(line)) continue;
        hits.push(`${path.relative(ROOT, file)}:${i + 1}  ${m[1]}`);
      }
    });
  }
  return hits;
}

describe('dark mode is not optional', () => {
  it('never leaves dark text without a light counterpart', () => {
    // text-slate-800 on an adaptive surface is invisible once the page goes
    // dark. Variant-prefixed tokens (hover:, focus:) are left out: they need
    // dark:hover:, and a wrong one tints a control permanently.
    const unpaired = findUnpaired(
      new RegExp(`(?<![:\\w-])((text-(${SEMANTIC}|${GREY})-(700|800|900)))\\b`, 'g'),
      'dark:text',
    );

    expect(unpaired, `add a dark: variant:\n${unpaired.slice(0, 25).join('\n')}`).toEqual([]);
  });

  it('never leaves a light background without a dark counterpart', () => {
    // Otherwise the tile stays bright while everything around it goes dark,
    // which is what "the colours clash" actually looks like.
    const unpaired = findUnpaired(
      new RegExp(`(?<![:\\w-])((bg-(${SEMANTIC}|${GREY})-(50|100)))\\b(?!\\/)`, 'g'),
      'dark:bg',
    );

    expect(unpaired, `add a dark: variant:\n${unpaired.slice(0, 25).join('\n')}`).toEqual([]);
  });

  it('never leaves a pale border without a dark counterpart', () => {
    const unpaired = findUnpaired(
      new RegExp(`(?<![:\\w-])((border-(${SEMANTIC}|${GREY})-(100|200|300)))\\b(?!\\/)`, 'g'),
      'dark:border',
    );

    expect(unpaired, `add a dark: variant:\n${unpaired.slice(0, 25).join('\n')}`).toEqual([]);
  });
});

describe('no class list contradicts itself', () => {
  it('declares each property at most once per theme', () => {
    // Two dark: backgrounds in one class list means whichever Tailwind emits
    // last silently wins — the kind of thing that looks fine until it does not.
    const conflicts: string[] = [];
    const looksLikeClassList = (s: string) =>
      s.trim().length > 0 &&
      /^[\sA-Za-z0-9:_/[\].\-%#()]+$/.test(s) &&
      /(?:text|bg|border)-[a-z]+-[0-9]/.test(s);

    for (const file of FILES) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/"([^"]*)"|'([^']*)'/g)) {
          const seg = m[1] ?? m[2];
          if (!seg || !looksLikeClassList(seg)) continue;
          for (const prop of ['text', 'bg', 'border']) {
            const found = [...seg.matchAll(new RegExp(`(?<![\\w-])dark:${prop}-[a-z]+-[0-9]+`, 'g'))];
            if (found.length > 1) {
              conflicts.push(`${path.relative(ROOT, file)}:${i + 1}  ${found.map((f) => f[0]).join(' + ')}`);
            }
          }
        }
      });
    }

    expect(conflicts, `pick one:\n${conflicts.slice(0, 25).join('\n')}`).toEqual([]);
  });
});
