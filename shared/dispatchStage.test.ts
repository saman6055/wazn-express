import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { dispatchStage, leftChinaNotice, leftChinaWhatsApp, parcelHasArrived } from "./dispatchStage";

/**
 * A packed batch's stage follows what happened (owner, 2026-10-26): blue
 * packing, orange left China, red in Erbil with parcels missing, green all
 * arrived. Nobody sets it.
 */
const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the four stages", () => {
  it("in order, from the recorded events", () => {
    expect(dispatchStage({ finished: false, packed: 10, arrived: 0 })).toBe("packing");
    expect(dispatchStage({ finished: true, packed: 10, arrived: 0 })).toBe("left");
    expect(dispatchStage({ finished: true, packed: 10, arrived: 7 })).toBe("arriving");
    expect(dispatchStage({ finished: true, packed: 10, arrived: 10 })).toBe("arrived");
  });

  it("a parcel handed over without an arrival scan has arrived (AIR-2026-069GZ's 18)", () => {
    expect(parcelHasArrived({ scannedIn: false, status: "delivered" })).toBe(true);
    expect(parcelHasArrived({ scannedIn: false, status: "ready_for_delivery" })).toBe(true);
    expect(parcelHasArrived({ scannedIn: false, status: "in_transit" })).toBe(false);
    expect(parcelHasArrived({ scannedIn: true, status: "in_transit" })).toBe(true);
  });
});

describe("what the customer is told", () => {
  it("no arrival date is promised", () => {
    const n = leftChinaNotice("AIR-2026-075GZ", 12);
    expect(n.ku).toContain("12 پاکێجت لە چینەوە نێردرا لە باچی AIR-2026-075GZ");
    for (const s of [n.ku, n.en, n.ar, n.zh]) expect(s).not.toMatch(/\d{1,2}\/\d{1,2}/);
  });

  it("the WhatsApp message names them and lists their trackings", () => {
    const m = leftChinaWhatsApp("Xarman", "AIR-2026-075GZ", ["YT1", "SF2"]);
    expect(m.startsWith("سڵاو بەڕێز Xarman")).toBe(true);
    expect(m).toContain("• YT1");
    expect(m).toContain("• SF2");
  });

  it("the portal is told by itself when the check is finished, once per customer", () => {
    const r = root("server/routers/dispatch.router.ts");
    expect(r.slice(r.indexOf("finish: staffProcedure"))).toContain("void db.notifyLeftChina(input.batchId)");
    const db = root("server/db/dispatchInsight.db.ts");
    expect(db).toContain("if (!customerId || already.has(customerId)) continue;");
  });
});

describe("on the page", () => {
  it("cards in the stage's colour, details on a click, the search above", () => {
    const page = root("client/src/components/dispatch/DispatchHistory.tsx");
    expect(page).toContain("data-stage={r.stage}");
    expect(page).toContain("{expanded && <DispatchDetails batchId={r.batchId} batchCode={r.batchCode} />}");
    expect(page).toContain("<WhereIsMyParcel />");
    expect(page).toContain('data-testid="dispatch-second-load"');
  });
});
