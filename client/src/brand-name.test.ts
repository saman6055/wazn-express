import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * One company name per language — the owner's decision, September 2026:
 *
 *   Kurdish   وەزن ئێکسپرێس
 *   Arabic    وزن اكسبريس
 *   English   Wazn Express   (Chinese writes it the same way)
 *
 * Before this the Kurdish locale spelled it three ways and the Arabic one
 * four, and the delivery receipt thanked customers on behalf of
 * «وازن ئێکسپرێس» — a name the company does not have. Any Arabic-script
 * spelling of the name, anywhere in the code, must now be one of the two.
 */

const KU = "وەزن ئێکسپرێس";
const AR = "وزن اكسبريس";

/** Arabic, Kurdish and Persian letters — not the harakat, not ، ؟ ؛ */
const LETTER = "[\\u0620-\\u064A\\u0671-\\u06D5]";
/** The name in Arabic script however it was spelled: وازن / وزن / وەزن + ئێکسپرێس / إكسبرس / … */
const NAME_ARABIC_SCRIPT = new RegExp(
  `(?<!${LETTER})(?:وازن|وەزن|وزن)\\s+[ئاإأ]${LETTER}*?[كک]س[بپ]${LETTER}*`,
  "g",
);
/** The Latin name — with a space, so the waznexpress.com domain is not a hit. */
const NAME_LATIN = /\bwazn\s+express\b/gi;

/**
 * The placeholder of the Arabic-name input in the invoice-template settings:
 * it shows the Arabic name whatever the interface language is.
 */
const ARABIC_NAME_PLACEHOLDER = "auto.text_e85527";

type Lang = "ku" | "en" | "ar" | "zh";

function loadLocale(lang: Lang): Record<string, string> {
  const raw = fs.readFileSync(path.resolve(__dirname, "locales", `${lang}.json`), "utf8");
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

function misspelt(lang: Lang, expected: (key: string) => string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(L[lang])) {
    for (const m of value.match(pattern) ?? []) {
      if (m !== expected(key)) out.push(`${lang}.json  ${key}  «${m}» should be «${expected(key)}»`);
    }
  }
  return out;
}

describe("the company name in the four locale files", () => {
  it("Kurdish writes it وەزن ئێکسپرێس", () => {
    const offenders = misspelt("ku", (key) => (key === ARABIC_NAME_PLACEHOLDER ? AR : KU), NAME_ARABIC_SCRIPT);
    expect(offenders, offenders.join("\n")).toEqual([]);
    expect(L.ku["common.appName"]).toBe(KU);
  });

  it("Arabic writes it وزن اكسبريس", () => {
    const offenders = misspelt("ar", () => AR, NAME_ARABIC_SCRIPT);
    expect(offenders, offenders.join("\n")).toEqual([]);
    expect(L.ar["common.appName"]).toBe(AR);
  });

  it("English and Chinese write it Wazn Express", () => {
    const offenders = [
      ...misspelt("en", () => "Wazn Express", NAME_LATIN),
      ...misspelt("zh", () => "Wazn Express", NAME_LATIN),
    ];
    expect(offenders, offenders.join("\n")).toEqual([]);
    expect(L.en["common.appName"]).toBe("Wazn Express");
    expect(L.zh["common.appName"]).toBe("Wazn Express");
  });

  it("a Kurdish or Arabic sentence never falls back to the Latin name", () => {
    const offenders: string[] = [];
    for (const lang of ["ku", "ar"] as Lang[]) {
      for (const [key, value] of Object.entries(L[lang])) {
        if (NAME_LATIN.test(value)) offenders.push(`${lang}.json  ${key} = ${value.slice(0, 60)}`);
        NAME_LATIN.lastIndex = 0;
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the receipt's thank-you line names the company correctly", () => {
    // The line the owner found printed «وازن» on a customer's receipt.
    expect(L.ku["delivery.thankYou"]).toContain(KU);
    expect(L.ar["delivery.thankYou"]).toContain(AR);
  });
});

describe("the company name written in the source", () => {
  const REPO = path.resolve(__dirname, "../..");
  const ROOTS = [path.resolve(__dirname), path.join(REPO, "server"), path.join(REPO, "shared")];

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "locales", "dist"].includes(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(p, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }

  it("is only ever one of the two spellings — defaults, SMS templates, PDFs, labels", () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const file of ROOTS.flatMap((r) => sourceFiles(r))) {
      const src = fs.readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        for (const m of line.match(NAME_ARABIC_SCRIPT) ?? []) {
          seen++;
          if (m !== KU && m !== AR) {
            offenders.push(`${path.relative(REPO, file).replace(/\\/g, "/")}:${i + 1}  «${m}»`);
          }
        }
      });
    }
    expect(seen, "the pattern found nothing — it has stopped matching").toBeGreaterThan(10);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
