import { describe, it, expect } from "vitest";
import {
  buildCustomerJourney,
  localDateKey,
  type JourneyData,
} from "./customerJourney";

/**
 * The journey lookup answers the commonest phone call the office gets:
 * "how many of my pieces are still missing?" These tests pin the chain the
 * answer walks — order → scan → batch → box — and the rule that the
 * physical record always outranks the paper one.
 */

const NOW = new Date("2026-09-08T12:00:00");

const empty: JourneyData = { packages: [], orders: [], declared: [], boxed: [], batches: [] };

const order = (over: Partial<JourneyData["orders"][number]> = {}) => ({
  id: 1,
  orderCode: "FP-1",
  orderType: "commission",
  status: "ordered",
  productName: "پێڵاو",
  trackingNumber: "SF111",
  trackingNumbers: null,
  photo: "product.jpg",
  createdAt: "2026-09-05T10:00:00",
  ...over,
});

const pkg = (over: Partial<JourneyData["packages"][number]> = {}) => ({
  id: 10,
  trackingNumber: "SF111",
  packageCode: "WZN-GZ-1",
  status: "in_batch",
  batchId: null,
  weightKg: "1.2",
  volumeCbm: null,
  photo: "scan.jpg",
  description: null,
  createdAt: "2026-09-06T10:00:00",
  ...over,
});

