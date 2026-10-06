import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A corrected parcel is a repriced parcel — and when it cannot be, it says so.
 *
 * The owner, 2026-09-21: "a parcel entered in Quick Register with the wrong
 * price or weight — when you correct it, nothing changes in the price, so you
 * are forced to delete it and register it again."
 *
 * The edit already repriced; it refused in three cases and refused silently.
 * One shared rule now decides which of them happened, the server obeys it,
 * and the screen shows its sentence.
 *
 * What would undo it: the router deciding for itself again, writing a price
 * the rule refused, or the page dropping the sentence.
 */

const readRoot = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

const router = readRoot("server/routers/packages.router.ts");
const update = router.slice(router.indexOf("    update: staffProcedure"), router.indexOf("    delete: adminProcedure"));

describe("the edit", () => {
  it("asks the shared rule what happened, and never decides for itself", () => {
    expect(update.length).toBeGreaterThan(500);
    expect(update).toContain("pricing = repriceReport({");
    expect(update).toContain("isUnclaimed: pkg.isUnclaimed,");
    expect(update).toContain("isCharged: pkg.isCharged,");
    expect(update).toContain("wasUsd: pkg.calculatedCostUsd,");
    expect(update).toContain("resolvedUsd: priced?.costUsd,");
  });

  it("writes a new price only when the rule says it may", () => {
    expect(update).toContain("if (shouldStoreNewPrice(pricing) && priced?.costUsd) {");
    expect(update).toContain("updateData.calculatedCostUsd = priced.costUsd;");
    // One writer, so a refusal cannot be written past.
    expect(update.split("updateData.calculatedCostUsd =").length - 1).toBe(1);
  });

  it("does not go near the pricing tables for a parcel it may not reprice", () => {
    expect(update).toContain("const priced = pkg.isUnclaimed || pkg.isCharged\n              ? null");
  });

  it("prices with the edit's own figures, including a customer it just changed", () => {
    expect(update).toContain("customerId: updateData.customerId ?? pkg.customerId,");
    expect(update).toContain("batchId: updateData.batchId !== undefined ? updateData.batchId : pkg.batchId,");
    expect(update).toContain("weightKg: updateData.weightKg ?? pkg.weightKg,");
  });

  it("sends what happened back to the screen", () => {
    expect(update).toContain("return { success: true, pricing };");
    expect(router).toContain('import { repriceReport, shouldStoreNewPrice, type RepriceReport } from "@shared/parcelReprice";');
  });

  it("still only asks when a fact behind the price moved", () => {
    expect(update).toContain("if (affectsCost(data as Record<string, unknown>)) {");
  });
});

describe("the screen", () => {
  const page = readRoot("client/src/pages/Packages.tsx");

  it("shows the rule's own sentence, and keeps a refusal up until it is read", () => {
    const handler = page.slice(page.indexOf("const onPackageUpdateSuccess"), page.indexOf("const onDeleteSuccess"));
    expect(handler.length).toBeGreaterThan(200);
    expect(handler).toContain("repriceWords(result.pricing)");
    expect(handler).toContain("toast.warning(sentence, { duration: 12000 })");
    expect(handler).toContain("refetch();");
  });
});

/*
 * 2026-10-05: the first of the three refusals is gone. A parcel already on
 * its owner's account is handed to the correction (lib/correctRegisteredParcel),
 * which moves the parcel and its debt together or says why it could not.
 */
describe("a parcel already on the account is handed to the correction", () => {
  it("before the old rule is asked, and its answer is the one sent back", () => {
    const door = update.indexOf("const onAccount = await correctChargedParcelOnEdit(");
    const rule = update.indexOf("pricing = repriceReport({");
    const wins = update.indexOf("if (onAccount) pricing = onAccount;");
    expect(door).toBeGreaterThan(-1);
    expect(rule).toBeGreaterThan(door);
    expect(wins).toBeGreaterThan(rule);
    expect(wins).toBeLessThan(update.indexOf("if (shouldStoreNewPrice(pricing) && priced?.costUsd) {"));
  });

  it("the edit's own figures are what it is handed", () => {
    for (const f of ["customerId", "weightKg", "lengthCm", "widthCm", "heightCm", "volumeCbm", "batchId"]) {
      expect(update, f).toContain(`${f}: updateData.${f},`);
    }
  });

  it("the screen reads an edit the debt could not follow in a window, not a toast", () => {
    const page = readRoot("client/src/pages/Packages.tsx");
    const handler = page.slice(page.indexOf("const onPackageUpdateSuccess"), page.indexOf("const onDeleteSuccess"));
    expect(handler.length).toBeGreaterThan(200);
    expect(handler).toContain('else if (result!.pricing!.outcome === "held") systemAlert({');
    // And a refusal that comes with numbered steps is read the same way.
    expect(page).toContain("systemAlert({ kind: \"warning\", title: t(\"common.error\"), message: error.message })");
  });
});
