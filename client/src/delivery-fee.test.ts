import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { DELIVERY_FEE_IN_OUR_ACCOUNTS, ourDeliveryFee } from "@shared/deliveryFee";
import { boxUnpaidAlert } from "./lib/boxAlert";

/**
 * Owner, 2026-09-10: the local delivery fee is the courier's, not ours, and
 * stays out of our accounts for now. One switch in shared/deliveryFee.ts; every
 * place that reads the fee as money reads it through there.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

describe("the delivery fee is not our money, for now", () => {
  it("the switch is off and the fee reads as zero", () => {
    expect(DELIVERY_FEE_IN_OUR_ACCOUNTS).toBe(false);
    expect(ourDeliveryFee("3.50")).toBe(0);
    expect(ourDeliveryFee(3.5)).toBe(0);
  });

  it("is never charged to the customer's account", () => {
    const lib = read("server/lib/boxLifecycle.ts");
    const fn = lib.slice(lib.indexOf("export async function chargeBoxDeliveryFee("), lib.indexOf("export async function markBoxContentsDelivered("));
    expect(fn.length, "chargeBoxDeliveryFee has moved or gone").toBeGreaterThan(50);
    const guard = fn.indexOf("if (!DELIVERY_FEE_IN_OUR_ACCOUNTS) return;");
    expect(guard, "the charge must stop at the switch").toBeGreaterThan(-1);
    expect(guard, "before anything is written").toBeLessThan(fn.indexOf("db.createInvoice("));
  });

  it("does not make a paid box read as owed", () => {
    // BOX-20260903-001: goods $24.77, courier fee $3.50. Paid for its goods,
    // it was flagged "handed over unpaid — $3.52" because the fee was added.
    const paid = boxUnpaidAlert({
      status: "delivered",
      totalValueUsd: "24.77",
      deliveryChargeUsd: "3.50",
      settledUsd: 24.77,
      createdAt: new Date("2026-09-03T10:00:00Z"),
    });
    expect(paid).toBeNull();
  });

  it("is not in the delivery page's money total", () => {
    expect(read("client/src/components/delivery/DeliveryStats.tsx")).toContain("ourDeliveryFee(b.deliveryChargeUsd)");
  });

  it("is not on the box invoice, for staff or the customer", () => {
    expect(read("server/routers/finance.router.ts")).toContain("buildBoxInvoice(items, ourDeliveryFee(box.deliveryChargeUsd))");
    expect(read("server/routers/portal.router.ts")).toContain("buildBoxInvoice(items, ourDeliveryFee(box.deliveryChargeUsd)");
    expect(read("client/src/components/BoxInvoiceView.tsx")).toContain("{totals.delivery > 0 && (");
  });

  it("is not in the company's revenue", () => {
    const reports = read("server/db/reports.db.ts");
    expect(reports).toContain("const deliveryRevenue = DELIVERY_FEE_IN_OUR_ACCOUNTS ? (deliveryBoxProfit?.totalProfit ?? 0) : 0;");
    expect(reports).toContain("deliveryBox: DELIVERY_FEE_IN_OUR_ACCOUNTS ? deliveryBoxProfit : defaultDeliveryBox,");
  });

  it("is still printed for the courier, who collects it", () => {
    // Deliberately unchanged: the receipt tells the courier what to collect.
    expect(read("client/src/lib/deliveryBoxPrintUtils.ts")).toContain("formatNum(box.deliveryChargeUsd)");
  });
});