describe("the five stations", () => {
  it("an order nobody scanned has not arrived, however long ago it was bought", () => {
    const j = buildCustomerJourney({ ...empty, orders: [order()] }, NOW);
    expect(j.counts.not_arrived).toBe(1);
    expect(j.orderCohorts[0]!.items[0]!.waitingDays).toBe(3);
  });

  it("a scan puts it in China, and the batch carries it onward", () => {
    const inChina = buildCustomerJourney({ ...empty, orders: [order()], packages: [pkg()] }, NOW);
    expect(inChina.counts.in_china).toBe(1);
    expect(inChina.counts.not_arrived).toBe(0);

    const moving = buildCustomerJourney({
      ...empty,
      orders: [order()],
      packages: [pkg({ batchId: 5 })],
      batches: [{ id: 5, batchCode: "AIR-1", status: "in_transit", shippingType: "air_regular" }],
    }, NOW);
    expect(moving.counts.on_the_way).toBe(1);

    const erbil = buildCustomerJourney({
      ...empty,
      orders: [order()],
      packages: [pkg({ batchId: 5 })],
      batches: [{ id: 5, batchCode: "AIR-1", status: "at_depot", shippingType: "air_regular" }],
    }, NOW);
    expect(erbil.counts.in_iraq).toBe(1);
  });

  it("a packed box is still Erbil; only a delivered box is the customer's hands", () => {
    const packed = buildCustomerJourney({
      ...empty,
      packages: [pkg()],
      boxed: [{ packageId: 10, boxCode: "BOX-1", boxStatus: "ready" }],
    }, NOW);
    expect(packed.counts.in_iraq).toBe(1);

    const handed = buildCustomerJourney({
      ...empty,
      packages: [pkg()],
      boxed: [{ packageId: 10, boxCode: "BOX-1", boxStatus: "delivered" }],
    }, NOW);
    expect(handed.counts.delivered).toBe(1);
  });

  it("the physical record outranks the order row", () => {
    // The order still says "ordered", but the parcel is scanned and batched:
    // the shelf wins.
    const j = buildCustomerJourney({
      ...empty,
      orders: [order({ status: "ordered" })],
      packages: [pkg({ batchId: 5 })],
      batches: [{ id: 5, batchCode: "AIR-1", status: "in_transit", shippingType: "air_regular" }],
    }, NOW);
    expect(j.counts.on_the_way).toBe(1);
    expect(j.counts.not_arrived).toBe(0);
  });

  it("cancelled and returned parcels are nowhere on the road", () => {
    const j = buildCustomerJourney({ ...empty, packages: [pkg({ status: "cancelled" })] }, NOW);
    expect(Object.values(j.counts).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("one parcel, one row", () => {
  it("an order and a declaration for the same tracking count once", () => {
    const j = buildCustomerJourney({
      ...empty,
      orders: [order()],
      declared: [{ id: 2, trackingNumber: "SF111", status: "matched", productName: null, photo: null, createdAt: "2026-09-05T11:00:00" }],
      packages: [pkg()],
    }, NOW);
    expect(j.counts.in_china).toBe(1);
    expect(j.orderCohorts.flatMap(c => c.items)).toHaveLength(1);
  });

  it("a scan with no paper behind it still shows, as a direct scan", () => {
    const j = buildCustomerJourney({ ...empty, packages: [pkg({ trackingNumber: "YT999" })] }, NOW);
    expect(j.scanCohorts).toHaveLength(1);
    expect(j.scanCohorts[0]!.items[0]!.source).toBe("scan");
  });

  it("matches an order by its extra tracking numbers too", () => {
    const j = buildCustomerJourney({
      ...empty,
      orders: [order({ trackingNumber: null, trackingNumbers: ["ZTO7", "SF111"] })],
      packages: [pkg()],
    }, NOW);
    expect(j.counts.in_china).toBe(1);
    expect(j.scanCohorts).toHaveLength(0);
  });
});

describe("date cohorts", () => {
  it("groups by entry day, newest first, with the missing counted", () => {
    const j = buildCustomerJourney({
      ...empty,
      orders: [
        order({ id: 1, trackingNumber: "A1", createdAt: "2026-09-05T09:00:00" }),
        order({ id: 2, trackingNumber: "A2", createdAt: "2026-09-05T18:00:00" }),
        order({ id: 3, trackingNumber: "B1", createdAt: "2026-09-03T09:00:00" }),
      ],
      packages: [pkg({ id: 20, trackingNumber: "A2" })],
    }, NOW);
    expect(j.orderCohorts.map(c => c.date)).toEqual(["2026-09-05", "2026-09-03"]);
    const day5 = j.orderCohorts[0]!;
    expect(day5.items).toHaveLength(2);
    expect(day5.arrived).toBe(1);
    expect(day5.pending).toBe(1);
    // The missing one floats to the top of its day.
    expect(day5.items[0]!.station).toBe("not_arrived");
  });

  it("keys cohorts by the office clock's calendar day", () => {
    expect(localDateKey(new Date("2026-09-05T00:30:00"))).toBe("2026-09-05");
  });
});

describe("the box carries its dates", () => {
  it("a delivered box stamps the handover date; a packed one only its packing date", () => {
    const handed = buildCustomerJourney({
      ...empty,
      packages: [pkg()],
      boxed: [{ packageId: 10, boxCode: "BOX-1", boxStatus: "delivered", boxCreatedAt: "2026-09-07T09:00:00", boxDeliveredAt: "2026-09-08T15:30:00" }],
    }, NOW);
    const a = handed.orderCohorts.concat(handed.scanCohorts).flatMap(c => c.items)[0]!;
    expect(a.boxCode).toBe("BOX-1");
    expect(a.boxStatus).toBe("delivered");
    expect(a.deliveredAt?.toISOString()).toBe(new Date("2026-09-08T15:30:00").toISOString());

    const packed = buildCustomerJourney({
      ...empty,
      packages: [pkg()],
      boxed: [{ packageId: 10, boxCode: "BOX-2", boxStatus: "ready", boxCreatedAt: "2026-09-07T09:00:00", boxDeliveredAt: null }],
    }, NOW);
    const b = packed.orderCohorts.concat(packed.scanCohorts).flatMap(c => c.items)[0]!;
    expect(b.boxStatus).toBe("ready");
    expect(b.boxDate?.toISOString()).toBe(new Date("2026-09-07T09:00:00").toISOString());
    expect(b.deliveredAt).toBeNull();
  });
});

describe("photos", () => {
  it("prefers the shop photo, falls back to the scan photo and says which it was", () => {
    const withProduct = buildCustomerJourney({ ...empty, orders: [order()], packages: [pkg()] }, NOW);
    const a = withProduct.orderCohorts[0]!.items[0]!;
    expect(a.photo).toBe("product.jpg");
    expect(a.scanPhoto).toBe(false);

    const scanOnly = buildCustomerJourney({ ...empty, orders: [order({ photo: null })], packages: [pkg()] }, NOW);
    const b = scanOnly.orderCohorts[0]!.items[0]!;
    expect(b.photo).toBe("scan.jpg");
    expect(b.scanPhoto).toBe(true);
  });
});
