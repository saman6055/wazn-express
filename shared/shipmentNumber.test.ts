import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  batchHasShipmentNumber,
  batchAwaitingShipmentNumber,
  shipmentNumberName,
} from "./parcelStage";

/**
 * The number a shipment travels under is what tells a customer their goods
 * have left China (owner, 2026-10-24). One rule, and the people who can
 * fill it in are shown every batch still missing it — because without it
 * every parcel inside reads "in the China depot" on the customer's phone,
 * which is the telephone call this was all meant to stop.
 */

const air = { shippingType: "air_regular" };
const sea = { shippingType: "sea" };
const packed = { dispatchCheckedAt: new Date("2026-10-20T08:00:00Z") };

describe("has this shipment left", () => {
  it("air travels under its waybill, sea under its container", () => {
    expect(batchHasShipmentNumber({ ...air, awbNumber: "176-55512345" })).toBe(true);
    expect(batchHasShipmentNumber({ ...sea, containerNumber: "MSKU7781234" })).toBe(true);
  });

  it("the other kind's number does not count", () => {
    // A container number typed on an air batch is somebody's mistake, not a
    // departure; the waybill is what that batch flies under.
    expect(batchHasShipmentNumber({ ...air, containerNumber: "MSKU7781234" })).toBe(false);
    expect(batchHasShipmentNumber({ ...sea, awbNumber: "176-55512345" })).toBe(false);
  });

  it("blank, spaces and nothing are all no number", () => {
    expect(batchHasShipmentNumber({ ...air, awbNumber: "" })).toBe(false);
    expect(batchHasShipmentNumber({ ...air, awbNumber: "   " })).toBe(false);
    expect(batchHasShipmentNumber({ ...air, awbNumber: null })).toBe(false);
    expect(batchHasShipmentNumber(air)).toBe(false);
    expect(batchHasShipmentNumber(null)).toBe(false);
  });
});

describe("which batches to put in front of the China team", () => {
  it("packed, no number, not here yet", () => {
    expect(batchAwaitingShipmentNumber({ ...air, ...packed })).toBe(true);
    expect(batchAwaitingShipmentNumber({ ...sea, ...packed, status: "in_transit" })).toBe(true);
  });

  it("not before the cartons are checked — nobody could have the number yet", () => {
    expect(batchAwaitingShipmentNumber(air)).toBe(false);
    expect(batchAwaitingShipmentNumber({ ...air, dispatchCheckedAt: null })).toBe(false);
  });

  it("not once it has the number", () => {
    expect(batchAwaitingShipmentNumber({ ...air, ...packed, awbNumber: "176-55512345" })).toBe(false);
    expect(batchAwaitingShipmentNumber({ ...sea, ...packed, containerNumber: "MSKU7781234" })).toBe(false);
  });

  it("not once the shipment is here — what it travelled under no longer matters", () => {
    for (const status of ["arrived", "customs", "at_depot", "delivered", "closed"]) {
      expect(batchAwaitingShipmentNumber({ ...air, ...packed, status }), status).toBe(false);
    }
  });
});

describe("the number is named by how the batch travels", () => {
  it("in all four languages", () => {
    for (const t of ["air_regular", "sea"]) {
      const n = shipmentNumberName(t);
      expect(n.ku && n.en && n.ar && n.zh, t).toBeTruthy();
    }
    expect(shipmentNumberName("sea").en).toMatch(/container/i);
    expect(shipmentNumberName("air_regular").en).toMatch(/waybill/i);
  });
});

describe("one rule, read everywhere it matters", () => {
  const root = path.join(__dirname, "..");
  const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

  it("the parcel's timeline and the home screen's cards both ask it", () => {
    // They used to disagree: the timeline read the waybill, the cards read
    // a status a person moves by hand.
    expect(read("server/db/portal.db.ts")).toContain("batchHasShipmentNumber(row)");
    expect(read("client/src/lib/portalSearch.ts")).toContain("batchHasShipmentNumber(batch)");
  });

  it("the batch list carries the carton date, or the badge can never show", () => {
    expect(read("server/db/batches.db.ts")).toContain("dispatchCheckedAt: batches.dispatchCheckedAt");
  });

  it("the batch list flags it, and the carton screen asks for it on finishing", () => {
    expect(read("client/src/pages/Batches.tsx")).toContain("batchAwaitingShipmentNumber(");
    const dispatch = read("client/src/pages/DispatchCheck.tsx");
    const at = dispatch.indexOf("dispatch.finish.useMutation");
    expect(at).toBeGreaterThan(-1);
    expect(dispatch.slice(at, dispatch.indexOf("onError", at))).toContain("batchHasShipmentNumber(s?.batch)");
  });
});

describe("a parcel packed for the carrier says so", () => {
  const root = path.join(__dirname, "..");
  const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

  it("the words stop short of saying it has left", () => {
    const src = read("client/src/lib/packageStatus.ts");
    expect(src).toContain('packed: { ku: "ئامادەکاری گواستنەوە"');
    expect(src).toContain("if (parcel.inCarton) return PARCEL_WHERE_WORDS.packed;");
  });

  it("the fact comes from the carton table, for the customer's own parcels", () => {
    expect(read("server/db/dispatch.db.ts")).toContain("export async function packagesInCartons(");
    expect(read("server/db/portal.db.ts")).toContain("inCarton: packed.has(Number(row.id))");
  });
});
