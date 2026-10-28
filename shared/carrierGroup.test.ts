import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { groupDifferenceUsd, groupVerdict, normalizeCarrierBatchNo, splitGroupInvoice, twinBatchCode } from "./carrierGroup";
import { publicAirlineName, publicAwb } from "./publicCarrier";

/** One carrier shipment, several of our batches (owner, 2026-10-28). */
const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the group", () => {
  it("one number however it is typed", () => {
    for (const v of ["ANC 169", "anc 169", "ANC-169", " ANC169 ", "anc_169"]) expect(normalizeCarrierBatchNo(v)).toBe("ANC 169");
    expect(normalizeCarrierBatchNo("  ")).toBeNull();
  });

  it("the twin is the China batch's code with Erbil after it", () => {
    expect(twinBatchCode("AIR-2026-075GZ")).toBe("AIR-2026-075GZ Erbil");
  });

  it("ANC 169: $2,428.80 for 276 kg, shared by our customers' kilos, to the cent", () => {
    const s = splitGroupInvoice([{ batchId: 1, kg: 93.68 }, { batchId: 2, kg: 92.28 }, { batchId: 3, kg: 90.04 }], 276, 2428.8);
    expect(s.map((r) => r.costUsd)).toEqual([824.39, 812.06, 792.35]); // the leftover cent on the largest share
    expect(Math.round(s.reduce((a, r) => a + r.costUsd, 0) * 100) / 100).toBe(2428.8);
    expect(Math.round(s.reduce((a, r) => a + r.billedKg, 0) * 100) / 100).toBe(276);
  });

  it("ours against the carrier's", () => {
    expect(groupVerdict({ billedKg: null, oursKg: 10, stillComing: 0 })).toBe("no-invoice");
    expect(groupVerdict({ billedKg: 276, oursKg: 184, stillComing: 40 })).toBe("waiting");
    expect(groupVerdict({ billedKg: 276, oursKg: 266, stillComing: 0 })).toBe("short");
    expect(groupVerdict({ billedKg: 171.87, oursKg: 179.41, stillComing: 0 })).toBe("ahead");
    expect(groupVerdict({ billedKg: 276, oursKg: 275.8, stillComing: 0 })).toBe("even");
    // 10 kg short at $8.80 a kilo
    expect(groupDifferenceUsd({ billedKg: 276, costUsd: 2428.8, oursKg: 266 })).toBe(-88);
  });
});

describe("nothing of a third party reaches a customer", () => {
  it("the airline by its real name, never the forwarder", () => {
    for (const v of ["TK", "Turkish Airline", "turkish", "土耳其航空公司", "Turkish Airlines"]) expect(publicAirlineName(v)).toBe("Turkish Airlines");
    for (const v of ["anc", "ANC", "obi", "bo", "123", ""]) expect(publicAirlineName(v)).toBeNull();
  });

  it("a waybill only when it is one - ANC's 167 typed in the box is not", () => {
    expect(publicAwb("235-99231031")).toBe("235-99231031");
    expect(publicAwb("23599231031")).toBe("235-99231031");
    for (const v of ["167", "ANC 169", "PO12081", "123"]) expect(publicAwb(v)).toBeNull();
  });

  it("the portal's one road out cleans them, and the carrier's number is forbidden", () => {
    const lib = root("server/lib/customerVisibleBatch.ts");
    expect(lib).toContain("o.airlineName = publicAirlineName(o.airlineName as string | null);");
    expect(lib).toContain("o.awbNumber = publicAwb(o.awbNumber as string | null);");
    expect(lib).toContain('if (o.shippingType !== "sea") o.shippingCompany = null;');
    const forbidden = lib.slice(lib.indexOf("FORBIDDEN_BATCH_FIELDS = ["));
    expect(forbidden).toContain('"carrierBatchNo"');
    for (const f of ["client/src/pages/portal/PortalBatchDetail.tsx", "server/db/portal.db.ts"]) expect(root(f), f).not.toContain("carrierBatchNo");
  });
});

describe("wired", () => {
  it("the twin is made by the office from inside the China batch, air only", () => {
    const card = root("client/src/components/batches/CarrierGroupCard.tsx");
    expect(card).toContain('const canTwin = isAdmin && madeInChina && shippingType !== "sea" && !hasTwin;');
    const db = root("server/db/carrierGroup.db.ts");
    expect(db).toContain('if (china.shippingType === "sea")');
    expect(db).toContain("twinOfBatchId: china.id,");
  });

  it("the invoice reaches each batch only through updateBatch", () => {
    expect(root("server/db/carrierGroup.db.ts")).toContain("await updateBatch(m.batchId, { chargedWeightKg: share.billedKg.toFixed(2), shippingCost: share.costUsd.toFixed(2) } as never, user.id);");
  });

  it("the live strip on both scan screens", () => {
    expect(root("client/src/pages/QuickRegister.tsx")).toContain("<CarrierGroupStrip batchId={parseInt(batchId) || null} />");
    expect(root("client/src/pages/ArrivalVerificationScanner.tsx")).toContain("{selectedBatchIds.map((id) => <CarrierGroupStrip key={id} batchId={id} />)}");
  });
});

describe("the bell", () => {
  it("a short group rings, high, for the finance people", async () => {
    const { buildRiskItems, RISK_GATE } = await import("./riskBell");
    const items = buildRiskItems({ staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0, carrierShort: 2 } as never);
    const it = items.find((i) => i.id === "carrier-short");
    expect(it?.level).toBe("high");
    expect(it?.count).toBe(2);
    expect(RISK_GATE["carrier-short"]).toBe("/finance/company-dashboard");
  });
});
