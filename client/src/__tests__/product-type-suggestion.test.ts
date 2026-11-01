import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's ask (Sep 2026): «کاتێ من وێنەم دانا سیستەم بە خۆی بزانێ
 * جۆرەکەی چیە و هەڵیبژێرێت» — put a photo in, and the product type fills
 * itself.
 *
 * A field that fills itself wrongly is worse than one that stays empty, so
 * what these pin is mostly what the feature REFUSES to do: overwrite a
 * person's choice, answer with a category the office does not have, guess
 * when unsure, or make any noise when there is no AI configured at all.
 */

const SRC = path.resolve(__dirname);
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const readRoot = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const FORMS = ["pages/CommissionForm.tsx", "pages/FullPackageForm.tsx"];

describe("it never overwrites a person", () => {
  const hook = read("hooks/useProductTypeSuggestion.ts");

  it("an already-filled field is left alone before the call is even made", () => {
    expect(hook).toContain("if (!imageUrl || current.trim()) return;");
  });

  it("and again at the moment of applying, in case a hand got there first", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("(prev) => (prev.productType ? prev : { ...prev, productType: value })");
    }
  });

  it("the same photo is only asked about once", () => {
    expect(hook).toContain("if (asked.current === imageUrl) return;");
  });
});

describe("it abstains rather than guesses", () => {
  const hook = read("hooks/useProductTypeSuggestion.ts");
  const service = readRoot("server/services/productTypeVision.ts");

  it("a low-confidence answer is dropped", () => {
    expect(hook).toContain("export const MIN_CONFIDENCE = 60;");
    expect(hook).toContain("result.confidence >= MIN_CONFIDENCE");
  });

  it("the model is told abstaining is the better answer", () => {
    expect(service).toContain("Abstaining is better than guessing");
    expect(service).toContain("An empty string is the right answer");
  });

  it("an answer that is not one of the office's own types is discarded", () => {
    expect(service).toContain("const match = choices.find((c) => c.toLowerCase() === answer.toLowerCase());");
    expect(service).toContain("if (!match) {");
  });

  it("the office's list is read on the server, not sent by the browser", () => {
    const router = readRoot("server/routers/productAttributes.router.ts");
    const endpoint = router.slice(router.indexOf("suggestType: staffProcedure"), router.indexOf("// Create a new attribute"));
    expect(endpoint).toContain('getProductAttributesByType("productType")');
    // A caller must not be able to widen the choices.
    expect(endpoint).not.toContain("options: z.array");
  });
});

describe("it never gets in the way", () => {
  const hook = read("hooks/useProductTypeSuggestion.ts");
  const service = readRoot("server/services/productTypeVision.ts");

  it("a failure is silent — no toast on every photo in an office with no AI key", () => {
    expect(hook).toContain("} catch {");
    expect(hook).not.toContain("toast.error");
    expect(service).toContain("return NO_GUESS;");
    expect(service).not.toContain("throw ");
  });

  it("the form is not awaited on", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("void typeGuess.suggest(");
    }
  });

  it("the photo is read at low detail, since naming a shoe needs no more", () => {
    expect(service).toContain('detail: "low"');
  });
});

describe("a guess is visibly a guess", () => {
  it("both forms say the photo is being read, and that it chose", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("typeGuess.suggesting");
      expect(src, rel).toContain("typeGuess.wasSuggested");
      expect(src, rel).toContain("لە وێنەکەوە هەڵبژێردرا — دڵنیابەرەوە");
    }
  });

  it("the mark goes the moment a person picks for themselves", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("typeGuess.clearSuggestionMark();");
    }
  });

  it("the next order asks again about its own first photo", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("typeGuess.forgetAskedPhoto();");
    }
  });
});
