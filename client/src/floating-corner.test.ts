import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { CORNER, CORNER_PANEL, cornerSlot } from "@/lib/floatingCorner";

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
});
