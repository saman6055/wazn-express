import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Sea cartons and the small-parcel extra (owner, 2026-10-17/18) - where each
 * is wired. The rules are in shared/parcelCost (shared/seaCartons.test).
 *
 * Proved on a throwaway MySQL through the real procedures (21 checks): his
 * carton 47.5×47.5×57 at $350 with +20% - one carton $54.01 (small), four
 * $180.05 (not small); the account charged the same; the batch's own charging
 * the same; Quick Register's correction to 2 cartons $90.02 (in place) and
 * back to 1 $54.01; All Packages keeping four cartons when a side is edited;
 * the box item saying 4 × 0.135; a cleared percent adding nothing.
 * Looked at in the local app: the fifth box in the sea row, "0.1286 m³ × 4",
 * 0.5144 m³ and $180.05 on the bar; one carton "$54.01 × 350.00 +20%"; the
 * batch edit form showing the saved 20.
 */
describe("Quick Register keeps its shape and gains one box", () => {
  const qr = read("client/src/pages/QuickRegister.tsx");

  it("the sea row is five across, the fifth is the count", () => {
    expect(qr).toContain('<div className="grid grid-cols-2 md:grid-cols-5 gap-3">');
    expect(qr).toContain('data-testid="qr-carton-count"');
    expect(qr).toContain('useState("1")');
  });

  it("one carton is what every form already meant: the count is sent only when more", () => {
    expect(qr).toContain("const cartonsSent = cartons > 1 ? cartons : undefined;");
    expect(qr.split("cartonCount: cartonsSent").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("every volume it shows is all the cartons", () => {
    expect(qr).toContain("{totalCbm.toFixed(4)} m³");
    expect(qr).toContain("{totalCbm.toFixed(3)}");
    expect(qr).not.toContain("{cbm.toFixed(3)}");
  });
});

describe("the server multiplies, and prices with the extra, in one place each", () => {
  it("register, the quote and the correction count cartons the same way", () => {
    const router = read("server/routers/packages.router.ts");
    expect(router.split("const cartons = input.cartonCount ? cartonVolume(input) : null;").length - 1).toBe(2);
    expect(read("server/lib/correctRegisteredParcel.ts")).toContain("const cartons = cartonVolume(input);");
  });

  it("every path that prices a sea parcel adds the batch's extra", () => {
    expect(read("server/services/parcelPricing.service.ts")).toContain("smallParcelExtraPercent(measure.volumeCbm, batch.smallParcelSurchargePercent)");
    const charging = read("server/db/batchCharging.db.ts");
    expect(charging.split("batch.smallParcelSurchargePercent)").length - 1).toBe(2);
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("withSmallParcelExtra(pkgCbm * batchPricePerCbm, pkgCbm, batchRow.smallParcelSurchargePercent)");
    expect(read("server/routers/packages.router.ts").split("withSmallParcelExtra(pricePerUnit * parseFloat(pkg.volumeCbm)").length - 1).toBe(2);
  });

  it("both fields reach the database through the startup patches", () => {
    const m = read("server/_core/migrations.ts");
    expect(m).toContain('"ALTER TABLE packages ADD COLUMN cartonCount INT NULL"');
    expect(m).toContain('"ALTER TABLE batches ADD COLUMN smallParcelSurchargePercent DECIMAL(5,2) NULL"');
  });

  it("the batch list carries the percent to the edit form", () => {
    expect(read("server/db/batches.db.ts")).toContain("smallParcelSurchargePercent: batches.smallParcelSurchargePercent,");
    const form = read("client/src/pages/Batches.tsx");
    expect(form).toContain("<SmallParcelPercentField defaultValue={editingBatch.smallParcelSurchargePercent} />");
    expect(form).toContain('smallParcelSurchargePercent: clearable("smallParcelSurchargePercent")');
  });
});

describe("the box and the receipt say how many cartons", () => {
  it("each box item carries its parcel's count", () => {
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("cartonCount: (p as any).cartonCount ?? null");
  });

  it("the panel and the paper write 4 × 0.129 = 0.514", () => {
    expect(read("client/src/components/delivery/BoxDetailPanel.tsx")).toContain("{cartonVolumeText(item.volumeCbm, item.cartonCount)} CBM");
    expect(read("client/src/lib/deliveryBoxPrintUtils.ts")).toContain("`${cartonVolumeText(item.volumeCbm, item.cartonCount)} CBM`");
  });
});
