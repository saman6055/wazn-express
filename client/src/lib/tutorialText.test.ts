import { describe, it, expect } from "vitest";
import { tutorialTitle, tutorialSummary } from "./tutorialText";

/**
 * A tutorial reaches only the portal set to the language it is spoken in, so
 * for almost every video there is one title and no choice to make. These tests
 * pin down the two places that can still go wrong: a video that was switched
 * between languages, and the speechless videos that really do appear
 * everywhere.
 */
describe("tutorialTitle", () => {
  const arabicVideo = {
    language: "ar",
    titleKu: "كيف أسجل رقم التتبع",
    titleEn: "",
    titleAr: "",
  };

  it("shows a single-language video's own title, whatever the portal language", () => {
    // The customer only ever reaches this video from the Arabic portal, but a
    // stale English column must never win if one is left behind.
    expect(tutorialTitle(arabicVideo, "ar")).toBe("كيف أسجل رقم التتبع");
    expect(tutorialTitle(arabicVideo, "en")).toBe("كيف أسجل رقم التتبع");
    expect(tutorialTitle(arabicVideo, "ku")).toBe("كيف أسجل رقم التتبع");
  });

  it("ignores translations left over from when the video was marked for every portal", () => {
    const switched = { language: "ku", titleKu: "چۆن تراک تۆمار بکەم", titleEn: "Old English title", titleAr: "عنوان قديم" };
    expect(tutorialTitle(switched, "en")).toBe("چۆن تراک تۆمار بکەم");
    expect(tutorialTitle(switched, "ar")).toBe("چۆن تراک تۆمار بکەم");
  });

  const silentVideo = {
    language: "all",
    titleKu: "وێنەی پاکەت",
    titleEn: "Package photo",
    titleAr: "صورة الطرد",
  };

  it("picks the reader's language for a video with no speech", () => {
    expect(tutorialTitle(silentVideo, "ku")).toBe("وێنەی پاکەت");
    expect(tutorialTitle(silentVideo, "en")).toBe("Package photo");
    expect(tutorialTitle(silentVideo, "ar")).toBe("صورة الطرد");
  });

  it("falls back to the Kurdish column when a translation was never filled in", () => {
    const partial = { language: "all", titleKu: "وێنەی پاکەت", titleEn: "", titleAr: null };
    expect(tutorialTitle(partial, "en")).toBe("وێنەی پاکەت");
    expect(tutorialTitle(partial, "ar")).toBe("وێنەی پاکەت");
  });

  it("falls back for Chinese, which has no column of its own", () => {
    expect(tutorialTitle(silentVideo, "zh")).toBe("وێنەی پاکەت");
  });

  it("returns an empty string rather than undefined when nothing is set", () => {
    expect(tutorialTitle({ language: "ku" }, "ku")).toBe("");
    expect(tutorialTitle({ language: "all", titleKu: null }, "en")).toBe("");
  });
});

describe("tutorialSummary", () => {
  it("follows the same rule as the title", () => {
    const single = { language: "en", summaryKu: "Paste the tracking number here", summaryEn: "", summaryAr: "" };
    expect(tutorialSummary(single, "ku")).toBe("Paste the tracking number here");

    const silent = { language: "all", summaryKu: "بێ دەنگ", summaryEn: "No narration", summaryAr: "بدون صوت" };
    expect(tutorialSummary(silent, "en")).toBe("No narration");
    expect(tutorialSummary(silent, "ar")).toBe("بدون صوت");
  });

  it("is empty when the owner left the summary blank", () => {
    expect(tutorialSummary({ language: "ku", summaryKu: "" }, "ku")).toBe("");
  });
});
