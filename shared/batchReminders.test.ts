import { describe, expect, it } from "vitest";
import {
  REMIND_AFTER_DAYS,
  URGENT_AFTER_DAYS,
  batchesAwaitingShippingNumber,
  daysSinceCreated,
  isSeaBatch,
  missingShippingNumber,
  reminderSeverity,
} from "./batchReminders";

const NOW = new Date("2026-08-13T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const air = (over: Record<string, unknown> = {}) => ({
  status: "preparing",
  shippingType: "air_regular",
  awbNumber: null,
  containerNumber: null,
  createdAt: daysAgo(REMIND_AFTER_DAYS),
  ...over,
});
const sea = (over: Record<string, unknown> = {}) => air({ shippingType: "sea", ...over });

describe("which number a batch is missing", () => {
  it("asks a sea batch for a container and an air batch for a waybill", () => {
    // Asking a sea batch for a waybill is noise nobody can act on, and noise
    // is how a reminder system gets ignored.
    expect(missingShippingNumber(sea())).toBe("container");
    expect(missingShippingNumber(air())).toBe("awb");
  });

  it("treats every non-sea type as air", () => {
    expect(isSeaBatch("sea")).toBe(true);
    for (const type of ["air_regular", "air_irregular", null, undefined, ""]) {
      expect(isSeaBatch(type as string), String(type)).toBe(false);
    }
  });

  it("is satisfied once the right number is present", () => {
    expect(missingShippingNumber(air({ awbNumber: "176-48293011" }))).toBeNull();
    expect(missingShippingNumber(sea({ containerNumber: "MSCU1234566" }))).toBeNull();
  });

  it("does not accept the other type's number", () => {
    // A container number on an air batch leaves the waybill still missing.
    expect(missingShippingNumber(air({ containerNumber: "MSCU1234566" }))).toBe("awb");
    expect(missingShippingNumber(sea({ awbNumber: "176-48293011" }))).toBe("container");
  });

  it("treats blank and whitespace as missing", () => {
    for (const value of ["", "   ", null, undefined]) {
      expect(missingShippingNumber(air({ awbNumber: value })), JSON.stringify(value)).toBe("awb");
    }
  });
});

describe("how overdue a batch is", () => {
  it("stays quiet during the grace period", () => {
    expect(reminderSeverity(air({ createdAt: daysAgo(REMIND_AFTER_DAYS - 1) }), NOW)).toBe("none");
    expect(reminderSeverity(air({ createdAt: daysAgo(0) }), NOW)).toBe("none");
  });

  it("speaks up once the grace period is over", () => {
    expect(reminderSeverity(air({ createdAt: daysAgo(REMIND_AFTER_DAYS) }), NOW)).toBe("due");
    expect(reminderSeverity(air({ createdAt: daysAgo(URGENT_AFTER_DAYS - 1) }), NOW)).toBe("due");
  });

  it("escalates when it has been ignored for a fortnight", () => {
    expect(reminderSeverity(air({ createdAt: daysAgo(URGENT_AFTER_DAYS) }), NOW)).toBe("urgent");
    expect(reminderSeverity(air({ createdAt: daysAgo(60) }), NOW)).toBe("urgent");
  });

  it("says nothing once the number is filled in", () => {
    expect(reminderSeverity(air({ createdAt: daysAgo(60), awbNumber: "176-48293011" }), NOW)).toBe("none");
  });

  it("stops chasing a batch whose journey is over", () => {
    // Whatever was or was not recorded, chasing a delivered shipment helps
    // nobody — and a reminder that cannot be acted on trains people to
    // ignore the rest.
    for (const status of ["delivered", "closed"]) {
      expect(reminderSeverity(air({ status, createdAt: daysAgo(60) }), NOW), status).toBe("none");
    }
    // But one still in the air is very much worth chasing.
    for (const status of ["preparing", "in_transit", "arrived", "customs", "at_depot"]) {
      expect(reminderSeverity(air({ status, createdAt: daysAgo(60) }), NOW), status).toBe("urgent");
    }
  });

  it("counts whole days, however the date arrives", () => {
    expect(daysSinceCreated({ createdAt: daysAgo(7) }, NOW)).toBe(7);
    expect(daysSinceCreated({ createdAt: daysAgo(7).toISOString() }, NOW)).toBe(7);
    // Half a day is not a day.
    expect(daysSinceCreated({ createdAt: new Date(NOW.getTime() - 12 * 60 * 60 * 1000) }, NOW)).toBe(0);
  });

  it("treats a missing or unreadable date as brand new", () => {
    // Better to say nothing than to raise an urgent alarm about a batch whose
    // age we cannot establish.
    expect(daysSinceCreated({ createdAt: null }, NOW)).toBe(0);
    expect(daysSinceCreated({ createdAt: "not a date" }, NOW)).toBe(0);
    expect(reminderSeverity(air({ createdAt: null }), NOW)).toBe("none");
  });
});

describe("the list of batches to chase", () => {
  it("returns only the overdue ones, most overdue first", () => {
    const batches = [
      { id: 1, ...air({ createdAt: daysAgo(6) }) },
      { id: 2, ...air({ createdAt: daysAgo(30) }) },
      { id: 3, ...air({ createdAt: daysAgo(1) }) },
      { id: 4, ...sea({ createdAt: daysAgo(20) }) },
      { id: 5, ...air({ createdAt: daysAgo(40), awbNumber: "176-48293011" }) },
      { id: 6, ...air({ createdAt: daysAgo(40), status: "delivered" }) },
    ];
    const result = batchesAwaitingShippingNumber(batches, NOW);
    expect(result.map((r) => r.id)).toEqual([2, 4, 1]);
    expect(result.map((r) => r.severity)).toEqual(["urgent", "urgent", "due"]);
    expect(result[0].daysWaiting).toBe(30);
  });

  it("is empty when there is nothing to chase", () => {
    expect(batchesAwaitingShippingNumber([], NOW)).toEqual([]);
    expect(batchesAwaitingShippingNumber([air({ awbNumber: "176-48293011" })], NOW)).toEqual([]);
  });
});
