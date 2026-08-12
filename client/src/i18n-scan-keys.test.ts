import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every scanner screen went to production showing raw keys — the pages used
 * ~70 `scan.*` keys that existed in NO locale file, and nothing failed. The
 * staff saw `scan.selectBatch` where "باچ هەڵبژێرە" should be, in all four
 * languages, and the batch-assignment page was unusable.
 *
 * This test extracts every literal `t("scan.xxx")` / `t("scanning.xxx")`
 * call from the client source and asserts the key exists in all four locale
 * files, so a new scanner string can't ship untranslated again.
 */

const SRC = path.join(__dirname);
const LOCALES = ["ku", "en", "ar", "zh"] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

function usedScanKeys(): Map<string, string> {
  // key -> first file it appears in (for a readable failure message)
  const used = new Map<string, string>();
  for (const file of walk(SRC)) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"((?:scan|scanning)\.[a-zA-Z0-9_]+)"/g)) {
      if (!used.has(m[1])) used.set(m[1], path.relative(SRC, file));
    }
  }
  return used;
}

describe("scanner translation keys", () => {
  const used = usedScanKeys();

  it("finds the scanner keys at all (guard against a silent-no-match regex)", () => {
    // If refactoring ever changes how t() is called and the regex stops
    // matching, this fails loudly instead of the main test passing on an
    // empty set — the same trap test-slice-markers warns about.
    expect(used.size).toBeGreaterThan(50);
  });

  for (const lang of LOCALES) {
    it(`every scan/scanning key used in code exists in ${lang}.json`, () => {
      const raw = fs.readFileSync(path.join(SRC, "locales", `${lang}.json`), "utf8");
      const locale = JSON.parse(raw.replace(/^﻿/, ""));
      const missing = [...used.entries()]
        .filter(([key]) => {
          const [ns, leaf] = key.split(".");
          return !(locale[ns] && Object.prototype.hasOwnProperty.call(locale[ns], leaf));
        })
        .map(([key, file]) => `${key} (used in ${file})`);
      expect(missing, `keys missing from ${lang}.json`).toEqual([]);
    });
  }
});
