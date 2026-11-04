import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The bulky-parcel watch lists only loads still coming: a parcel in Erbil,
 * with the customer, or in a batch that has arrived drops off (owner, 2026-11-05).
 */
const src = readFileSync(resolve(__dirname, "../db/packages.db.ts"), "utf8");

describe("volumetric watch shows only loads still coming", () => {
  it("drops arrived parcels, arrived batches and arrival-scanned cartons", () => {
    const start = src.indexOf("export async function getVolumetricParcels");
    const body = src.slice(start, src.indexOf("const out: VolumetricParcel[] = [];", start));
    expect(body).toContain("'ready_for_delivery', 'out_for_delivery', 'delivered', 'returned', 'cancelled'");
    expect(body).toContain("notInArray(batches.status, ['arrived', 'at_depot', 'delivered', 'closed'])");
    expect(body).toContain("ps.scanType = 'received_local'");
  });
});
