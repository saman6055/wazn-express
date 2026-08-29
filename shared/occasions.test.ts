import { describe, expect, it } from "vitest";
import { occasionsFor, fathersDay, type Occasion } from "./occasions";

/**
 * Greetings are the one thing here that can only be got wrong in public.
 * A day early, to the wrong person, or in the wrong language, and it lands
 * worse than saying nothing at all.
 */

const keys = (list: Occasion[]) => list.map((o) => o.key);

describe("the fixed days land on their dates and nowhere else", () => {
  it("Newroz on the 21st of March, for everybody", () => {
    expect(keys(occasionsFor(new Date(2027, 2, 21)))).toContain("newroz");
    expect(keys(occasionsFor(new Date(2027, 2, 20)))).not.toContain("newroz");
    expect(keys(occasionsFor(new Date(2027, 2, 22)))).not.toContain("newroz");
  });

  it("Labour Day on the 1st of May, and the seasons on their own days", () => {
    expect(keys(occasionsFor(new Date(2027, 4, 1)))).toContain("labour_day");
    expect(keys(occasionsFor(new Date(2027, 5, 21)))).toContain("summer");
    expect(keys(occasionsFor(new Date(2027, 8, 23)))).toContain("autumn");
    expect(keys(occasionsFor(new Date(2027, 11, 21)))).toContain("winter");
  });

  it("says nothing at all on an ordinary day", () => {
    expect(occasionsFor(new Date(2027, 6, 14))).toEqual([]);
  });
});

describe("a gendered day is never guessed at", () => {
  const march8 = new Date(2027, 2, 8);

  it("reaches women on Women's Day", () => {
    expect(keys(occasionsFor(march8, { gender: "female" }))).toContain("womens_day");
  });

  it("does not reach men", () => {
    expect(keys(occasionsFor(march8, { gender: "male" }))).not.toContain("womens_day");
  });

  it("stays silent when the record does not say", () => {
    // Guessing is worse than silence: a man wished a happy Women's Day, or a
    // woman missed on her own day, both land badly.
    for (const gender of [null, undefined, "", "other"]) {
      expect(occasionsFor(march8, { gender }), `gender ${String(gender)}`).toEqual([]);
    }
  });

  it("finds Father's Day on the third Sunday of June", () => {
    // 2027: June 1st is a Tuesday, so the Sundays are 6, 13, 20.
    expect(fathersDay(2027).getDate()).toBe(20);
    expect(fathersDay(2027).getDay()).toBe(0);
    expect(keys(occasionsFor(fathersDay(2027), { gender: "male" }))).toContain("fathers_day");
    expect(keys(occasionsFor(fathersDay(2027), { gender: "female" }))).not.toContain("fathers_day");
  });

  it("puts Father's Day on a Sunday every year, not on a fixed date", () => {
    for (let y = 2026; y <= 2035; y++) {
      const d = fathersDay(y);
      expect(d.getDay(), `${y} is not a Sunday`).toBe(0);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBeGreaterThanOrEqual(15);
      expect(d.getDate()).toBeLessThanOrEqual(21);
    }
  });
});

describe("the 21st of March carries three at once", () => {
  it("gives a woman all three, with Newroz first", () => {
    const list = occasionsFor(new Date(2027, 2, 21), { gender: "female" });
    expect(keys(list)).toEqual(["newroz", "mothers_day"]);
  });

  it("gives everybody else Newroz alone", () => {
    expect(keys(occasionsFor(new Date(2027, 2, 21), { gender: "male" }))).toEqual(["newroz"]);
  });
});

describe("a birthday outranks everything", () => {
  it("comes first even on Newroz", () => {
    const list = occasionsFor(new Date(2027, 2, 21), { gender: "male", birthMonth: 3, birthDay: 21 });
    expect(keys(list)[0]).toBe("birthday");
    expect(keys(list)).toContain("newroz");
  });

  it("needs both the month and the day", () => {
    const day = new Date(2027, 6, 14);
    expect(keys(occasionsFor(day, { birthMonth: 7, birthDay: 14 }))).toEqual(["birthday"]);
    expect(occasionsFor(day, { birthMonth: 7 })).toEqual([]);
    expect(occasionsFor(day, { birthDay: 14 })).toEqual([]);
    expect(occasionsFor(day, {})).toEqual([]);
  });
});

describe("the moving days only fire on dates somebody supplied", () => {
  it("stays silent when no Hijri dates are known", () => {
    // Ramadan and Eid are set in Iraq by sighting the moon. A calculated
    // guess can be a day out, and Eid a day early is worse than nothing.
    expect(occasionsFor(new Date(2027, 1, 8), {}, {})).toEqual([]);
  });

  it("fires on the exact day it was given", () => {
    const eid = new Date(2027, 1, 8);
    expect(keys(occasionsFor(eid, {}, { eidFitr: eid }))).toEqual(["eid_fitr"]);
    expect(occasionsFor(new Date(2027, 1, 7), {}, { eidFitr: eid })).toEqual([]);
  });

  it("accepts a date that arrived as a string", () => {
    expect(keys(occasionsFor(new Date(2027, 1, 8), {}, { eidFitr: "2027-02-08T00:00:00" })))
      .toEqual(["eid_fitr"]);
  });

  it("ignores a date that is not a date rather than throwing", () => {
    expect(occasionsFor(new Date(2027, 1, 8), {}, { eidFitr: "not a date" })).toEqual([]);
    expect(occasionsFor(new Date(2027, 1, 8), {}, { eidFitr: null })).toEqual([]);
  });

  it("puts Eid above everything except a birthday", () => {
    const day = new Date(2027, 2, 21);
    const list = occasionsFor(day, { gender: "female" }, { eidFitr: day });
    expect(keys(list)[0]).toBe("eid_fitr");
  });
});

describe("every greeting is written in all four languages", () => {
  it("no occasion is missing one", () => {
    // A customer reading the portal in Arabic must not meet a Kurdish
    // sentence on the one day the company chose to speak to them.
    const day = new Date(2027, 2, 21);
    const all = [
      ...occasionsFor(day, { gender: "female", birthMonth: 3, birthDay: 21 },
        { eidFitr: day, eidAdha: day, ramadanStart: day, hijriNewYear: day, mawlid: day }),
      ...occasionsFor(new Date(2027, 4, 1)),
      ...occasionsFor(new Date(2027, 5, 21)),
      ...occasionsFor(new Date(2027, 8, 23)),
      ...occasionsFor(new Date(2027, 11, 21)),
      ...occasionsFor(new Date(2027, 2, 8), { gender: "female" }),
      ...occasionsFor(fathersDay(2027), { gender: "male" }),
    ];
    expect(all.length).toBeGreaterThan(10);
    for (const o of all) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(o.title[lang], `${o.key} title has no ${lang}`).toBeTruthy();
        expect(o.message[lang], `${o.key} message has no ${lang}`).toBeTruthy();
      }
    }
  });
});
