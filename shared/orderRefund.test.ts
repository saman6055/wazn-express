import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { REFUSAL_FAULT, REFUSAL_REASONS, ORDER_REFUSAL_REASONS, refundStockFigures, stockResultUsd } from "./refusedGoods";

/**
 * «ڕیفەند» (owner, 2026-10-26): goods sent back to the seller in China. The
 * customer no longer owes for them and pays the return fee; the company loses
 * only what the seller did not refund. «گەڕاوە» stays the refusal it was.
 * Naming an order refunded/returned by status alone moved no money - closed.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the money of a refund", () => {
  it("full refund, $100 goods, $5 return fee: no loss", () => {
    const f = refundStockFigures({ buyUsd: 100, sellerRefundUsd: 100, returnFeeUsd: 5 });
    expect(f).toEqual({ costUsd: 105, keptUsd: 5, soldPriceUsd: 100, companyResultUsd: 0 });
    // The one stock profit rule reads it the same way.
    expect(stockResultUsd({ status: "sold", costUsd: f.costUsd, keptUsd: f.keptUsd, soldPriceUsd: f.soldPriceUsd })).toBe(0);
  });

  it("the seller refunds $85 of $100: the company loses $15", () => {
    const f = refundStockFigures({ buyUsd: 100, sellerRefundUsd: 85, returnFeeUsd: 0 });
    expect(f.companyResultUsd).toBe(-15);
    expect(stockResultUsd({ status: "sold", costUsd: f.costUsd, keptUsd: f.keptUsd, soldPriceUsd: f.soldPriceUsd })).toBe(-15);
  });

  it("a refund is its own reason, not one an order is refused for", () => {
    expect(REFUSAL_REASONS).toContain("refunded");
    expect(ORDER_REFUSAL_REASONS as readonly string[]).not.toContain("refunded");
    expect(REFUSAL_FAULT.refunded).toBe("nobody");
  });
});

describe("wired", () => {
  it("the status menu cannot name an order refunded or returned", () => {
    const router = root("server/routers/fullPackage.router.ts");
    expect(router).toContain('if ((input.status === "refunded" || input.status === "returned") && existing.status !== input.status)');
    expect(root("client/src/pages/CommissionOrders.tsx")).toContain("{withoutMoneyStatuses(statusOptions).map((option) => (");
  });

  it("both order lists offer the two doors and show the mark", () => {
    for (const f of ["client/src/pages/CommissionOrders.tsx", "client/src/pages/FullPackageDashboard.tsx"]) {
      const src = root(f);
      expect(src, f).toContain("<OrderOutcomeMenuItems");
      expect(src, f).toContain("<OrderStockMark mark={stockMarks.get(order.id)}");
      expect(src, f).toContain("<RefundOrderDialog");
    }
  });

  it("the refund is the main admin's, the customer's money is never kept, the fee is its own line", () => {
    expect(root("server/routers/finance.router.ts")).toContain("refundOrder: superAdminProcedure");
    const db = root("server/db/refusedGoods.db.ts");
    const fn = db.slice(db.indexOf("export async function refundOrderGoods"), db.indexOf("export async function stockMarksForOrders"));
    expect(fn.length).toBeGreaterThan(500);
    expect(fn).toContain('"debit", returnFeeLedgerReason(order.orderCode)');
    expect(fn).not.toContain("keptLedgerReason");
    expect(fn).toContain('reason: "refunded"');
  });

  it("the enum is widened in the one patch every boot runs, not a second one", () => {
    const m = root("server/_core/migrations.ts");
    expect(m.split("MODIFY COLUMN reason ENUM('late'").length - 1).toBe(1);
    expect(m).toContain("'ownerless','refunded','other') NOT NULL\",");
  });
});
