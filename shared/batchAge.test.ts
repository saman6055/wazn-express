import { describe, expect, it } from "vitest";
import {
  AMBER_AFTER_DAYS,
  BAND_CLASS,
  BAND_MEANING,
  RED_AFTER_DAYS,
  ageLabel,
  batchAge,
  overdueBatches,
} from "./batchAge";

const NOW = new Date("2026-08-16T12:00:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("how old a shipment is", () => {
  it("counts whole days", () => {
    expect(batchAge({ createdAt: daysAgo(0) }, NOW).days).toBe(0);
    expect(batchAge({ createdAt: daysAgo(7) }, NOW).days).toBe(7);
    // Half a day past the seventh is still the seventh day.
    expect(batchAge({ createdAt: new Date(NOW.getTime() - 7.5 * 86_400_000) }, NOW).days).toBe(7);
  });

  it("is green for the first twenty days", () => {
    for (const day of [0, 1, 10, AMBER_AFTER_DAYS - 1]) {
      expect(batchAge({ createdAt: daysAgo(day) }, NOW).band, `day ${day}`).toBe("green");
    }
  });

  it("turns amber on the twentieth day", () => {
    expect(batchAge({ createdAt: daysAgo(AMBER_AFTER_DAYS) }, NOW).band).toBe("amber");
    expect(batchAge({ createdAt: daysAgo(RED_AFTER_DAYS - 1) }, NOW).band).toBe("amber");
  });

  it("turns red on the thirtieth", () => {
    expect(batchAge({ createdAt: daysAgo(RED_AFTER_DAYS) }, NOW).band).toBe("red");
    expect(batchAge({ createdAt: daysAgo(120) }, NOW).band).toBe("red");
  });

  it("says nothing about a shipment that is over", () => {
    // A batch delivered two months ago is not late. Colouring it red would
    // teach the office that red means nothing.
    for (const status of ["delivered", "closed"]) {
      expect(batchAge({ status, createdAt: daysAgo(200) }, NOW).band, status).toBe("settled");
    }
  });

  it("treats a broken date as new rather than ancient", () => {
    // A storage fault must not paint every row red.
    for (const bad of [null, undefined, "not a date"]) {
      const age = batchAge({ createdAt: bad as string }, NOW);
      expect(age.band, String(bad)).toBe("green");
      expect(age.days).toBe(0);
    }
  });

  it("never reports a negative age for a future date", () => {
    expect(batchAge({ createdAt: new Date(NOW.getTime() + 86_400_000) }, NOW).days).toBe(0);
  });
});

describe("which ones the office is told about", () => {
  const batches = [
    { id: 1, createdAt: daysAgo(3) },
    { id: 2, createdAt: daysAgo(22) },
    { id: 3, createdAt: daysAgo(45) },
    { id: 4, createdAt: daysAgo(31) },
    { id: 5, createdAt: daysAgo(90), status: "delivered" },
  ];

  it("only the red ones", () => {
    // Amber is a badge on a screen. An alert for it as well is how alerts
    // become wallpaper.
    expect(overdueBatches(batches, NOW).map((b) => b.id)).toEqual([3, 4]);
  });

  it("oldest first", () => {
    const overdue = overdueBatches(batches, NOW);
    expect(overdue[0].days).toBeGreaterThan(overdue[1].days);
  });

  it("carries the age through so the alert can say it", () => {
    expect(overdueBatches(batches, NOW)[0]).toMatchObject({ id: 3, days: 45 });
  });

  it("says nothing when everything is on time", () => {
    expect(overdueBatches([{ id: 9, createdAt: daysAgo(2) }], NOW)).toEqual([]);
  });
});

describe("what the colours say", () => {
  it("every band has words and a style in all four languages", () => {
    for (const band of ["green", "amber", "red"] as const) {
      expect(BAND_CLASS[band]?.trim(), band).toBeTruthy();
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(BAND_MEANING[band][lang]?.trim(), `${band}.${lang}`).toBeTruthy();
      }
    }
  });

  it("names the number of days in every language", () => {
    const label = ageLabel(24);
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(label[lang], lang).toContain("24");
    }
  });

  it("each band has its own colour", () => {
    const classes = new Set(Object.values(BAND_CLASS));
    expect(classes.size).toBe(3);
  });
});
