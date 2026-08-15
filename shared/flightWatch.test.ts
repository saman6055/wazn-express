import { describe, expect, it } from "vitest";
import {
  ARRIVED_TITLE,
  GIVE_UP_AFTER_DAYS,
  WATCHER_BROKEN,
  WATCH_AFTER_DAYS,
  adminAlertTitle,
  arrivedMessage,
  customsShouldStart,
  findLanded,
  hasLanded,
  isAirBatch,
  normaliseFlightNumber,
  watchDecision,
} from "./flightWatch";

/**
 * This watcher sends a message to every customer with goods in a batch. A
 * mistake here is not a wrong pixel — it is twenty-three people told their
 * parcels have arrived when they have not, and twenty-three phone calls.
 *
 * So the tests are mostly about restraint: when not to look, what does not
 * count as a landing, and what the customer is told about the days still
 * ahead of them.
 */

const at = (iso: string) => new Date(iso);
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);
const NOW = at("2026-08-16T12:00:00");

const batch = (over: Record<string, unknown> = {}) => ({
  id: 1,
  status: "in_transit",
  shippingType: "air_regular",
  flightNumber: "TK6894",
  createdAt: daysAgo(NOW, 6),
  ...over,
});

describe("which shipments are worth looking up", () => {
  it("watches an air batch old enough to have arrived", () => {
    expect(watchDecision(batch(), NOW)).toMatchObject({ watch: true, ageDays: 6 });
  });

  it("leaves the first days alone", () => {
    // A China-Erbil batch is never on the board on day one, and asking the
    // airport about it every hour for four days is rude and pointless.
    for (let age = 0; age < WATCH_AFTER_DAYS; age++) {
      const decision = watchDecision(batch({ createdAt: daysAgo(NOW, age) }), NOW);
      expect(decision, `day ${age}`).toMatchObject({ watch: false, reason: "too-early" });
    }
    expect(watchDecision(batch({ createdAt: daysAgo(NOW, WATCH_AFTER_DAYS) }), NOW).watch).toBe(true);
  });

  it("does not look for a container on an arrivals board", () => {
    expect(watchDecision(batch({ shippingType: "sea" }), NOW))
      .toMatchObject({ watch: false, reason: "not-air" });
  });

  it("needs a flight number to look one up", () => {
    for (const missing of [null, undefined, "", "   "]) {
      expect(watchDecision(batch({ flightNumber: missing }), NOW), String(missing))
        .toMatchObject({ watch: false, reason: "no-flight-number" });
    }
  });

  it("stops once the landing has been seen", () => {
    // Seen once is enough. Re-checking would eventually find the same flight
    // number on a later day and announce it a second time.
    expect(watchDecision(batch({ flightArrivedAt: daysAgo(NOW, 1) }), NOW))
      .toMatchObject({ watch: false, reason: "already-arrived" });
  });

  it("stops for a shipment that is over", () => {
    for (const status of ["delivered", "closed"]) {
      expect(watchDecision(batch({ status }), NOW), status)
        .toMatchObject({ watch: false, reason: "finished" });
    }
  });

  it("gives up on a batch nobody closed", () => {
    // Otherwise a batch left open in 2024 is still being looked up in 2027.
    expect(watchDecision(batch({ createdAt: daysAgo(NOW, GIVE_UP_AFTER_DAYS + 1) }), NOW))
      .toMatchObject({ watch: false, reason: "gave-up" });
  });

  it("treats an unreadable creation date as day zero rather than crashing", () => {
    expect(watchDecision(batch({ createdAt: "not a date" }), NOW).watch).toBe(false);
  });
});

describe("matching a flight number", () => {
  it("ignores how either side wrote it", () => {
    // The office types TK6894; the board prints "TK 6894".
    expect(normaliseFlightNumber("TK 6894")).toBe("TK6894");
    expect(normaliseFlightNumber("tk-6894")).toBe("TK6894");
    expect(normaliseFlightNumber(" TK6894 ")).toBe("TK6894");
  });

  it("is empty for nothing", () => {
    for (const v of [null, undefined, "", "  "]) expect(normaliseFlightNumber(v)).toBe("");
  });

  it("knows air from sea", () => {
    expect(isAirBatch("air_regular")).toBe(true);
    expect(isAirBatch("air_irregular")).toBe(true);
    expect(isAirBatch("sea")).toBe(false);
    expect(isAirBatch(null)).toBe(false);
  });
});

