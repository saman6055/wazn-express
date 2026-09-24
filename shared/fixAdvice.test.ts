import { describe, expect, it } from "vitest";
import { hasFix, withFix } from "./fixAdvice";

/**
 * The owner, 2026-09-24: "when something is wrong, the notice should say the
 * reason and the proper steps to solve it. Can you do that for the whole
 * system? To me it is a very clever idea."
 *
 * The code that refuses always knows why it refused and what the person would
 * have to do; not saying so leaves them to guess, to ask somebody, or to find
 * a way around the rule.
 */

describe("a refusal with its cure", () => {
  it("is the cause, then numbered steps", () => {
    const text = withFix("ئەم تراکە پێشتر حیساب کراوە.", ["بۆکسەکە بکەرەوە", "پاکەتەکە دەربهێنە"]);
    expect(text).toContain("ئەم تراکە پێشتر حیساب کراوە.");
    expect(text).toContain("چۆن چارەسەری بکەیت:");
    expect(text).toContain("1. بۆکسەکە بکەرەوە");
    expect(text).toContain("2. پاکەتەکە دەربهێنە");
    // Real lines, so the alert window can print them as lines.
    expect(text.split("\n").length).toBeGreaterThan(3);
  });

  it("speaks the reader's language", () => {
    expect(withFix("Already charged.", ["Reopen the box"], "en")).toContain("How to fix it:\n1. Reopen the box");
    expect(withFix("محسوب مسبقاً.", ["أعد فتح الصندوق"], "ar")).toContain("كيف تحلّها:");
    expect(withFix("已计费。", ["重新打开箱子"], "zh")).toContain("如何解决：");
  });

  it("drops the steps that are not there, and says nothing extra with none", () => {
    expect(withFix("سەبارەت.", [null, "", "  ", "یەک هەنگاو"])).toContain("1. یەک هەنگاو");
    expect(withFix("سەبارەت.", [null, ""])).toBe("سەبارەت.");
  });

  it("can be recognised again", () => {
    expect(hasFix(withFix("a", ["b"]))).toBe(true);
    expect(hasFix("a plain refusal")).toBe(false);
  });
});
