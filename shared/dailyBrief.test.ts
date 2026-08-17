import { describe, it, expect } from "vitest";
import {
  compare,
  describeDelta,
  EMPTY_DAY,
  headline,
  METRICS,
  movementSignals,
  MOVEMENT_THRESHOLD_PERCENT,
  rankSignals,
  summarise,
  worthSaying,
  type DaySnapshot,
  type Signal,
} from "./dailyBrief";

const day = (over: Partial<DaySnapshot> = {}): DaySnapshot => ({ ...EMPTY_DAY, ...over });

const signal = (over: Partial<Signal> & Pick<Signal, "id" | "kind" | "weight">): Signal => ({
  title: { ku: "-", en: "-", ar: "-", zh: "-" },
  ...over,
});

describe("comparing two figures", () => {
  it("gives a whole percent either way", () => {
    expect(compare(100, 120)).toMatchObject({ direction: "up", percent: 20 });
    expect(compare(100, 80)).toMatchObject({ direction: "down", percent: 20 });
  });

  it("does not claim an infinite rise out of zero", () => {
    // A percentage against zero is arithmetic nonsense, and printing it makes
    // the whole report look automated and unread.
    const delta = compare(0, 14);
    expect(delta.direction).toBe("from_zero");
    expect(delta.percent).toBeUndefined();
  });

  it("says so when something fell to nothing", () => {
    const delta = compare(14, 0);
    expect(delta.direction).toBe("to_zero");
    expect(delta.percent).toBeUndefined();
  });

  it("treats nothing to nothing as flat, not as a change", () => {
    expect(compare(0, 0)).toMatchObject({ direction: "flat", percent: 0 });
  });

  it("rounds a fraction of a percent to flat rather than to noise", () => {
    expect(compare(10000, 10001).direction).toBe("flat");
  });

  it("handles a negative starting figure without inverting the direction", () => {
    // A balance can be negative. Dividing by it unguarded flips up and down.
    expect(compare(-100, -50)).toMatchObject({ direction: "up", percent: 50 });
  });
});

describe("whether a movement is worth saying", () => {
  it("keeps quiet about weather", () => {
    expect(worthSaying(compare(100, 103))).toBe(false);
    expect(worthSaying(compare(100, 97))).toBe(false);
  });

  it("speaks at the threshold", () => {
    expect(worthSaying(compare(100, 100 + MOVEMENT_THRESHOLD_PERCENT))).toBe(true);
  });

  it("always speaks about zero, in either direction", () => {
    // The two most interesting movements a business figure makes, and both
    // are undefined as arithmetic.
    expect(worthSaying(compare(0, 1))).toBe(true);
    expect(worthSaying(compare(1, 0))).toBe(true);
  });

  it("never speaks about flat", () => {
    expect(worthSaying(compare(100, 100))).toBe(false);
  });
});

describe("reading a movement the right way round", () => {
  it("calls rising revenue a win and rising debt a risk", () => {
    // A brief that congratulated the owner on growing debt would be worse
    // than one that said nothing.
    expect(describeDelta(compare(100, 200), true).kind).toBe("win");
    expect(describeDelta(compare(100, 200), false).kind).toBe("risk");
  });

  it("calls falling debt a win and falling revenue a risk", () => {
    expect(describeDelta(compare(200, 100), false).kind).toBe("win");
    expect(describeDelta(compare(200, 100), true).kind).toBe("risk");
  });

  it("reads a rise out of zero the same way as any other rise", () => {
    expect(describeDelta(compare(0, 5), true).kind).toBe("win");
    expect(describeDelta(compare(0, 5), false).kind).toBe("risk");
  });

  it("puts every language in the sentence", () => {
    const cases = [compare(100, 200), compare(200, 100), compare(0, 5), compare(5, 0), compare(1, 1)];
    for (const delta of cases) {
      for (const better of [true, false]) {
        const { text } = describeDelta(delta, better);
        for (const lang of ["ku", "en", "ar", "zh"] as const) {
          expect(text[lang], `${delta.direction} has no ${lang}`).toBeTruthy();
        }
      }
    }
  });
});