describe("what counts as landed", () => {
  it("accepts the board's words", () => {
    expect(hasLanded("ARRIVED")).toBe(true);
    expect(hasLanded("arrived")).toBe(true);
    expect(hasLanded(" LANDED ")).toBe(true);
  });

  it("refuses everything else", () => {
    // SCHEDULED is not news — it is the same answer as yesterday.
    for (const status of ["SCHEDULED", "ESTIMATED", "DELAYED", "CANCELLED", "", null]) {
      expect(hasLanded(status), String(status)).toBe(false);
    }
  });
});

describe("finding our flight on the board", () => {
  const rows = [
    { flight: "TK 6896", status: "ARRIVED" },
    { flight: "TK 6894", status: "SCHEDULED" },
    { flight: "QR 434", status: "ARRIVED" },
  ];

  it("finds a landed flight whatever the spacing", () => {
    expect(findLanded(rows, "tk6896")?.flight).toBe("TK 6896");
  });

  it("does not report a flight that has not landed", () => {
    // The one case that would tell everybody the wrong thing.
    expect(findLanded(rows, "TK6894")).toBeNull();
  });

  it("does not report somebody else's flight", () => {
    expect(findLanded(rows, "TK9999")).toBeNull();
  });

  it("returns nothing when the board is empty", () => {
    // A parse that read nothing must not be mistaken for "not landed yet" by
    // the caller — hence null, and the caller counts the silence.
    expect(findLanded([], "TK6894")).toBeNull();
  });
});

describe("when customs starts", () => {
  it("waits for the next morning", () => {
    // Landed at 23:10 — it is not in customs twenty minutes later.
    const landed = at("2026-08-16T23:10:00");
    expect(customsShouldStart(landed, at("2026-08-16T23:30:00"))).toBe(false);
    expect(customsShouldStart(landed, at("2026-08-17T07:00:00"))).toBe(false);
    expect(customsShouldStart(landed, at("2026-08-17T08:00:00"))).toBe(true);
  });

  it("still waits for a flight that landed first thing", () => {
    const landed = at("2026-08-16T06:00:00");
    expect(customsShouldStart(landed, at("2026-08-16T18:00:00"))).toBe(false);
    expect(customsShouldStart(landed, at("2026-08-17T08:30:00"))).toBe(true);
  });

  it("says no when nothing landed", () => {
    expect(customsShouldStart(null, NOW)).toBe(false);
    expect(customsShouldStart("not a date", NOW)).toBe(false);
  });
});

describe("what the customer is told", () => {
  const message = arrivedMessage("AIR-2026-042", 2);

  it("says it is not ready, in every language", () => {
    // The line that stops the phone ringing for three days.
    expect(message.ku).toContain("هێشتا ئامادە نییە");
    expect(message.en.toLowerCase()).toContain("not ready for collection yet");
    expect(message.ar).toContain("لم تصبح جاهزة للاستلام");
    expect(message.zh).toContain("尚不可提取");
  });

  it("says customs is next and takes days", () => {
    expect(message.en.toLowerCase()).toContain("customs");
    expect(message.ku).toContain("گومرگ");
  });

  it("says not to call us", () => {
    expect(message.en.toLowerCase()).toContain("no need to contact us");
    expect(message.ku).toContain("پێویست ناکات پەیوەندیمان پێوە بکەیت");
  });

  it("names the shipment and how many parcels are theirs", () => {
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(message[lang], lang).toContain("AIR-2026-042");
      expect(message[lang], lang).toContain("2");
    }
  });

  it("has a title in every language", () => {
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(ARRIVED_TITLE[lang]?.trim(), lang).toBeTruthy();
    }
  });
});

describe("what the office is told", () => {
  it("names the batch and the flight", () => {
    const title = adminAlertTitle("AIR-2026-042", "TK 6894");
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(title[lang], lang).toContain("AIR-2026-042");
      expect(title[lang], lang).toContain("TK 6894");
    }
  });

  it("has words for the watcher having gone quiet", () => {
    // Silence from a scraper is a fault, not an answer, and has to be said.
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(WATCHER_BROKEN[lang]?.trim(), lang).toBeTruthy();
    }
  });
});
