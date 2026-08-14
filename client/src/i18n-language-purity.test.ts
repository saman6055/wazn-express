import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Each language says what it says in its own script.
 *
 * The system speaks four, and the seams showed: the Chinese file carried
 * seventy lines of Kurdish, the Kurdish file carried an Arabic placeholder
 * and a screen of English, and an English label had the dinar symbol د.ع
 * sitting in the middle of it. None of it breaks anything — it just tells a
 * customer, quietly, that their language was an afterthought.
 *
 * Two places can go wrong, so both are checked: the four locale files, and
 * the four-language objects written inline in the source.
 */

const LOCALES = path.resolve(__dirname, "locales");

/** Arabic script — used by Kurdish and Arabic, never by English or Chinese. */
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
/** Han characters and the full-width punctuation that comes with them. */
const CJK = /[㐀-䶿一-鿿　-〿＀-￯]/;
/** Letters Kurdish has and Arabic does not, so Kurdish in an Arabic string shows. */
const KURDISH_ONLY = /[ێۆڵڕ]/; // ێ ۆ ڵ ڕ
const LATIN_WORD = /[A-Za-z]{4,}/;

/**
 * Words that are the same in every language: our own name, other companies',
 * a file format, and a phone-number shape.
 *
 * Short and reasoned on purpose. Anything added here without a reason is a
 * translation that was skipped and then excused.
 */
const SAME_EVERYWHERE = new Set([
  "common.appName",
  "auto.text_4904bd",
  "auto.text_6fcd11",
  "auto.text_e85527",
  "suppliers.whatsapp",
  "profitReport.excel",
  "delivery.phonePlaceholder",
]);

type Lang = "ku" | "en" | "ar" | "zh";
const LANGS: Lang[] = ["ku", "en", "ar", "zh"];

function loadLocale(lang: Lang): Record<string, string> {
  const raw = fs.readFileSync(path.join(LOCALES, `${lang}.json`), "utf8");
  const data = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  const out: Record<string, string> = {};
  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v as Record<string, unknown>, key);
      else if (typeof v === "string") out[key] = v;
    }
  };
  walk(data);
  return out;
}

const L: Record<Lang, Record<string, string>> = {
  ku: loadLocale("ku"),
  en: loadLocale("en"),
  ar: loadLocale("ar"),
  zh: loadLocale("zh"),
};

/** Why this value does not belong in this language, or null if it does. */
function wrongScript(lang: Lang, value: string): string | null {
  if (lang === "en" && ARABIC.test(value)) return "Arabic script in English";
  if (lang === "en" && CJK.test(value)) return "Chinese in English";
  if (lang === "zh" && ARABIC.test(value)) return "Arabic script in Chinese";
  if (lang === "ar" && CJK.test(value)) return "Chinese in Arabic";
  if (lang === "ar" && KURDISH_ONLY.test(value)) return "Kurdish letters in Arabic";
  if (lang === "ku" && CJK.test(value)) return "Chinese in Kurdish";
  return null;
}

describe("the files this is checking", () => {
  it("found all four", () => {
    for (const lang of LANGS) {
      expect(Object.keys(L[lang]).length, lang).toBeGreaterThan(1000);
    }
  });
});

describe("every locale file speaks its own language", () => {
  it("no string is in the wrong script", () => {
    const offenders: string[] = [];
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(L[lang])) {
        const why = wrongScript(lang, value);
        if (why) offenders.push(`${lang}.json  ${key}  — ${why}: ${value.slice(0, 60)}`);
      }
    }
    expect(offenders, `translate these:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no string is still the English one", () => {
    // A value byte-identical to English, containing English words, is a
    // translation that never happened — unless it is a name.
    const offenders: string[] = [];
    for (const lang of ["ku", "ar", "zh"] as Lang[]) {
      for (const [key, value] of Object.entries(L[lang])) {
        if (SAME_EVERYWHERE.has(key)) continue;
        if (L.en[key] === value && LATIN_WORD.test(value)) {
          offenders.push(`${lang}.json  ${key} = ${value.slice(0, 60)}`);
        }
      }
    }
    expect(offenders, `translate these, or name them in SAME_EVERYWHERE:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every allowance is still a real key", () => {
    const stale = [...SAME_EVERYWHERE].filter((k) => !(k in L.en));
    expect(stale, `these allowances are for keys that are gone:\n${stale.join("\n")}`).toEqual([]);
  });
});

describe("the four-language objects written in the source", () => {
  const ROOTS = [
    path.resolve(__dirname),
    path.resolve(__dirname, "../../server"),
    path.resolve(__dirname, "../../shared"),
  ];

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "locales", "dist"].includes(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(p, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }

  const FILES = ROOTS.flatMap((r) => sourceFiles(r));
  const ENTRY = /\b(ku|en|ar|zh)\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  it("covers the whole codebase", () => {
    expect(FILES.length).toBeGreaterThan(200);
  });

  it("no inline label is in the wrong script", () => {
    // `pickLang(language, { ku: …, en: …, ar: …, zh: … })` is where most
    // labels live now, and it is just as easy to paste Kurdish into the
    // Chinese slot there as in a locale file.
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        ENTRY.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = ENTRY.exec(line))) {
          const why = wrongScript(m[1] as Lang, m[2]);
          if (why) {
            const rel = path.relative(path.resolve(__dirname, "../.."), file).replace(/\\/g, "/");
            offenders.push(`${rel}:${i + 1} — ${why}: ${m[2].slice(0, 50)}`);
          }
        }
      });
    }
    expect(offenders, `translate these:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("the name of the service is the one the office uses", () => {
  it("nothing says 'full package' in transliterated English", () => {
    // The office calls it پاکێجی تەواو. Half the system said فول پاکێج,
    // which is the English words written in Kurdish letters.
    const offenders: string[] = [];
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(L[lang])) {
        if (/فول\s*پاک|فوڵ\s*پاک/.test(value)) offenders.push(`${lang}.json  ${key} = ${value}`);
      }
    }
    expect(offenders, `use پاکێجی تەواو:\n${offenders.join("\n")}`).toEqual([]);
  });
});
