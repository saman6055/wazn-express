import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { CORNER, CORNER_CLEARANCE, CORNER_PANEL, cornerSlot } from "@/lib/floatingCorner";

const ROOT = path.resolve(__dirname, "..", "..", "client", "src");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-27: «من وتم شوێنی نامە ناردن لەلای دەستی ڕاست دروست بکە
 * نەک چەپ — سەیرکە چۆن بەژێر کەوتووە.» Two mistakes at once: a logical edge
 * in a right-to-left page is the left, and two buttons asked for the same
 * corner and stood on each other.
 */
describe("the bottom-right corner", () => {
  it("is the right, not whichever side the language reads from", () => {
    // `end-4` is the left in an RTL page. A corner a thumb reaches for is a
    // physical place.
    expect(cornerSlot(CORNER.chat)).toContain("right-4");
    expect(cornerSlot(CORNER.chat)).not.toContain("end-");
    expect(CORNER_PANEL).toContain("right-4");
    expect(CORNER_PANEL).not.toContain("end-");
  });

  it("starts beside the sidebar rail, not on top of it", () => {
    // In Kurdish the rail is on the right and 80px wide on a desktop. On a
    // phone it is off-canvas, so the corner is the real corner.
    expect(cornerSlot(CORNER.chat)).toContain("md:right-24");
    expect(cornerSlot(CORNER.tips)).toContain("md:right-40");
    expect(CORNER_PANEL).toContain("md:right-24");
  });

  it("hands each button its own place", () => {
    expect(CORNER.chat).not.toBe(CORNER.tips);
    expect(cornerSlot(CORNER.chat)).not.toBe(cornerSlot(CORNER.tips));
    // Anything past the last slot lands back in the corner rather than
    // disappearing: four buttons in one corner is a design problem, and
    // hiding the fifth would only hide it.
    expect(cornerSlot(99)).toBe(cornerSlot(0));
  });

  it("is claimed through that one place, by both buttons", () => {
    const chat = read("components/chat/StaffChat.tsx");
    expect(chat).toContain("cornerSlot(CORNER.chat)");
    expect(chat).toContain("CORNER_PANEL");
    expect(chat).not.toContain("fixed bottom-4 end-4");

    const tips = read("components/StaffTips.tsx");
    expect(tips).toContain("cornerSlot(CORNER.tips)");
    expect(tips).not.toContain("fixed bottom-4 end-4");
  });

  it("opens its panel above the row, never across it", () => {
    // Measured in the harness at 900×640: the panel's bottom sits above the
    // buttons' tops, so it cannot cover the neighbour it opened beside.
    expect(CORNER_PANEL).toContain("bottom-20");
    expect(cornerSlot(0)).toContain("bottom-4");
  });

  /**
   * The owner, 2026-09-30, of the weight box on Quick Register's form bar
   * and the tips lamp: «کەوتوونەتە سەر یەک».
   */
  it("keeps room for itself on anything that reaches the foot of the window", () => {
    // Physical, because the corner is physical in both languages.
    expect(CORNER_CLEARANCE).toContain("pr-");
    expect(CORNER_CLEARANCE).not.toContain("pe-");

    /*
     * From `md` only. On a phone the row already sits above the tab bar, so
     * there is nothing to reserve — and reserving anyway wrapped the bar's
     * two buttons onto a second line, which made the bar tall enough to
     * reach up into the very buttons the reserve was for. Measured at 375px:
     * one row, 68px, with 12px between its top and the buttons' bottoms.
     */
    expect(CORNER_CLEARANCE.startsWith("md:")).toBe(true);

    // And the bar asks this module rather than guessing a figure of its own.
    const bar = read("components/forms/sticky-form-bar.tsx");
    expect(bar).toContain('import { CORNER_CLEARANCE } from "@/lib/floatingCorner";');
    expect(bar).toContain("CORNER_CLEARANCE)}");
    expect(bar).not.toMatch(/\bpr-\d/);
  });
});
