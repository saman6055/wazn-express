import { describe, expect, it } from "vitest";
import {
  PARCEL_STAGES,
  PARCEL_STAGE_LABELS,
  parcelStage,
  stageIndex,
  stagesFor,
  endingOf,
} from "./parcelStage";

/**
 * The owner, 2026-09-25, spelling the rule out event by event:
 *
 *   "Whatever admin Ako scanned and quick-registered — that means it was
 *    received in China, and the batch made there was made in China. Then Ako
 *    filled in the batch's tracking field — that means it is on the way. After
 *    it reached Erbil and we did the arrival verification scan in the scan
 *    section — that means it has arrived in Erbil and is being prepared for
 *    the customer. After a box was made for the customer — that means it is
 *    ready for distribution, and a notice goes to that customer that their
 *    goods are ready to be sent or collected. After the box was paid for —
 *    that means the goods reached the customer, and the customer can confirm
 *    receipt themselves in their portal."
 *
 * Five events, all of them already recorded, none of them needing a third
 * party to say anything.
 */

const inChina = { registeredAtOrigin: true };
const inErbil = { registeredAtOrigin: false };

describe("the five events", () => {
  it("registered by us is received, batch or no batch", () => {
    expect(parcelStage(inChina)).toBe("received");
    // Being put in a batch is not a stage of its own: the batch is made in
    // the same warehouse the parcel is already sitting in.
    expect(parcelStage({ ...inChina, batch: { status: "preparing" } })).toBe("received");
  });

  it("the batch's tracking is what says it left", () => {
    expect(parcelStage({ ...inChina, batch: { hasShipmentTracking: true } })).toBe("in_transit");
    // Not the batch's own status, which somebody has to remember to change.
    expect(parcelStage({ ...inChina, batch: { status: "in_transit" } })).toBe("received");
  });

  it("a verified arrival is what says it is here", () => {
    for (const status of ["arrived", "customs", "at_depot", "delivered", "closed"]) {
      expect(parcelStage({ ...inChina, batch: { status } }), status).toBe("arrived");
    }
  });

  it("a box makes it ready, and paying for the box delivers it", () => {
    expect(parcelStage({ ...inChina, box: { status: "open" } })).toBe("ready");
    expect(parcelStage({ ...inChina, box: { status: "delivered", paidInFull: true } })).toBe("delivered");
  });

  it("takes the furthest thing that is true, never the latest write", () => {
    // A batch still marked "preparing" cannot hold back a parcel that is
    // already boxed and paid for — which is exactly the drift he was seeing.
    expect(
      parcelStage({ ...inChina, batch: { status: "preparing" }, box: { paidInFull: true } }),
    ).toBe("delivered");
  });
});

describe("a parcel that never left Erbil", () => {
  it("has three stages, not five", () => {
    expect(stagesFor(inErbil)).toEqual(["received", "ready", "delivered"]);
    expect(stagesFor(inChina)).toEqual([...PARCEL_STAGES]);
    // Unrecorded means China: everything from before the location was kept.
    expect(stagesFor({})).toEqual([...PARCEL_STAGES]);
  });

  it("is never walked through a journey it did not take", () => {
    // Registered, boxed and sent the same day. "On the way" and "arrived"
    // would be describing a flight it was never on.
    expect(parcelStage({ ...inErbil, batch: { hasShipmentTracking: true } })).toBe("received");
    expect(parcelStage({ ...inErbil, batch: { status: "at_depot" } })).toBe("received");
    expect(parcelStage({ ...inErbil, box: {} })).toBe("ready");
  });
});

describe("the two endings", () => {
  it("win over everything, because a person decided them", () => {
    expect(parcelStage({ ...inChina, status: "returned", box: { paidInFull: true } })).toBe("returned");
    expect(parcelStage({ ...inChina, status: "cancelled" })).toBe("cancelled");
    expect(endingOf({ status: "delivered" })).toBe(null);
  });

  it("are not a place on the road", () => {
    expect(stageIndex({ ...inChina, status: "returned" })).toBe(-1);
  });
});

describe("how far along", () => {
  it("counts against the stages this parcel actually has", () => {
    expect(stageIndex({ ...inChina, box: { paidInFull: true } })).toBe(4);
    // The same parcel, registered in Erbil: the last of three.
    expect(stageIndex({ ...inErbil, box: { paidInFull: true } })).toBe(2);
  });
});

describe("what they are called", () => {
  it("has four languages for every stage and both endings", () => {
    for (const stage of [...PARCEL_STAGES, "returned", "cancelled"] as const) {
      const label = PARCEL_STAGE_LABELS[stage];
      expect(label, stage).toBeTruthy();
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(label[lang].length, `${stage}.${lang}`).toBeGreaterThan(1);
      }
    }
  });

  it("says nothing about customs, which nothing can observe", () => {
    expect(Object.keys(PARCEL_STAGE_LABELS)).not.toContain("customs_processing");
    expect(PARCEL_STAGES as readonly string[]).not.toContain("customs_processing");
  });
});
