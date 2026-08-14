import { describe, expect, it } from "vitest";
import {
  JOURNEY_STAGES,
  passesThroughOrigin,
  progressIndex,
  stageReachedBy,
  stagesFor,
} from "./packageJourney";

/**
 * The complaint this was written for: a parcel quick-registered at the China
 * depot, sitting in that warehouse, whose timeline read "Registered" and
 * showed "At China warehouse" as still to come — while the notification for
 * that same scan had already told the customer it had arrived there.
 */

const inChina = { registeredAtOrigin: true };
const inErbil = { registeredAtOrigin: false };
const unknown = {};

describe("whether a parcel went through China at all", () => {
  it("says yes when it was registered there", () => {
    expect(passesThroughOrigin(inChina)).toBe(true);
  });

  it("says no when it was registered in Erbil", () => {
    // Some customers' goods arrive in Erbil directly and ship from there
    // within two days. Those are never in China.
    expect(passesThroughOrigin(inErbil)).toBe(false);
  });

  it("assumes China when nothing was recorded", () => {
    // Everything registered before the location stamp existed went through
    // the China depot — that is what the system was built around.
    expect(passesThroughOrigin(unknown)).toBe(true);
    expect(passesThroughOrigin({ registeredAtOrigin: null })).toBe(true);
    expect(passesThroughOrigin({ registeredAtOrigin: undefined })).toBe(true);
  });
});

describe("the stages a journey has", () => {
  it("includes the China warehouse for a parcel that was there", () => {
    expect(stagesFor(inChina)).toEqual([...JOURNEY_STAGES]);
    expect(stagesFor(unknown)).toEqual([...JOURNEY_STAGES]);
  });

  it("drops it for a parcel registered in Erbil", () => {
    // A step that can never complete is worse than no step: it promises
    // something that is not coming.
    const stages = stagesFor(inErbil);
    expect(stages).not.toContain("received_china");
    expect(stages).toHaveLength(JOURNEY_STAGES.length - 1);
  });

  it("keeps every other stage, in order, either way", () => {
    for (const context of [inChina, inErbil, unknown]) {
      const stages = stagesFor(context);
      expect(stages[0]).toBe("registered");
      expect(stages[stages.length - 1]).toBe("delivered");
      // Still a subsequence of the canonical order.
      const positions = stages.map((s) => JOURNEY_STAGES.indexOf(s));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });
});

describe("what registering actually reaches", () => {
  it("reaches the China warehouse when that is where it happened", () => {
    // The two are one event. The notification for this scan already says so.
    expect(stageReachedBy("registered", inChina)).toBe("received_china");
    expect(stageReachedBy("registered", unknown)).toBe("received_china");
  });

  it("reaches only 'registered' when it happened in Erbil", () => {
    expect(stageReachedBy("registered", inErbil)).toBe("registered");
  });

  it("leaves every later stage alone", () => {
    for (const stage of JOURNEY_STAGES.filter((s) => s !== "registered")) {
      expect(stageReachedBy(stage, inChina), stage).toBe(stage);
      expect(stageReachedBy(stage, inErbil), stage).toBe(stage);
    }
  });
});

describe("how far along the parcel is", () => {
  it("puts a China-registered parcel at the warehouse, not before it", () => {
    // The bug itself: it sat at step one of seven, one short of a warehouse
    // it was already inside.
    expect(progressIndex("registered", inChina)).toBe(1);
    expect(stagesFor(inChina)[1]).toBe("received_china");
  });

  it("puts an Erbil-registered parcel at the first step of its own journey", () => {
    expect(progressIndex("registered", inErbil)).toBe(0);
    expect(stagesFor(inErbil)[0]).toBe("registered");
  });

  it("counts later stages against the journey the parcel actually has", () => {
    // The Erbil journey is one shorter, so the same stage sits one earlier.
    expect(progressIndex("in_batch", inChina)).toBe(2);
    expect(progressIndex("in_batch", inErbil)).toBe(1);
    expect(progressIndex("delivered", inChina)).toBe(JOURNEY_STAGES.length - 1);
    expect(progressIndex("delivered", inErbil)).toBe(JOURNEY_STAGES.length - 2);
  });

  it("refuses to place a parcel that is not on this road", () => {
    // Returned and cancelled are handled separately. Returning 0 would show
    // them sitting cheerfully at step one.
    for (const status of ["returned", "cancelled", "", "nonsense"]) {
      expect(progressIndex(status, inChina), status).toBe(-1);
    }
  });
});
