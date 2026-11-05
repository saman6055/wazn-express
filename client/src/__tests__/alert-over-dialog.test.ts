import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { batchCodesInRefusal, batchEditHref, unpricedBatchRefusal } from "@shared/unpricedBatchRefusal";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-05: the "not settled" window raised over the box's payment
 * window - OK did nothing, and the batch it named had no way to be opened.
 */
describe("the alert raised over an open dialog", () => {
  const alert = read("client/src/components/SystemAlert.tsx");

  it("takes clicks although Radix has switched the body's pointer events off", () => {
    expect(alert).toContain('!current.autoDismissMs && "pointer-events-auto",');
    expect(alert).toContain('data-system-alert=""');
  });

  it("keeps Esc from also closing the window underneath", () => {
    const start = alert.indexOf('if (e.key === "Enter" || e.key === "Escape") {');
    expect(start).toBeGreaterThan(-1);
    expect(alert.slice(start, start + 400)).toContain("e.stopPropagation();");
  });

  it("is not a click outside for the dialog and the sheet beneath it", () => {
    for (const f of ["client/src/components/ui/dialog.tsx", "client/src/components/ui/sheet.tsx"]) {
      expect(read(f), f).toContain('closest?.("[data-system-alert]")');
    }
  });
});

describe("a batch with no selling price opens from the refusal", () => {
  it("reads back the codes it wrote", () => {
    const msg = unpricedBatchRefusal(["AIR-2026-075GZ", "SEA-12"], ["777456883187600", "YT1"]);
    expect(batchCodesInRefusal(msg)).toEqual(["AIR-2026-075GZ", "SEA-12"]);
    expect(batchCodesInRefusal("some other refusal")).toEqual([]);
    expect(batchEditHref("AIR-2026-075GZ")).toBe("/batches?edit=AIR-2026-075GZ");
  });

  it("is the sentence the box payment throws, and both payment windows link it", () => {
    expect(read("server/db/boxSettlement.db.ts")).toContain("throw new Error(unpricedBatchRefusal(");
    for (const f of [
      "client/src/components/delivery/BoxSettlementPanel.tsx",
      "client/src/components/delivery/QuickSettleDialog.tsx",
    ]) {
      expect(read(f), f).toContain("...unpricedBatchLink(err.message, t),");
    }
  });

  it("the batches page opens a batch asked for by its code", () => {
    expect(read("client/src/pages/batches/Batches.tsx")).toContain(
      "String(b.id) === asked || b.batchCode === asked",
    );
  });
});
