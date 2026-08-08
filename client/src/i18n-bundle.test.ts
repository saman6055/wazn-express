import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Nothing may statically import a locale file.
 *
 * The four translation files are about 1 MB of JSON. While anything imported
 * them at the top level they were welded into the entry chunk, and every
 * visitor — on an Iraqi mobile connection, before a single pixel — downloaded
 * all four, three of them a language they will never read.
 *
 * That is easy to reintroduce by accident and invisible when you do: the app
 * works perfectly, it is just slower for everyone forever. It happened once
 * already, in ErrorBoundary, for six strings — and it silently defeated the
 * dynamic loader until it was found.
 *
 * Measured at the time of writing: entry chunk 454 KB gzip → 213 KB, with the
 * reader's own locale adding ~64 KB. Roughly 180 KB off every first load.
 */

const SRC = path.resolve(__dirname);
const ALLOWED = new Set(["lib/i18nRegistry.ts"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "locales") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("translation files are loaded on demand", () => {
  it("nobody imports a locale at the top level", () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => !ALLOWED.has(path.relative(SRC, f).replace(/\\/g, "/")))
      .filter((f) => /^\s*import\s[^;]*locales\//m.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"));

    expect(
      offenders,
      `these pin ~1MB of JSON into the entry chunk — use loadLocale from lib/i18nRegistry, or inline the few strings you need:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the loader fetches each language separately", () => {
    const src = fs.readFileSync(path.join(SRC, "lib/i18nRegistry.ts"), "utf8");
    for (const lang of ["ku", "en", "ar", "zh"]) {
      expect(src, `${lang} must be a dynamic import`).toContain(`import("../locales/${lang}.json")`);
    }
  });

  it("the error screen does not depend on a download", () => {
    // It is the screen that runs when something has already failed; it must
    // not need a translation file to have arrived.
    const src = fs.readFileSync(path.join(SRC, "components/ErrorBoundary.tsx"), "utf8");
    expect(src).not.toContain("locales/");
    expect(src).toContain("ERROR_STRINGS");
    for (const lang of ["ku", "en", "ar", "zh"]) {
      expect(src, `${lang} strings must be inline`).toMatch(new RegExp(`\\b${lang}:\\s*\\{`));
    }
  });
});
