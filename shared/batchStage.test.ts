import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  batchMadeInChina,
  batchStage,
  customerBatchStage,
  customerStagesFor,
  manualMoveAllowed,
  nextStoredStatus,
  stagesForBatch,
  type BatchStatusFacts,
} from "./batchStage";

/** The owner's stages, 2026-10-28: each from one real event, never back. */
const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const china = (over: Partial<BatchStatusFacts>): BatchStatusFacts => ({
  status: "preparing", madeInChina: true, hasShipmentNumber: false, hasTwin: false, packageCount: 5, arrivalScans: 0, ...over,
});
const H = 3600_000;

describe("the stored status moves itself", () => {
  it("AIR-2026-072GZ: a waybill means on the road", () => {
    expect(nextStoredStatus(china({ hasShipmentNumber: true }))).toBe("in_transit");
  });

  it("an Erbil twin means the China batch flew", () => {
    expect(nextStoredStatus(china({ hasTwin: true }))).toBe("in_transit");
  });

  it("the first arrival scan means the Erbil depot - but only of a batch that travelled", () => {
    expect(nextStoredStatus(china({ status: "in_transit", hasShipmentNumber: true, arrivalScans: 1 }))).toBe("at_depot");
    expect(nextStoredStatus(china({ status: "customs", hasShipmentNumber: true, arrivalScans: 1 }))).toBe("at_depot");
    expect(nextStoredStatus(china({ arrivalScans: 3 }))).toBeNull();
  });

  it("an Erbil batch with a parcel registered is in the Erbil depot", () => {
    expect(nextStoredStatus(china({ madeInChina: false, packageCount: 1 }))).toBe("at_depot");
    expect(nextStoredStatus(china({ madeInChina: false, packageCount: 0 }))).toBeNull();
  });

  it("never back, never past a close", () => {
    expect(nextStoredStatus(china({ status: "at_depot", hasShipmentNumber: true }))).toBeNull();
    expect(nextStoredStatus(china({ status: "customs", hasShipmentNumber: true }))).toBeNull();
    expect(nextStoredStatus(china({ status: "closed", madeInChina: false }))).toBeNull();
    expect(nextStoredStatus(china({ status: "delivered", hasShipmentNumber: true, arrivalScans: 9 }))).toBeNull();
  });

  it("an old batch with no place recorded is a China batch - not swept to Erbil", () => {
    const cn = new Set([1]);
    expect(batchMadeInChina(null, cn)).toBe(true);
    expect(batchMadeInChina(1, cn)).toBe(true);
    expect(batchMadeInChina(2, cn)).toBe(false);
  });
});

describe("a person adds only customs and the close", () => {
  it("customs only while on the road; close from anywhere open", () => {
    expect(manualMoveAllowed("in_transit", "customs")).toBe(true);
    expect(manualMoveAllowed("preparing", "customs")).toBe(false);
    expect(manualMoveAllowed("at_depot", "closed")).toBe(true);
    expect(manualMoveAllowed("closed", "closed")).toBe(false);
    for (const to of ["preparing", "in_transit", "arrived", "at_depot", "delivered"]) {
      expect(manualMoveAllowed("in_transit", to), to).toBe(false);
    }
  });
});

describe("the stage shown", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  it("China depot, then packed once the carton check is done", () => {
    expect(batchStage({ status: "preparing" }, now)).toBe("china_depot");
    expect(batchStage({ status: "preparing", dispatchCheckedAt: "2026-10-20" }, now)).toBe("packed");
  });

  it("ready to distribute 40 hours after the LAST scan", () => {
    const at = (h: number) => new Date(now.getTime() - h * H);
    expect(batchStage({ status: "at_depot", lastArrivalAt: at(39) }, now)).toBe("erbil_depot");
    expect(batchStage({ status: "at_depot", lastArrivalAt: at(40) }, now)).toBe("ready");
    expect(batchStage({ status: "at_depot" }, now)).toBe("erbil_depot");
  });

  it("the old words fold into the new: arrived is Erbil, delivered is ready", () => {
    expect(batchStage({ status: "arrived" }, now)).toBe("erbil_depot");
    expect(batchStage({ status: "delivered" }, now)).toBe("ready");
  });

  it("an Erbil batch starts in Erbil; customs shows only when it happened", () => {
    expect(stagesForBatch(false, "erbil_depot")).toEqual(["erbil_depot", "ready", "closed"]);
    expect(stagesForBatch(true, "on_road")).not.toContain("customs");
    expect(stagesForBatch(true, "customs")).toContain("customs");
  });
});

describe("the portal reads the same stage", () => {
  it("their own parcels delivered: delivered, whatever the container does", () => {
    expect(customerBatchStage("delivered", {})).toBe("delivered");
    expect(customerBatchStage("closed", {})).toBe("delivered");
    expect(customerBatchStage("in_transit", {})).toBe("on_road");
    expect(customerStagesFor(true, "ready")).toEqual(["erbil_depot", "ready", "delivered"]);
  });

  it("the server sends it and the batch page draws it", () => {
    expect(root("server/db/portal.db.ts")).toContain("stage: customerBatchStage(customerStatus, {");
    expect(root("client/src/pages/portal/PortalBatchDetail.tsx")).toContain("customerStagesFor(");
  });
});

describe("wired", () => {
  it("the dropdown is gone; customs and close are the only buttons", () => {
    const page = root("client/src/pages/Batches.tsx");
    expect(page).not.toContain('<SelectItem value="at_depot">');
    expect(page).toContain('data-testid="batch-customs-button"');
    expect(page).toContain('data-testid="batch-close-button"');
  });

  it("the server refuses any other move by hand", () => {
    const r = root("server/routers/batches.router.ts");
    expect(r).toContain("!manualMoveAllowed(current.status, input.status)");
  });

  it("the facts move the batch where they are written, and a sweep catches the rest", () => {
    expect(root("server/routers/batches.router.ts").match(/syncBatchStageQuietly\(/g)?.length).toBe(2);
    expect(root("server/routers/packages.router.ts").match(/syncBatchStageQuietly\(/g)?.length).toBe(2);
    expect(root("server/routers/scanning.router.ts")).toContain("await syncBatchStageQuietly(input.batchId, ctx.user.id);");
    // In both entries - production starts from prod-entry, not index (2026-10-28).
    expect(root("server/_core/index.ts")).toContain("await startBatchStageSweep();");
    expect(root("server/_core/prod-entry.ts")).toContain("await startBatchStageSweep();");
  });
});
