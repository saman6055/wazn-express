import { describe, it, expect } from "vitest";
import { termsSections, termsPartyLabel, type TermsSection } from "./portalTerms";

/**
 * The terms were rewritten so that each thing asked of the customer sits
 * beside a matching commitment from the company. That balance is the point of
 * the page — a section that quietly drifts back to being a list of the
 * customer's obligations would undo it, and nothing in the type system stops
 * that. These tests do.
 */

/** "Who we are" is a description of the company, not a set of obligations. */
const DESCRIPTIVE_SECTIONS = ["who-we-are"];

const obligationSections = termsSections.filter((s) => !DESCRIPTIVE_SECTIONS.includes(s.id));

const languages = ["ku", "en", "ar", "zh"] as const;

describe("terms structure", () => {
  it("has every section the portal expects", () => {
    expect(termsSections.map((s) => s.id)).toEqual([
      "who-we-are",
      "mutual-commitments",
      "china-warehouse",
      "shipping-customs",
      "our-responsibility",
      "insurance",
      "prices-payment",
      "delivery-iraq",
      "prohibited-items",
      "buying-on-behalf",
      "privacy-legal",
    ]);
  });

  it("gives every section at least one point", () => {
    for (const section of termsSections) {
      expect(section.items.length, section.id).toBeGreaterThan(0);
    }
  });
});

describe("balance between the two sides", () => {
  it.each(obligationSections.map((s) => [s.id, s] as [string, TermsSection]))(
    "%s asks something of the customer and commits the company in return",
    (_id, section) => {
      const parties = new Set(section.items.map((i) => i.party));
      expect(parties.has("you")).toBe(true);
      expect(parties.has("us")).toBe(true);
    },
  );

  it("never lets one side outnumber the other by more than one in a section", () => {
    // Points are written as pairs, so a gap wider than one means a pair lost
    // its other half.
    for (const section of obligationSections) {
      const you = section.items.filter((i) => i.party === "you").length;
      const us = section.items.filter((i) => i.party === "us").length;
      expect(Math.abs(you - us), `${section.id}: ${you} "you" vs ${us} "us"`).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the two sides close to even across the whole page", () => {
    const all = termsSections.flatMap((s) => s.items);
    const you = all.filter((i) => i.party === "you").length;
    const us = all.filter((i) => i.party === "us").length;
    // "Who we are" is all company, so a small lean towards "us" is expected.
    expect(Math.abs(you - us)).toBeLessThanOrEqual(DESCRIPTIVE_SECTIONS.length + 3);
  });
});

describe("translations", () => {
  it("writes every point in all four languages", () => {
    for (const section of termsSections) {
      for (const [index, item] of section.items.entries()) {
        for (const lang of languages) {
          const text = item.text[lang];
          expect(text, `${section.id}[${index}].${lang}`).toBeTruthy();
          expect(text.trim().length, `${section.id}[${index}].${lang}`).toBeGreaterThan(10);
        }
      }
    }
  });

  it("titles every section in all four languages", () => {
    for (const section of termsSections) {
      for (const lang of languages) {
        expect(section.title[lang], `${section.id}.title.${lang}`).toBeTruthy();
      }
    }
  });

  it("labels both parties in all four languages", () => {
    for (const party of ["you", "us"] as const) {
      for (const lang of languages) {
        expect(termsPartyLabel[party][lang], `${party}.${lang}`).toBeTruthy();
      }
    }
  });
});

describe("tone", () => {
  const KURDISH_COMMANDS = [
    "لەسەر تۆیە",
    "دەبێت هەموو",
    "نابێت بنێریت",
  ];

  it("no longer uses the blunt phrasings the rewrite set out to remove", () => {
    const allKurdish = termsSections.flatMap((s) => s.items.map((i) => i.text.ku)).join("\n");
    for (const phrase of KURDISH_COMMANDS) {
      expect(allKurdish, `still contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it("states the compensation cap and the claim window exactly once each", () => {
    // Two contradictory deadlines is what the old page had; the numbers must
    // appear in one place only so they cannot drift apart again.
    const responsibility = termsSections.find((s) => s.id === "our-responsibility")!;
    const kurdish = responsibility.items.map((i) => i.text.ku);
    expect(kurdish.filter((t) => t.includes("٢٥ دۆلار")).length).toBe(1);
    expect(kurdish.filter((t) => t.includes("٧ ڕۆژ")).length).toBe(1);
  });

  it("uses one uncollected-goods deadline everywhere", () => {
    const all = termsSections.flatMap((s) => s.items.map((i) => i.text.ku)).join("\n");
    expect(all).toContain("٣٠ ڕۆژ");
    // The old delivery section said 7 days while payment said 30.
    expect(all).not.toContain("٧ ڕۆژ ئاگادارکردنەوە");
  });
});
