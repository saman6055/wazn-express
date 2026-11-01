import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The portal is sold in four languages and was written in two.
 *
 * `pickLang(language, { ku, en, ar, zh })` is type-enforced: leave one out and
 * it will not compile. The old shape — `language === "ku" ? "…" : "…"` — is
 * not, and there is no way to tell by reading it that Arabic and Chinese were
 * simply never written. So an Arabic customer, on the portal that is the
 * company's main marketing surface, read Kurdish labels in an English
 * sentence, and nothing anywhere reported it.
 *
 * This test bans the shape rather than counting the gaps. The count was 79 at
 * the point it reached zero, and a count would have let the next one in.
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

describe("no customer reads a language the portal only half speaks", () => {
  it("covers the whole portal", () => {
    // A guard that silently walks an empty directory proves nothing.
    expect(FILES.length).toBeGreaterThan(30);
  });

  /**
   * A whole ternary chain on `language`, however long:
   *
   *   language === "ku" ? "…" : language === "ar" ? "…" : "…"
   *
   * The chain is matched entire rather than one link at a time, because the
   * tail of a correct four-language chain looks exactly like a broken
   * two-language one when read on its own.
   *
   * Three tested languages is complete — the fourth is the final else.
   */
  const Q = String.fromCharCode(34);
  const STR = `${Q}[^${Q}]*${Q}`;
  const TEST = `language === ${Q}(?:ku|ar|zh|en)${Q}\\s*\\?\\s*${STR}\\s*:\\s*`;
  const CHAIN = new RegExp(`${TEST}(?:${TEST})*${STR}`, "g");
  const LANG_OF = new RegExp(`language === ${Q}(ku|ar|zh|en)${Q}`, "g");

  /**
   * `language === "zh" ? "zh-CN" : "en-GB"` is not a label — it is an Intl
   * locale tag, and two branches is the whole of it.
   */
  const LOCALE_TAGS = new RegExp(`\\?\\s*${Q}[a-z]{2}(?:-[A-Za-z]{2,4})?${Q}\\s*:\\s*${Q}[a-z]{2}(?:-[A-Za-z]{2,4})?${Q}`);

  /**
   * Nor is `dir="rtl" : "ltr"`. Text direction genuinely has two values, and
   * Kurdish and Arabic share one of them.
   */
  const DIRECTION = new RegExp(`${Q}(?:rtl|ltr)${Q}\\s*:\\s*${Q}(?:rtl|ltr)${Q}`);

  const incomplete = (src: string): string[] =>
    (src.match(CHAIN) ?? []).filter((chain) => {
      if (LOCALE_TAGS.test(chain) || DIRECTION.test(chain)) return false;
      const langs = new Set((chain.match(LANG_OF) ?? []).map((m) => m.slice(-3, -1)));
      return langs.size < 3;
    });

  for (const file of FILES) {
    const rel = path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/");
    const src = fs.readFileSync(file, "utf8");

    it(`${rel} uses pickLang, not a two-way ternary`, () => {
      const hits = incomplete(src);
      expect(
        hits,
        hits.length
          ? `${hits.length} label(s) exist in only two languages, e.g. ${hits[0].slice(0, 80)}`
          : "",
      ).toEqual([]);
    });
  }

  /**
   * The second dialect of the same bug, and the one that hid longest:
   *
   *   { value: "all", label: "All Time", labelKu: "هەموو کات" }
   *   …
   *   {language === "ku" ? filter.labelKu : filter.label}
   *
   * The ternary reads field names rather than string literals, so the chain
   * check above walks straight past it, and the object looks translated
   * because it has a `labelKu` in it. It shipped "All Time / This Month /
   * This Year" in English on a page that was otherwise fully Chinese.
   *
   * Any `xxxKu`/`xxxAr` field must be accompanied by its `xxxZh` sibling.
   */
  it("parallel label fields carry all four languages", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      const bases = new Set<string>();
      for (const m of src.matchAll(/\b([a-z][A-Za-z0-9]*)(Ku|Ar)\s*:/g)) bases.add(m[1]);
      for (const base of bases) {
        // `titleKu`/`messageKu` on notification rows are server columns being
        // read, not label objects being declared; they are covered by the
        // server-side guard instead.
        if (!new RegExp(`\\b${base}Zh\\s*:`).test(src)) {
          offenders.push(`${path.basename(file)}: ${base}Ku/${base}Ar exists but ${base}Zh does not`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * And the ternary that reads them. Even with all four fields present,
   * `language === "ku" ? x.labelKu : x.label` still drops two of them.
   */
  it("parallel label fields are read through pickLang", () => {
    const offenders: string[] = [];
    const BAD = /language === "(?:ku|ar|zh|en)"\s*\?\s*[\w.]+\s*:/g;
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(BAD)) {
        const tail = src.slice(m.index, m.index + 220);
        // A chain that goes on to test the other languages is fine.
        const langs = new Set((tail.match(/language === "(ku|ar|zh|en)"/g) ?? []).map((s) => s.slice(-3, -1)));
        if (langs.size < 3) offenders.push(`${path.basename(file)}: ${tail.split("\n")[0].trim().slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * pickLang's own type would catch a missing key at compile time, but only
   * for callers that pass an object literal. This catches the other way a
   * language goes missing: an empty string, which reads as "translated" to
   * every tool and renders as nothing to the customer.
   */
  it("no language is filled in with an empty string", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/pickLang\([^)]*?\b(ku|en|ar|zh):\s*""/g)) {
        offenders.push(`${path.basename(file)}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
