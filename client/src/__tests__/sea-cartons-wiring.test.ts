import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/** This test's old home: paths below are read from here. */
const ROOT_DIR = path.resolve(__dirname, "..");

const read = (rel: string) => fs.readFileSync(path.resolve(ROOT_DIR, "../..", rel), "utf8").replace(/\r\n/g, "\n");

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
  const qr = read("client/src/pages/packages/QuickRegister.tsx");

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

  it("every path that prices a sea parcel asks the one rule, on the parcel itself (2026-11-07)", () => {
    expect(read("server/services/parcelPricing.service.ts")).toContain("await smallParcelRuleFor(batch, facts.customerId, { id: facts.packageId, volumeCbm: measure.volumeCbm,");
    const charging = read("server/db/batchCharging.db.ts");
    expect(charging).toContain("parcelShippingCharge(pkg, isSea, rate, divisor, ruleFor(pkg))");
    expect(charging).toContain("ruleOn ? { on: true, parcelCbm: pkg.volumeCbm, waived:");
    expect(charging).not.toContain("customerSeaCbmInBatch");
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("smallParcelPrice(pkgCbm * batchPricePerCbm, await smallParcelRuleFor(batchRow, pkg.customerId, pkg))");
    expect(read("server/routers/packages.router.ts").split("smallParcelPrice(pricePerUnit * parseFloat(pkg.volumeCbm)").length - 1).toBe(2);
    expect(read("server/db/batches.db.ts")).toContain("{ on: true, parcelCbm: v.cbm, waived: v.waived }");
    expect(read("shared/portalQuote.ts")).toContain("{ on: true, parcelCbm: cbm }");
    // The rule itself reads no customer total any more.
    const rule = read("server/db/smallParcel.db.ts");
    expect(rule).toContain("return { on: true, parcelCbm: parcel.volumeCbm ?? 0, waived: Boolean(waived) };");
  });

  it("a parcel no longer moves its owner's others; the master switch and the waiver re-price, receipts never", () => {
    expect(read("server/db/batchCharging.db.ts")).not.toContain("rebalanceSmallParcels(batchId, customerId");
    expect(read("server/lib/correctRegisteredParcel.ts")).not.toContain("rebalanceSmallParcels");
    expect(read("server/routers/batches.router.ts")).toContain("await db.repriceSmallParcels(id, null, { id: ctx.user.id, role: ctx.user.role });");
    // Through the one correction there is, never forcing a credit; the open box follows.
    const reprice = read("server/db/smallParcelRebalance.db.ts");
    expect(reprice).toContain("await applyParcelCorrection(");
    expect(reprice).toContain("{ allowCredit: false, actorRole: actor.role ?? null, boxFollows: { weightKg: String(pkg.weightKg ?? \"0\") } }");
    expect(reprice).toContain('if (hold?.kind === "receipt")');
    expect(read("server/routers/packages.router.ts")).toContain("db.setSmallParcelWaiver(input.packageId, input.waived,");
  });

  it("both fields reach the database through the startup patches", () => {
    const m = read("server/_core/migrations.ts");
    expect(m).toContain('"ALTER TABLE packages ADD COLUMN cartonCount INT NULL"');
    expect(m).toContain('"ALTER TABLE batches ADD COLUMN smallParcelRule BOOLEAN NULL"');
  });

  it("the batch form has one box, ticked on a new batch, and the list carries it to the edit form", () => {
    expect(read("server/db/batches.db.ts")).toContain("smallParcelRule: batches.smallParcelRule,");
    const form = read("client/src/pages/batches/Batches.tsx");
    expect(form).toContain("<SmallParcelRuleField defaultChecked />");
    expect(form).toContain("<SmallParcelRuleField defaultChecked={Boolean(editingBatch.smallParcelRule)} />");
    expect(form.split('smallParcelRule: formData.has("smallParcelRuleShown") ? formData.get("smallParcelRule") === "on" : undefined').length - 1).toBe(2);
    expect(form).not.toContain("SmallParcelPercentField");
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

/**
 * Owner, 2026-10-18: «ئەبێ لە تۆماری خێرا هەبێ پێش تۆمار کردن» - the batch's
 * small-parcel box on Quick Register itself, and the bar saying why.
 */
describe("Quick Register shows and switches the small-parcel rule", () => {
  const page = read("client/src/pages/packages/QuickRegister.tsx");
  it("the batch's own box, under the batch, asked before it changes", () => {
    expect(page).toContain('data-testid="qr-small-parcel-rule-box"');
    expect(page).toContain("smallRuleMutation.mutate({ id: selectedSeaBatch.id, smallParcelRule: next })");
    expect(page).toContain("const sure = await confirmAction({");
  });
  it("under the dimensions: the parcel's own extra and the box that takes it off (2026-11-07)", () => {
    expect(page).toContain('data-testid="qr-small-parcel-line"');
    expect(page).toContain("smallRuleOn && estimate?.smallParcelEligible && (");
    expect(page).toContain('smallParcelWaived: shippingType === "sea" && smallWaived ? true : undefined,');
    expect(read("server/routers/packages.router.ts")).toContain("smallParcelEligible: priced.smallParcelEligible ?? false,");
  });

  it("the customer sees the final price only: no extra, no percent, no base", () => {
    const calc = read("client/src/components/portal/PriceListSection.tsx");
    expect(calc).not.toContain("calc-small-parcel");
    expect(calc).not.toContain("smallParcelAutoPercent");
  });
});
