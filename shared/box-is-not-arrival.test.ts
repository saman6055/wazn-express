import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { BATCH_ARRIVED_STATUSES, goodsCouldBeHere, parcelStage } from "./parcelStage";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26, on AIR-2026-041: the shipment said «لە کۆگای چین»
 * and every parcel inside it said «ئامادەیە بۆ وەرگرتن». A customer reading
 * that drives to the office for goods that have not left China.
 *
 * Both came from the same fact read two ways: a box had been built from the
 * batch before it flew, and a box existing was treated as proof the goods
 * were in Erbil.
 */
describe("a box is not proof the goods are here", () => {
  const box = { status: "open" };

  it("does not make a parcel ready while its batch is still in China", () => {
    expect(parcelStage({ box, batch: { status: "preparing" } })).toBe("received");
    expect(goodsCouldBeHere({ batch: { status: "preparing" } })).toBe(false);
  });

  it("does not make it ready while the batch is in the air", () => {
    expect(parcelStage({ box, batch: { status: "in_transit", hasShipmentTracking: true } })).toBe("in_transit");
  });

  it("does make it ready once the batch has reached Erbil", () => {
    for (const status of BATCH_ARRIVED_STATUSES) {
      expect(parcelStage({ box, batch: { status } }), status).toBe("ready");
    }
  });

  it("leaves a parcel that never travelled alone", () => {
    // Registered in Erbil, boxed and sent the same day: there is no journey.
    expect(parcelStage({ box, registeredAtOrigin: false })).toBe("ready");
    // Boxed at the counter with no batch at all: it is here.
    expect(parcelStage({ box })).toBe("ready");
  });

  it("still finishes a box that was paid for", () => {
    // Paid in full outranks everything: the goods are with the customer.
    expect(parcelStage({ box: { status: "delivered", paidInFull: true }, batch: { status: "preparing" } }))
      .toBe("delivered");
  });
});

describe("the same question, asked in the other two places", () => {
  it("by the chip, before it says Erbil", () => {
    const words = read("client/src/lib/packageStatus.ts");
    const branch = words.slice(words.indexOf('case "ready_for_delivery"'), words.indexOf('case "in_transit"'));
    expect(branch.length).toBeGreaterThan(20);
    expect(branch).toContain("goodsCouldBeHere({ batch: { status: batchStatus } })");
    expect(branch).toContain("PARCEL_WHERE_WORDS.china");
    // With no batch known the stamp stands: it was boxed at the counter.
    expect(branch).toContain("return PARCEL_WHERE_WORDS.erbil;");
    // And the caller hands it the batch it already carries.
    expect(read("client/src/components/portal/portalSearchChip.ts"))
      .toContain("originCountries, item.batch?.status)");
  });

  it("by the counter, before it stamps one", () => {
    const scanner = read("server/routers/scanning.router.ts");
    expect(scanner).toContain("BATCH_ARRIVED_STATUSES");
    expect(scanner).toContain("const batchHere = !pkg?.batchId || BATCH_ARRIVED_STATUSES.includes(");
    expect(scanner).toContain("if (pkg?.id && batchHere) {");
  });

  it("from one list, so they cannot disagree", () => {
    expect([...BATCH_ARRIVED_STATUSES]).toEqual(["arrived", "customs", "at_depot", "delivered", "closed"]);
  });
});
