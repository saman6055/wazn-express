import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * One name per weight, everywhere.
 *
 * The same two numbers appear on Quick Register, bulk register, the parcels
 * list and the customer's portal, and each screen had picked its own words.
 * The scale weight was "کێشی ڕاستەقینە" in one place; the charged weight was
 * "کێشی کڕێیی" on one screen and "کێشی حسابکراو" on the next.
 *
 * A warehouse employee then tells a customer "کێشی کڕێیی is 5 kg" and the
 * customer, looking at their own screen, cannot find that phrase anywhere.
 * The words are the same three now, and this keeps them that way.
 */

const LOCALES = path.resolve(__dirname, "locales");

function load(lang: string): Record<string, any> {
  const raw = fs.readFileSync(path.join(LOCALES, `${lang}.json`), "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

const LANGS = ["ku", "en", "ar", "zh"] as const;

/** The three weights, and the one word each is allowed. */
const WEIGHT_WORDS: Record<string, Record<string, string>> = {
  actualWeight: { ku: "کێشی خۆی", en: "Actual weight", ar: "الوزن الفعلي", zh: "实际重量" },
  volumetricWeight: { ku: "کێشی قەبارەیی", en: "Volumetric weight", ar: "الوزن الحجمي", zh: "体积重" },
  chargeableWeight: { ku: "کێشی حیسابکراو", en: "Chargeable weight", ar: "الوزن المحتسب", zh: "计费重量" },
};

describe("every weight has one name", () => {
  it("the parcels vocabulary says what the owner says", () => {
    for (const [key, words] of Object.entries(WEIGHT_WORDS)) {
      for (const lang of LANGS) {
        expect(load(lang).packages?.[key], `packages.${key} in ${lang}`).toBe(words[lang]);
      }
    }
  });

  it("Quick Register does not invent its own", () => {
    // It used to say "کێشی کڕێیی" for the charged weight — a phrase that
    // appears on no other screen and in no invoice.
    for (const lang of LANGS) {
      const quick = load(lang).quickRegister;
      if (quick?.chargeableWeight) {
        expect(quick.chargeableWeight, `quickRegister.chargeableWeight in ${lang}`)
          .toBe(WEIGHT_WORDS.chargeableWeight[lang]);
      }
      if (quick?.volumetricWeight) {
        expect(quick.volumetricWeight, `quickRegister.volumetricWeight in ${lang}`)
          .toBe(WEIGHT_WORDS.volumetricWeight[lang]);
      }
    }
  });

  it("no locale still carries the old wordings", () => {
    const retired = ["کێشی کڕێیی", "کێشی حسابکراو", "کێشی ڕاستەقینە", "کێشی خۆیی"];
    const offenders: string[] = [];
    for (const lang of LANGS) {
      const flat = JSON.stringify(load(lang));
      for (const word of retired) {
        if (flat.includes(word)) offenders.push(`${lang}.json still says "${word}"`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

describe("the charged weight is not announced twice", () => {
  it("Quick Register shows one figure with its own name", () => {
    // The readout used to print the volumetric weight, then the same or the
    // actual weight again beside it under the label "chargeable" — three
    // numbers for one answer, which is what made it unreadable.
    const src = fs
      .readFileSync(path.resolve(__dirname, "pages/QuickRegister.tsx"), "utf8")
      .replace(/\r\n/g, "\n");
    const start = src.indexOf("{/* The weight this parcel is charged on.");
    expect(start, "weight readout not found").toBeGreaterThan(-1);
    const block = src.slice(start, start + 3000);

    // It names which weight won, rather than labelling anything "chargeable".
    expect(block).toContain("packages.volumetricWeight");
    expect(block).toContain("packages.actualWeight");
    expect(block).not.toContain("chargeableWeight\")");
  });
});
