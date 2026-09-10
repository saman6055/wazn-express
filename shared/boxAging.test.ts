import { describe, it, expect } from "vitest";
import { BOX_UNPAID_ALERT_DAYS, boxAgeDays, isBoxOld, boxOldCutoff } from "./boxAging";

const NOW = new Date("2026-09-10T12:00:00Z");
const DAY = 86_400_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("when an unpaid box counts as old", () => {
  it("is the owner's five days", () => {
    expect(BOX_UNPAID_ALERT_DAYS).toBe(5);
  });

  it("counts whole days", () => {
    expect(boxAgeDays(ago(0), NOW)).toBe(0);
    expect(boxAgeDays(ago(5.9 * DAY), NOW)).toBe(5);
    expect(boxAgeDays(ago(6 * DAY), NOW)).toBe(6);
    expect(boxAgeDays(ago(-DAY), NOW)).toBe(0);
  });

  it("the badge's rule and the chip's cutoff name the same boxes, edges included", () => {
    for (const age of [0, 5 * DAY, 6 * DAY - 1, 6 * DAY, 6 * DAY + 1, 53 * DAY]) {
      const created = ago(age);
      expect(isBoxOld(created, NOW), `age ${age / DAY} days`).toBe(created.getTime() <= boxOldCutoff(NOW).getTime());
    }
  });
});