describe("the movements a morning produces", () => {
  it("reports only what crossed the threshold", () => {
    const signals = movementSignals(
      day({ revenueUsd: 200, parcelsRegistered: 31 }),
      day({ revenueUsd: 100, parcelsRegistered: 30 }),
    );

    expect(signals.map((s) => s.id)).toEqual(["movement:revenue"]);
  });

  it("leaves an unchanged day silent rather than listing zeros", () => {
    // A page of "no change" lines is how a reader learns to skim past the one
    // line that mattered.
    expect(movementSignals(day({ revenueUsd: 100 }), day({ revenueUsd: 100 }))).toEqual([]);
  });

  it("marks a fall in revenue as a risk and a fall in debt as a win", () => {
    const signals = movementSignals(
      day({ revenueUsd: 50, outstandingDebtUsd: 500 }),
      day({ revenueUsd: 100, outstandingDebtUsd: 1000 }),
    );

    const byId = Object.fromEntries(signals.map((s) => [s.id, s]));
    expect(byId["movement:revenue"].kind).toBe("risk");
    expect(byId["movement:outstanding_debt"].kind).toBe("win");
  });

  it("carries the figure in its own unit", () => {
    const signals = movementSignals(day({ revenueUsd: 200, kilos: 40 }), day({ revenueUsd: 100, kilos: 10 }));
    const byId = Object.fromEntries(signals.map((s) => [s.id, s]));
    expect(byId["movement:revenue"].value).toBe("$200.00");
    expect(byId["movement:kilos"].value).toBe("40 kg");
  });

  it("gives every movement somewhere to go and look", () => {
    // A figure that cannot be traced to its records is a figure nobody trusts.
    const signals = movementSignals(day({ revenueUsd: 200 }), day({ revenueUsd: 100 }));
    expect(signals.every((s) => !!s.path)).toBe(true);
  });

  it("names every metric in every language", () => {
    for (const metric of METRICS) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(metric.title[lang], `${metric.id} has no ${lang}`).toBeTruthy();
      }
    }
  });
});

describe("the order they are read in", () => {
  it("puts everything urgent above everything else", () => {
    const ranked = rankSignals([
      signal({ id: "b", kind: "win", weight: "notable" }),
      signal({ id: "a", kind: "risk", weight: "urgent" }),
    ]);
    expect(ranked[0].id).toBe("a");
  });

  it("puts a quiet risk above a notable win only within its own weight", () => {
    // Weight first: somebody skimming five lines must find everything needing
    // a decision, and a quiet risk is still quieter than a notable anything.
    const ranked = rankSignals([
      signal({ id: "quiet-risk", kind: "risk", weight: "quiet" }),
      signal({ id: "notable-win", kind: "win", weight: "notable" }),
    ]);
    expect(ranked.map((s) => s.id)).toEqual(["notable-win", "quiet-risk"]);
  });

  it("puts risks above wins at the same weight", () => {
    const ranked = rankSignals([
      signal({ id: "win", kind: "win", weight: "notable" }),
      signal({ id: "risk", kind: "risk", weight: "notable" }),
    ]);
    expect(ranked.map((s) => s.id)).toEqual(["risk", "win"]);
  });

  it("is stable, so the same morning reads the same twice", () => {
    const input = [
      signal({ id: "b", kind: "risk", weight: "notable" }),
      signal({ id: "a", kind: "risk", weight: "notable" }),
    ];
    expect(rankSignals(input).map((s) => s.id)).toEqual(["a", "b"]);
    expect(input[0].id).toBe("b");
  });
});

describe("the headline", () => {
  it("counts what needs a decision today", () => {
    const line = headline(summarise([signal({ id: "x", kind: "risk", weight: "urgent" })]));
    expect(line.en).toBe("1 thing needs you today");
  });

  it("does not say '1 things'", () => {
    const two = headline(
      summarise([
        signal({ id: "x", kind: "risk", weight: "urgent" }),
        signal({ id: "y", kind: "risk", weight: "urgent" }),
      ]),
    );
    expect(two.en).toBe("2 things need you today");
  });

  it("separates urgent from merely worth watching", () => {
    const line = headline(summarise([signal({ id: "x", kind: "risk", weight: "quiet" })]));
    expect(line.en).toContain("Nothing urgent");
  });

  it("reports the good days too", () => {
    // A brief that only ever carries bad news gets avoided, and then the bad
    // news is not read either.
    const line = headline(summarise([signal({ id: "x", kind: "win", weight: "notable" })]));
    expect(line.en).toContain("improved");
  });

  it("says plainly when there is nothing", () => {
    const line = headline(summarise([]));
    expect(line.en).toBe("All well. Nothing is waiting on a decision.");
  });

  it("is not 'all well' while any risk stands", () => {
    expect(summarise([signal({ id: "x", kind: "risk", weight: "quiet" })]).allWell).toBe(false);
  });

  it("has every language, whatever the day", () => {
    const days: Signal[][] = [
      [signal({ id: "a", kind: "risk", weight: "urgent" })],
      [signal({ id: "a", kind: "risk", weight: "quiet" })],
      [signal({ id: "a", kind: "win", weight: "notable" })],
      [],
    ];
    for (const d of days) {
      const line = headline(summarise(d));
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(line[lang]).toBeTruthy();
      }
    }
  });
});
