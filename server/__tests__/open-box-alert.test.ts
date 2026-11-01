import { describe, it, expect } from "vitest";
import {
  selectStaleBoxes,
  buildReminderMessage,
  daysSince,
} from "./services/openBoxAlert.service";

const NOW = new Date("2026-08-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const box = (over: Partial<Record<string, unknown>> = {}) => ({
  status: "in_transit",
  customerConfirmedAt: null,
  inTransitAt: daysAgo(6),
  sealedAt: null,
  createdAt: daysAgo(9),
  ...over,
}) as any;

describe("daysSince", () => {
  it("counts whole days", () => {
    expect(daysSince(daysAgo(5), NOW)).toBe(5);
    expect(daysSince(daysAgo(0.5), NOW)).toBe(0);
  });

  it("treats a missing or unreadable date as no time passed", () => {
    expect(daysSince(null, NOW)).toBe(0);
    expect(daysSince(undefined, NOW)).toBe(0);
    expect(daysSince("not a date", NOW)).toBe(0);
  });

  it("does not go negative for a date in the future", () => {
    expect(daysSince(new Date(NOW.getTime() + 86_400_000), NOW)).toBe(0);
  });
});

/**
 * The whole value of this reminder is that it is usually right. One that fires
 * on boxes which are legitimately open gets ignored, and an ignored alert is
 * worse than no alert.
 */
describe("selectStaleBoxes", () => {
  it("reminds about a box that left five days ago", () => {
    const result = selectStaleBoxes([box({ inTransitAt: daysAgo(5) })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].step).toBe("first");
    expect(result[0].daysOpen).toBe(5);
  });

  it("stays quiet before five days", () => {
    expect(selectStaleBoxes([box({ inTransitAt: daysAgo(4) })], NOW)).toHaveLength(0);
    expect(selectStaleBoxes([box({ inTransitAt: daysAgo(0) })], NOW)).toHaveLength(0);
  });

  it("escalates once at ten days, then stops climbing", () => {
    expect(selectStaleBoxes([box({ inTransitAt: daysAgo(10) })], NOW)[0].step).toBe("second");
    expect(selectStaleBoxes([box({ inTransitAt: daysAgo(15) })], NOW)[0].step).toBe("second");
  });

  it("gives up after twenty days rather than nagging forever", () => {
    // By then the box has a problem a reminder cannot solve, and repeating it
    // every day is what teaches people to ignore the whole alert.
    expect(selectStaleBoxes([box({ inTransitAt: daysAgo(20) })], NOW)).toHaveLength(0);
    expect(selectStaleBoxes([box({ inTransitAt: daysAgo(90) })], NOW)).toHaveLength(0);
  });

  it("ignores a box the customer already confirmed", () => {
    // Their word is the answer the reminder was going to ask for.
    const confirmed = box({ inTransitAt: daysAgo(12), customerConfirmedAt: daysAgo(1) });
    expect(selectStaleBoxes([confirmed], NOW)).toHaveLength(0);
  });

  it("ignores a box that has not left yet", () => {
    // Still being packed is not late.
    expect(selectStaleBoxes([box({ status: "open", inTransitAt: daysAgo(30) })], NOW)).toHaveLength(0);
  });

  it("ignores boxes already closed or cancelled", () => {
    for (const status of ["delivered", "cancelled"]) {
      expect(selectStaleBoxes([box({ status, inTransitAt: daysAgo(9) })], NOW), status).toHaveLength(0);
    }
  });

  it("counts from when the box left, not when it was created", () => {
    // A box can sit half-packed for a fortnight without anything being late.
    const justLeft = box({ createdAt: daysAgo(14), sealedAt: daysAgo(13), inTransitAt: daysAgo(1) });
    expect(selectStaleBoxes([justLeft], NOW)).toHaveLength(0);
  });

  it("falls back through sealed, then created, when it never left", () => {
    const sealedOnly = box({ status: "ready", inTransitAt: null, sealedAt: daysAgo(7), createdAt: daysAgo(20) });
    expect(selectStaleBoxes([sealedOnly], NOW)[0].daysOpen).toBe(7);

    const createdOnly = box({ status: "ready", inTransitAt: null, sealedAt: null, createdAt: daysAgo(6) });
    expect(selectStaleBoxes([createdOnly], NOW)[0].daysOpen).toBe(6);
  });

  it("sorts a mixed list into the two steps", () => {
    const result = selectStaleBoxes(
      [
        box({ inTransitAt: daysAgo(2) }),   // too new
        box({ inTransitAt: daysAgo(6) }),   // first
        box({ inTransitAt: daysAgo(11) }),  // second
        box({ inTransitAt: daysAgo(40) }),  // given up on
        box({ status: "delivered", inTransitAt: daysAgo(8) }),
      ],
      NOW,
    );
    expect(result.map(r => r.step)).toEqual(["first", "second"]);
  });
});

describe("buildReminderMessage", () => {
  const b = (boxCode: string, daysOpen: number, customerCode: string | null = "WZ-100") =>
    ({ boxCode, customerCode, daysOpen });

  it("says what to do about it, not just that it happened", () => {
    const { content } = buildReminderMessage([b("BOX-1", 6)], []);
    expect(content).toContain("دایبخە");
  });

  it("puts the older boxes first", () => {
    const { content } = buildReminderMessage([b("BOX-NEW", 6)], [b("BOX-OLD", 12)]);
    expect(content.indexOf("BOX-OLD")).toBeLessThan(content.indexOf("BOX-NEW"));
  });

  it("names the customer so the box can be chased without a lookup", () => {
    const { content } = buildReminderMessage([b("BOX-1", 6, "WZ-777")], []);
    expect(content).toContain("WZ-777");
  });

  it("copes with a box whose customer could not be read", () => {
    const { content } = buildReminderMessage([b("BOX-1", 6, null)], []);
    expect(content).toContain("BOX-1");
    expect(content).not.toContain("null");
  });

  it("caps the list and says how many were left out", () => {
    // A wall of sixty box codes is not a message anyone reads.
    const many = Array.from({ length: 12 }, (_, i) => b(`BOX-${i}`, 6));
    const { content } = buildReminderMessage(many, []);
    expect(content).toContain("BOX-0");
    expect(content).not.toContain("BOX-11");
    expect(content).toContain("7");
  });

  it("omits a section that has nothing in it", () => {
    const { content } = buildReminderMessage([], [b("BOX-OLD", 12)]);
    expect(content).toContain("BOX-OLD");
    expect(content).not.toContain("🟡");
  });
});
