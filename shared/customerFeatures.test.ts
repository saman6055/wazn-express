import { describe, it, expect } from "vitest";
import { FEATURES, featureDefinition, hasFeature, isKnownFeature } from "./customerFeatures";

describe("the catalogue", () => {
  it("has no duplicate ids", () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("describes every feature in every language", () => {
    // The person granting this is choosing what a customer will see. A blank
    // description makes that a guess.
    for (const feature of FEATURES) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(feature.name[lang], `${feature.id} has no ${lang} name`).toBeTruthy();
        expect(feature.description[lang], `${feature.id} has no ${lang} description`).toBeTruthy();
      }
    }
  });

  it("recognises its own ids and nothing else", () => {
    expect(isKnownFeature("finance_detail")).toBe(true);
    expect(isKnownFeature("something_invented")).toBe(false);
    expect(featureDefinition("something_invented")).toBeUndefined();
  });
});

describe("holding a feature", () => {
  it("is true only when it was granted", () => {
    expect(hasFeature(["finance_detail"], "finance_detail")).toBe(true);
    expect(hasFeature([], "finance_detail")).toBe(false);
    expect(hasFeature(["something_else"], "finance_detail")).toBe(false);
  });

  it("answers no while the list is still loading", () => {
    // The safe direction. A tab that appears a moment late is better than one
    // that appears and then fails.
    expect(hasFeature(null, "finance_detail")).toBe(false);
    expect(hasFeature(undefined, "finance_detail")).toBe(false);
  });

  it("is not fooled by something that is not a list", () => {
    expect(hasFeature("finance_detail" as unknown as string[], "finance_detail")).toBe(false);
  });
});
