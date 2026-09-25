import { describe, expect, it } from "vitest";
import { CUSTOMER_ETA_BUFFER_DAYS, customerEta } from "./customerEta";

/**
 * The owner, 2026-09-25: "if the AWB is filled in, that means it is
 * definitively on its way — let it search online and take the arrival
 * schedule. But always say five days later, so the customer does not think
 * the plane lands straight inside the company."
 */

const DAY = 24 * 60 * 60 * 1000;

describe("the date a customer is told", () => {
  it("is five days after the airline's", () => {
    expect(CUSTOMER_ETA_BUFFER_DAYS).toBe(5);
    const real = new Date("2026-10-01T08:00:00.000Z");
    expect(customerEta(real)!.getTime()).toBe(real.getTime() + 5 * DAY);
  });

  it("reads a string as happily as a date", () => {
    expect(customerEta("2026-10-01T08:00:00.000Z")!.toISOString()).toBe("2026-10-06T08:00:00.000Z");
  });

  it("promises nothing when there is no schedule", () => {
    // Better than promising badly.
    expect(customerEta(null)).toBe(null);
    expect(customerEta(undefined)).toBe(null);
    expect(customerEta("")).toBe(null);
    expect(customerEta("not a date")).toBe(null);
  });

  it("never moves the date backwards, whatever it is given", () => {
    for (const days of [0, 1, 5, 30]) {
      const real = new Date("2026-10-01T00:00:00.000Z");
      expect(customerEta(real, days)!.getTime()).toBeGreaterThanOrEqual(real.getTime());
    }
  });
});

describe("where it is applied", () => {
  it("is the one road out to the customer, and only the estimate", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const src = fs
      .readFileSync(path.resolve(__dirname, "../server/lib/customerVisibleBatch.ts"), "utf8")
      .replace(/\r\n/g, "\n");
    expect(src).toContain('import { customerEta } from "@shared/customerEta";');
    expect(src).toContain("customerEta(out.estimatedArrival");
    // The day it actually arrived is a fact, and a fact is never moved.
    expect(src).not.toContain("customerEta(out.actualArrival");
  });
});
