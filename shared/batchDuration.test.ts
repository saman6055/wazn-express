import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { batchDuration, batchJourneyDates, durationWords, fillingWords } from "./batchDuration";

const at = (iso: string) => new Date(iso);

/**
 * How long a shipment took (owner, 2026-10-05): «دورەیشنێکیش هەبێ، ماوەکەی
 * بژمێرێت: بە چەند گەیشتووە».
 */
describe("when it left and when it arrived", () => {
  it("the typed departure date, and the first day it reached Erbil in the history", () => {
    const dates = batchJourneyDates(
      { departureDate: at("2026-10-01T00:00:00Z") },
      { in_transit: at("2026-10-01T09:00:00Z"), arrived: at("2026-10-07T14:00:00Z"), delivered: at("2026-10-09T10:00:00Z") },
    );
    expect(dates.departedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(dates.arrivedAt?.toISOString()).toBe("2026-10-07T14:00:00.000Z");
  });

  it("no departure date typed: the day it was moved to in transit", () => {
    const dates = batchJourneyDates({}, { in_transit: at("2026-10-02T08:00:00Z") });
    expect(dates.departedAt?.toISOString()).toBe("2026-10-02T08:00:00.000Z");
    expect(dates.arrivedAt).toBeNull();
  });

  it("a recorded arrival date wins over the history", () => {
    const dates = batchJourneyDates(
      { actualArrival: at("2026-10-06T00:00:00Z") },
      { arrived: at("2026-10-08T00:00:00Z") },
    );
    expect(dates.arrivedAt?.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });

  it("a batch moved straight to a later status arrived when it got there", () => {
    // Nobody pressed "arrived": it went from in transit to the depot.
    const dates = batchJourneyDates({}, { in_transit: at("2026-10-01T00:00:00Z"), at_depot: at("2026-10-05T00:00:00Z"), closed: at("2026-10-20T00:00:00Z") });
    expect(dates.arrivedAt?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("nothing recorded is nothing, not today", () => {
    expect(batchJourneyDates({}, null)).toEqual({ departedAt: null, arrivedAt: null });
    expect(batchJourneyDates({ departureDate: "not a date" }, {})).toEqual({ departedAt: null, arrivedAt: null });
  });
});

describe("the duration", () => {
  const now = at("2026-10-10T12:00:00Z");

  it("arrived: the days from leaving to arriving, and the days it took to fill", () => {
    const d = batchDuration({
      status: "arrived",
      createdAt: at("2026-09-28T10:00:00Z"),
      departedAt: at("2026-10-01T00:00:00Z"),
      arrivedAt: at("2026-10-07T14:00:00Z"),
    }, now);
    expect(d?.state).toBe("arrived");
    expect(d?.transitDays).toBe(6);
    expect(d?.fillingDays).toBe(2);
    expect(durationWords(d!).ku).toBe("بە 6 ڕۆژ گەیشت");
    expect(durationWords(d!).en).toBe("Arrived in 6 days");
    expect(fillingWords(d!)?.ku).toBe("2 ڕۆژ بۆ پڕبوونەوە");
  });

  it("still travelling: the days so far, and it goes on counting", () => {
    const facts = { status: "in_transit", departedAt: at("2026-10-06T00:00:00Z") };
    expect(batchDuration(facts, now)?.transitDays).toBe(4);
    expect(durationWords(batchDuration(facts, now)!).ku).toBe("4 ڕۆژە لە ڕێگا");
    expect(batchDuration(facts, at("2026-10-12T12:00:00Z"))?.transitDays).toBe(6);
  });

  it("an arrived batch stops counting on the day it arrived", () => {
    const facts = { status: "delivered", departedAt: at("2026-10-01T00:00:00Z"), arrivedAt: at("2026-10-04T00:00:00Z") };
    expect(batchDuration(facts, now)?.transitDays).toBe(3);
    expect(batchDuration(facts, at("2027-01-01T00:00:00Z"))?.transitDays).toBe(3);
  });

  it("the same day reads as the same day, not as zero days", () => {
    const d = batchDuration({ departedAt: at("2026-10-01T08:00:00Z"), arrivedAt: at("2026-10-01T20:00:00Z") }, now);
    expect(durationWords(d!).ku).toBe("هەمان ڕۆژ گەیشت");
    const today = batchDuration({ status: "in_transit", departedAt: at("2026-10-10T08:00:00Z") }, now);
    expect(durationWords(today!).ku).toBe("ئەمڕۆ بەڕێکرا");
  });

  it("says nothing for a batch that has not left", () => {
    expect(batchDuration({ status: "preparing", createdAt: at("2026-10-01T00:00:00Z") }, now)).toBeNull();
    // A departure date in the future is a plan, not a journey.
    expect(batchDuration({ status: "preparing", departureDate: at("2026-10-15T00:00:00Z") }, now)).toBeNull();
  });

  it("says nothing when the two dates contradict each other", () => {
    expect(batchDuration({ departedAt: at("2026-10-07T00:00:00Z"), arrivedAt: at("2026-10-01T00:00:00Z") }, now)).toBeNull();
  });

  it("an arrived batch with no arrival moment on record does not go on counting", () => {
    // Older than the status history: over, but its length is not known.
    expect(batchDuration({ status: "closed", departureDate: at("2026-05-01T00:00:00Z") }, now)).toBeNull();
  });

  it("the filling time is left out when the dates make no sense of it", () => {
    const d = batchDuration({ createdAt: at("2026-10-05T00:00:00Z"), departedAt: at("2026-10-01T00:00:00Z"), arrivedAt: at("2026-10-06T00:00:00Z") }, now);
    expect(d?.fillingDays).toBeNull();
    expect(fillingWords(d!)).toBeNull();
  });

  it("every sentence uses plain digits in all four languages", () => {
    const arrived = batchDuration({ departedAt: at("2026-10-01T00:00:00Z"), arrivedAt: at("2026-10-13T00:00:00Z") }, now)!;
    const travelling = batchDuration({ status: "in_transit", departedAt: at("2026-10-01T00:00:00Z") }, now)!;
    for (const words of [durationWords(arrived), durationWords(travelling)]) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(words[lang]).toMatch(/\d/);
        expect(words[lang]).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      }
    }
  });
});

describe("the list shows it", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

  it("the server reads the status history once for the whole page", () => {
    const router = read("server/routers/batches.router.ts");
    expect(router).toContain("const reached = await db.getBatchStatusTimestamps(batchIds);");
    expect(router).toContain("const reached = await db.getBatchStatusTimestamps(ids);");
    expect(router.split("...batchJourneyDates(batch, reached.get(batch.id)),").length - 1).toBe(2);
  });

  it("under the departure date in the list, and in full in the edit dialog", () => {
    const page = read("client/src/pages/Batches.tsx");
    expect(page).toContain("<BatchDurationChip batch={batch as never} />");
    expect(page).toContain("<BatchDurationChip batch={editingBatch as never} detailed />");
    const chip = read("client/src/components/batches/BatchDuration.tsx");
    expect(chip).toContain("const duration = batchDuration(batch);");
    expect(chip).toContain("if (!duration) return null;");
  });
});
