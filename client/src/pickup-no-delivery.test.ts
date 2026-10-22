import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-22: a box changed to «وەرگرتنی خۆی» kept its $3 delivery.
 * Pickup has no delivery - price and cost 0, from either door - and the
 * receipt, which reads the box, follows.
 */
describe("a box the customer collects has no delivery price", () => {
  const handover = read("server/db/boxHandover.db.ts");
  const router = read("server/routers/scanning.router.ts");

  it("one set of zeros, used by both doors", () => {
    expect(handover).toContain('deliveryChargeUsd: "0.00",\n  deliveryCostUsd: "0.00",\n  deliveryProfitUsd: "0.00",');
    expect(handover).toContain('...(input.mode === "pickup" ? PICKUP_HAS_NO_DELIVERY : {}),');
    expect(router).toContain('if (data.deliveryMethod === "warehouse_pickup") {');
    expect(router).toContain("...db.PICKUP_HAS_NO_DELIVERY,");
  });

  it("the box on screen and in the table is read again after the change", () => {
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).toContain("void refetchBox(); void utils.deliveryBox.customerBoxes.invalidate(); void utils.deliveryBox.list.invalidate();");
  });
});
