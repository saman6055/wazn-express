import { describe, it, expect } from "vitest";
import { dueSlot, msUntilNextCheck, pruneKeys, slotKey, TIP_HOURS } from "./tipSchedule";

const at = (hour: number, minute = 0) => new Date(2026, 7, 17, hour, minute, 0);

describe("the two hours", () => {
  it("are mid-morning and mid-afternoon", () => {
    expect(TIP_HOURS).toEqual([10, 15]);
  });
});

describe("which tip is owed", () => {
  it("says nothing before the first hour", () => {
    expect(dueSlot(at(9, 59), [])).toBeNull();
    expect(dueSlot(at(7), [])).toBeNull();
  });

  it("owes the morning one from ten until three", () => {
    expect(dueSlot(at(10), [])).toBe("morning");
    expect(dueSlot(at(12, 30), [])).toBe("morning");
    expect(dueSlot(at(14, 59), [])).toBe("morning");
  });

  it("owes the afternoon one from three onward", () => {
    expect(dueSlot(at(15), [])).toBe("afternoon");
    expect(dueSlot(at(23, 59), [])).toBe("afternoon");
  });

  it("says nothing once that slot has been shown", () => {
    expect(dueSlot(at(11), [slotKey(at(11), "morning")])).toBeNull();
    expect(dueSlot(at(16), [slotKey(at(16), "afternoon")])).toBeNull();
  });

  it("does not catch up on a slot that was missed", () => {
    // Somebody opening the system for the first time at four gets the
    // afternoon tip, not a morning one six hours late and then a second one
    // straight after. Catching up is how two a day becomes two at once.
    expect(dueSlot(at(16), [])).toBe("afternoon");
  });

  it("still owes the afternoon one to somebody who read the morning one", () => {
    expect(dueSlot(at(15, 1), [slotKey(at(15), "morning")])).toBe("afternoon");
  });

  it("is not silenced by yesterday's tip", () => {
    const yesterday = new Date(2026, 7, 16, 11);
    expect(dueSlot(at(11), [slotKey(yesterday, "morning")])).toBe("morning");
  });
});

describe("the keys kept in storage", () => {
  it("carry the day, so today's slots are their own", () => {
    expect(slotKey(at(11), "morning")).toBe("2026-08-17:morning");
    expect(slotKey(at(16), "afternoon")).toBe("2026-08-17:afternoon");
  });

  it("uses the reader's own clock, not UTC", () => {
    // A shift that starts at eight in Erbil should see the morning tip at ten
    // in Erbil, whatever a server somewhere thinks the date is.
    const local = new Date(2026, 0, 1, 0, 30);
    expect(slotKey(local, "morning")).toBe("2026-01-01:morning");
  });

  it("drops everything but today", () => {
    const kept = pruneKeys(at(11), [
      "2026-08-16:morning",
      "2026-08-16:afternoon",
      "2026-08-17:morning",
    ]);
    expect(kept).toEqual(["2026-08-17:morning"]);
  });

  it("survives a storage value that makes no sense", () => {
    expect(pruneKeys(at(11), ["", "nonsense", "2026-08-17:morning"])).toEqual(["2026-08-17:morning"]);
  });
});

describe("when to look again", () => {
  it("waits for the turn of the minute", () => {
    expect(msUntilNextCheck(new Date(2026, 7, 17, 9, 59, 30))).toBe(30_000);
  });

  it("never returns zero, which would spin", () => {
    expect(msUntilNextCheck(new Date(2026, 7, 17, 9, 59, 59, 500))).toBeGreaterThanOrEqual(1000);
  });

  it("never waits longer than a minute", () => {
    for (let s = 0; s < 60; s++) {
      expect(msUntilNextCheck(new Date(2026, 7, 17, 9, 0, s))).toBeLessThanOrEqual(60_000);
    }
  });
});
