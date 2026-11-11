import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-11 (the third time): a wrong tracking typed into an order
 * could not be corrected from the list. The box opened empty and ADDED what
 * was typed, so the wrong one stayed. Now it opens with the current tracking
 * and a changed one REPLACES it.
 */
describe("the list's tracking box corrects a tracking", () => {
  for (const page of ["client/src/pages/orders/CommissionDashboard.tsx", "client/src/pages/orders/CommissionOrders.tsx"]) {
    it(`${page}: opens with the current tracking and replaces it`, () => {
      const src = read(page);
      expect(src).toContain('const current = (order.trackingNumber ?? "").trim(); setTypingFor(order.id); setTyped(current); setTypedFrom(current);');
      expect(src).toContain("if (typedFrom) replaceTracking.mutate({ fullPackageOrderId: order.id, from: typedFrom, to: one });");
      expect(src).toContain("else addTracking.mutate({ fullPackageOrderId: order.id, trackingNumbers: [one] });");
    });
  }

  it("the server changes the order's own fields before releasing the old parcel, then adds and adopts", () => {
    const db = read("server/db/fullPackage.db.ts");
    const fn = db.slice(db.indexOf("export async function replaceOrderTracking"), db.indexOf("/** Order IDs that have at least one row"));
    const fields = fn.indexOf("await db.update(fullPackageOrders)");
    const release = fn.indexOf("await removeOrderTracking(row.id)");
    const add = fn.indexOf("await addOrderTrackings(fullPackageOrderId, [t])");
    expect(fields).toBeGreaterThan(-1);
    expect(release).toBeGreaterThan(fields);
    expect(add).toBeGreaterThan(release);
    const router = read("server/routers/fullPackage.router.ts");
    const proc = router.slice(router.indexOf("replaceOrderTracking: staffProcedure"), router.indexOf("replaceOrderTracking: staffProcedure") + 1400);
    expect(proc).toContain('action: "replace_order_tracking"');
    expect(proc).toContain("await safeBacklink(input.fullPackageOrderId)");
  });
});
