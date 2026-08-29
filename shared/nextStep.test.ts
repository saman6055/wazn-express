import { describe, expect, it } from "vitest";
import { nextStepOf, mostRelevantShipment } from "./nextStep";

/**
 * "In transit: 3" answers a question nobody asked. What a customer opens the
 * app for is the next thing that will happen to their own goods.
 */
const NOW = new Date("2026-09-01T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("every stage knows what comes after it", () => {
  it("reads the ladder forwards", () => {
    const steps: Array<[string, string]> = [
      ["preparing", "leaving_china"],
      ["in_transit", "arriving_iraq"],
      ["arrived", "clearing_customs"],
      ["customs", "reaching_depot"],
      ["at_depot", "ready_to_collect"],
      ["delivered", "done"],
      ["closed", "done"],
    ];
    for (const [status, expected] of steps) {
      expect(nextStepOf({ status }, NOW).key, `${status} → ?`).toBe(expected);
    }
  });

  it("says nothing is pending once the goods are with them", () => {
    expect(nextStepOf({ status: "delivered" }, NOW).finished).toBe(true);
    expect(nextStepOf({ status: "closed" }, NOW).finished).toBe(true);
  });

  it("falls back rather than blanking on a status it does not know", () => {
    expect(nextStepOf({ status: "something_new" }, NOW).key).toBe("leaving_china");
    expect(nextStepOf({}, NOW).key).toBe("leaving_china");
  });
});

describe("a date is only given when one was recorded", () => {
  it("uses the estimate for the leg that has one", () => {
    const step = nextStepOf({ status: "in_transit", estimatedArrival: days(4) }, NOW);
    expect(step.expectedAt?.toISOString()).toBe(days(4).toISOString());
  });

  it("prefers a recorded arrival over an estimate", () => {
    const step = nextStepOf(
      { status: "in_transit", estimatedArrival: days(4), actualArrival: days(2) }, NOW,
    );
    expect(step.expectedAt?.toISOString()).toBe(days(2).toISOString());
  });

  it("invents nothing for customs or the drive to the depot", () => {
    // Those take what they take. A number here becomes a promise, and a
    // customer holds you to it.
    for (const status of ["arrived", "customs", "at_depot"]) {
      expect(nextStepOf({ status, estimatedArrival: days(4) }, NOW).expectedAt).toBeNull();
    }
  });

  it("survives a date that is not a date", () => {
    expect(nextStepOf({ status: "in_transit", estimatedArrival: "not a date" }, NOW).expectedAt).toBeNull();
    expect(nextStepOf({ status: "in_transit", estimatedArrival: null }, NOW).expectedAt).toBeNull();
  });

  it("marks a date that has passed as overdue, and says so quietly", () => {
    expect(nextStepOf({ status: "in_transit", estimatedArrival: days(-3) }, NOW).overdue).toBe(true);
    expect(nextStepOf({ status: "in_transit", estimatedArrival: days(3) }, NOW).overdue).toBe(false);
    // No date, no claim.
    expect(nextStepOf({ status: "in_transit" }, NOW).overdue).toBe(false);
  });
});

describe("of everything moving, the one worth showing", () => {
  it("picks the shipment closest to reaching them", () => {
    // A shipment still in China is true but not news.
    const best = mostRelevantShipment([
      { id: 1, status: "preparing" },
      { id: 2, status: "customs" },
      { id: 3, status: "in_transit" },
    ] as any, NOW);
    expect((best?.shipment as any).id).toBe(2);
  });

  it("ignores what has already arrived", () => {
    const best = mostRelevantShipment([
      { id: 1, status: "delivered" },
      { id: 2, status: "closed" },
      { id: 3, status: "preparing" },
    ] as any, NOW);
    expect((best?.shipment as any).id).toBe(3);
  });

  it("breaks a tie on the sooner date", () => {
    const best = mostRelevantShipment([
      { id: 1, status: "in_transit", estimatedArrival: days(9) },
      { id: 2, status: "in_transit", estimatedArrival: days(2) },
    ] as any, NOW);
    expect((best?.shipment as any).id).toBe(2);
  });

  it("does not treat an undated shipment as more urgent than a late one", () => {
    const best = mostRelevantShipment([
      { id: 1, status: "in_transit", estimatedArrival: days(-5) },
      { id: 2, status: "in_transit" },
    ] as any, NOW);
    expect((best?.shipment as any).id).toBe(1);
  });

  it("returns nothing when everything has arrived", () => {
    expect(mostRelevantShipment([{ status: "delivered" }] as any, NOW)).toBeNull();
    expect(mostRelevantShipment([], NOW)).toBeNull();
  });
});
