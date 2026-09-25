import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { STATUS_LABEL, BATCH_STATUS_TONE } from "./lib/shipmentFilters";
import { PACKAGE_STATUS_LABEL } from "./lib/packageStatus";
import { PARCEL_STAGES, PARCEL_STAGE_LABELS } from "@shared/parcelStage";

/**
 * One status, one name, one meaning — on every portal screen.
 *
 * Phase-two audit (2026-09-10): an order that reached Iraq was counted as
 * delivered on the orders page and as on the way on the shipments page;
 * «گەیشت» named both; "delivered" had four Kurdish spellings; the office's
 * word «باچ» sat in customer labels; a cancelled registration read "awaiting
 * arrival"; five box states collapsed into two.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

function line(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("\n", at));
}

describe("an order that reached Iraq is not delivered", () => {
  const page = read("pages/portal/PortalFullPackage.tsx");

  it("is named the way the shipments page names it", () => {
    expect(page).toContain(`labelKu: "${STATUS_LABEL.arrived.ku}"`);
    expect(page).toContain(`label: "${STATUS_LABEL.arrived.en}"`);
  });

  it("is counted as on the way, never as delivered", () => {
    expect(line(page, 'if (statusFilter === "delivered") return [')).not.toContain('"arrived"');
    expect(line(page, 'if (statusFilter === "in_transit") return [')).toContain('"arrived"');
    expect(line(page, "delivered: allOrders.filter(")).not.toContain('"arrived"');
  });
});

describe("delivered has one name", () => {
  const word = STATUS_LABEL.delivered.ku;

  it("parcels and shipments agree", () => {
    expect(PACKAGE_STATUS_LABEL.delivered.ku).toBe(word);
  });

  it("the shipments pill and the orders page agree", () => {
    expect(line(read("pages/portal/PortalShipments.tsx"), '{ value: "delivered",')).toContain(`labelKu: "${word}"`);
    expect(line(read("pages/portal/PortalShipments.tsx"), '{ value: "delivered",')).not.toContain('"Arrived"');
    expect(read("pages/portal/PortalFullPackage.tsx")).toContain(`{ key: "delivered", ku: "${word}"`);
  });

  it("and the timeline takes its words from the one place that names a stage", () => {
    /*
     * The timeline stopped keeping its own list (2026-09-25). Its seven
     * steps were cut to the five the system can actually observe, and their
     * names live in shared/parcelStage beside the rule that picks one — so
     * there is one spelling of each rather than a copy per screen.
     */
    const timeline = read("components/portal/PackageTrackingTimeline.tsx");
    expect(timeline).toContain("PARCEL_STAGE_LABELS[stage.key]");
    expect(timeline).not.toMatch(/label: \{ ku:/);
  });

  it("no longer shows a step the system cannot observe", () => {
    // "Out for delivery" was never set by anything; a box that exists is
    // going out, so it is the same as ready. Customs was a guess made the
    // morning after a landing, from a flight number a third party often
    // never sends.
    for (const gone of ["out_for_delivery", "customs_processing", "in_batch"]) {
      expect(PARCEL_STAGES as readonly string[], gone).not.toContain(gone);
    }
    // Five stages and the two endings, and nothing else with a name.
    expect(Object.keys(PARCEL_STAGE_LABELS)).toHaveLength(PARCEL_STAGES.length + 2);
  });
});

describe("customer labels use the customer's words", () => {
  it("no status label says «باچ»", () => {
    for (const label of [...Object.values(PACKAGE_STATUS_LABEL), ...Object.values(STATUS_LABEL)]) {
      expect(label.ku).not.toContain("باچ");
    }
    for (const file of ["pages/portal/PortalFullPackage.tsx", "components/portal/PackageTrackingTimeline.tsx", "pages/portal/PortalShipments.tsx", "pages/portal/PortalFinancial.tsx"]) {
      const offenders = [...read(file).matchAll(/(?:ku|labelKu):\s*"([^"]*باچ[^"]*)"/g)].map((m) => m[1]);
      expect(offenders, `${file} still says «باچ»`).toEqual([]);
    }
  });

  it("a completed shipment is called completed and coloured like delivered", () => {
    expect(STATUS_LABEL.closed.en).toBe("Completed");
    expect(BATCH_STATUS_TONE.closed).toContain("emerald");
  });

  it("a parcel registered in Erbil is not told it is in China", () => {
    expect(PACKAGE_STATUS_LABEL.registered.ku).not.toContain("چین");
    expect(PACKAGE_STATUS_LABEL.registered.en).not.toContain("China");
  });
});

describe("every state has its own name", () => {
  it("a cancelled registration does not read as awaiting arrival", () => {
    const page = read("pages/portal/PortalDeclarePackage.tsx");
    expect(page).toMatch(/cancelled: \{ cls: "bg-slate-/);
    expect(page).toContain('d.status === "cancelled"');
  });

  it("each delivery-box state has a label", () => {
    const src = read("components/portal/MyDeliveryBoxes.tsx");
    const map = src.slice(src.indexOf("const BOX_STATUS_LABEL"), src.indexOf("function DeliveryProof("));
    for (const status of ["open", "ready", "in_transit", "delivered", "cancelled"]) {
      expect(map, `${status} has no label`).toContain(`${status}: { ku:`);
    }
  });

  it("the printed invoice styles unpaid as pending, not cancelled", () => {
    expect(read("pages/portal/PortalFinancial.tsx")).toContain("'status-pending'");
  });
});
