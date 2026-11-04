/**
 * A volumetric discount reaches a commission order's freight that is already
 * on the account: one figure, one ledger line (owner, 2026-11-04).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("discount on freight already on the order", () => {
  const lib = read("server/lib/correctRegisteredParcel.ts");
  const fn = lib.slice(lib.indexOf("export async function setVolumetricDiscount("), lib.indexOf("export async function volumetricFacts("));
  const db = read("server/db/parcelCorrection.db.ts");
  const door = db.slice(db.indexOf("export async function discountOrderFreight("));

  it("is given, not refused, and a full package still is", () => {
    expect(fn).not.toContain("داشکانی لێرە ئەو حیسابە ناگۆڕێت");
    expect(fn).toContain("await db.discountOrderFreight(pkg.id, carrying[0]");
    expect(fn).toContain('const fullPackage = orders.find((o) => o.orderType !== "commission");');
  });

  it("puts the freight row right in place, and the order, parcel and box follow in one transaction", () => {
    expect(door).toContain("await db.transaction(async (tx) => {");
    expect(door).toContain("await restateCharge(charge.id, nowUsd,");
    expect(door).toContain(".set({ shippingChargedUsd: nowUsd.toFixed(2), shippingCostUsd: nowUsd.toFixed(2) })");
    expect(door).toContain(".set({ billedWeightKg: input.billedWeightKg, calculatedCostUsd: nowUsd.toFixed(2) })");
    expect(door).toContain("Number(line.cost ?? 0) - wasUsd + nowUsd");
  });

  it("refuses after a receipt and when the order and the account disagree", () => {
    expect(door).toContain('hold?.kind === "receipt"');
    expect(door).toContain("Math.abs(standing - wasUsd) > 0.005");
  });
});
