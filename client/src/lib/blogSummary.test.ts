import { describe, it, expect } from "vitest";
import { postSummary } from "./blogLang";
describe("postSummary", () => {
  it("does not repeat the title when the content starts with it", () => {
    const post = { titleKu: "داشکاندنی نوێ", contentKu: "## داشکاندنی نوێ\nئەم هەفتەیە بارکردن هەرزانترە." };
    expect(postSummary(post, "ku")).toBe("ئەم هەفتەیە بارکردن هەرزانترە.");
  });
  it("skips a summary that only repeats the title", () => {
    const post = { titleKu: "هەواڵ", summaryKu: "هەواڵ", contentKu: "هەواڵ: ناوەڕۆک" };
    expect(postSummary(post, "ku")).toBe("ناوەڕۆک");
  });
  it("keeps a real summary", () => {
    expect(postSummary({ titleKu: "A", summaryKu: "B text" }, "ku")).toBe("B text");
  });
});
