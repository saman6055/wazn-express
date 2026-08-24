import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { CATEGORY_ICON_KEYS } from "./categoryIcons";

/**
 * The icon keys are stored in the database, so this list is not free to move.
 *
 * A category made last year holds the string "wrench"; drop that key and the
 * category loses its picture. Renaming one needs a migration, and removing
 * one needs the fallback to keep the layout whole.
 */
describe("the icons a category can carry", () => {
  const src = fs.readFileSync(path.join(__dirname, "categoryIcons.tsx"), "utf8");

  it("offers more than the seven it started with", () => {
    // A freight company had a choice of "building" or "other" for customs,
    // fuel, meals and flights, so every category wore the same receipt.
    expect(CATEGORY_ICON_KEYS.length).toBeGreaterThanOrEqual(24);
  });

  it("keeps every key that categories already in the database use", () => {
    // The original seven. A category created before today still holds one of
    // these, and dropping one silently blanks its icon.
    for (const key of ["building", "users", "zap", "truck", "phone", "wrench", "receipt"]) {
      expect(CATEGORY_ICON_KEYS as readonly string[], `${key} would orphan existing categories`)
        .toContain(key);
    }
  });

  it("draws every key it offers", () => {
    // A key in the picker with no drawing renders the fallback, so the
    // chosen icon and the shown icon disagree.
    for (const key of CATEGORY_ICON_KEYS) {
      expect(src, `${key} is offered but never drawn`).toContain(`  ${key}: (c) =>`);
    }
  });

  it("has no duplicate keys", () => {
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length);
  });

  it("falls back rather than leaving a hole", () => {
    expect(src).toContain('ICONS[key ?? ""] ?? ICONS.receipt');
  });
});
