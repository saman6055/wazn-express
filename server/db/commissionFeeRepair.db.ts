import { and, eq, gt, inArray, isNull, like, or } from "drizzle-orm";
import { getDb } from "./connection";
import { customers, fullPackageOrders, ledgerTransactions } from "../../drizzle/schema";
import { orderProfitUsd } from "@shared/orderProfit";
import { createAuditLog } from "./admin.db";

/**
 * Commission orders whose fee was stored as the ORDER's total.
 *
 * Everything reads the commission fee as per unit — the form, the order page,
 * the profit rule (fee × quantity). But from May to July a run of multi-unit
 * orders was charged as goods × quantity + fee: the fee was the whole order's.
 * The customer's charge was right; every other figure read it a hundred times
 * over (CM-MPC9AGUF: 100 units, fee $19 — profit shown $1,900, charged $19).
 * Found 2026-10-03: 136 orders, $2,541.81 of profit that never existed.
 *
 * The charge decides. An order is listed only when its standing goods charge
 * equals goods × quantity + fee, and not (goods + fee) × quantity. Fixing it
 * divides the fee by the quantity — nothing on any account moves, because the
 * charge already says what was owed.
 */

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const near = (a: number, b: number) => Math.abs(a - b) < 0.06;

export interface FeeAsTotalRow {
  orderId: number;
  orderCode: string;
  customerCode: string;
  quantity: number;
  itemPriceUsd: number;
  feeUsd: number;
  chargedUsd: number;
  /** The fee for one unit, as it should have been stored. */
  feePerUnitUsd: number;
  /** Profit as the reports read it now, and as it really is. */
  profitShownUsd: number;
  profitRealUsd: number;
}

export async function findCommissionFeeStoredAsTotal(onlyIds?: number[]): Promise<FeeAsTotalRow[]> {
  const db = await getDb();
  if (!db) return [];
  const orders = await db
    .select({
      id: fullPackageOrders.id,
      code: fullPackageOrders.orderCode,
      customerId: fullPackageOrders.customerId,
      quantity: fullPackageOrders.quantity,
      item: fullPackageOrders.itemPriceUsd,
      fee: fullPackageOrders.commissionFeeUsd,
      shipping: fullPackageOrders.shippingCostUsd,
    })
    .from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.orderType, "commission"),
      isNull(fullPackageOrders.deletedAt),
      gt(fullPackageOrders.quantity, 1),
      onlyIds && onlyIds.length ? inArray(fullPackageOrders.id, onlyIds) : undefined,
    ))
    .limit(10000);
  const withFee = orders.filter((o) => num(o.fee) > 0);
  if (withFee.length === 0) return [];

  const ids = withFee.map((o) => o.id);
  const charges = await db
    .select({
      number: ledgerTransactions.transactionNumber,
      referenceId: ledgerTransactions.referenceId,
      amountUsd: ledgerTransactions.amountUsd,
    })
    .from(ledgerTransactions)
    .where(and(
      eq(ledgerTransactions.transactionType, "DEBIT_COMMISSION"),
      eq(ledgerTransactions.referenceType, "commission"),
      inArray(ledgerTransactions.referenceId, ids),
    ));
  // A goods charge that was reversed or adjusted carries the marker in the row that did it.
  const numbers = charges.map((c) => c.number);
  const markers = numbers.length
    ? await db
        .select({ description: ledgerTransactions.description, type: ledgerTransactions.transactionType, amountUsd: ledgerTransactions.amountUsd })
        .from(ledgerTransactions)
        .where(or(like(ledgerTransactions.description, "%[REV:%"), like(ledgerTransactions.description, "%[ADJ:%")))
    : [];
  const standing = (number: string, amount: number) => {
    let left = amount;
    for (const m of markers) {
      const d = String(m.description ?? "");
      if (d.includes(`[REV:${number}]`)) return 0;
      if (d.includes(`[ADJ:${number}]`)) left += (String(m.type) === "ADJUSTMENT_DEBIT" ? 1 : -1) * num(m.amountUsd);
    }
    return left;
  };

  const custIds = Array.from(new Set(withFee.map((o) => o.customerId).filter((x): x is number => !!x)));
  const codes = custIds.length
    ? await db.select({ id: customers.id, code: customers.customerCode }).from(customers).where(inArray(customers.id, custIds))
    : [];

  const rows: FeeAsTotalRow[] = [];
  for (const o of withFee) {
    const own = charges.filter((c) => c.referenceId === o.id);
    if (own.length === 0) continue;
    const charged = Math.round(own.reduce((s, c) => s + standing(c.number, num(c.amountUsd)), 0) * 100) / 100;
    const q = Math.max(1, Math.trunc(num(o.quantity)));
    const item = num(o.item);
    const fee = num(o.fee);
    const asTotal = item * q + fee;
    const asPerUnit = (item + fee) * q;
    if (!near(charged, asTotal) || near(charged, asPerUnit)) continue;
    const feePerUnit = Math.round((fee / q) * 10000) / 10000;
    rows.push({
      orderId: o.id,
      orderCode: o.code,
      customerCode: codes.find((c) => c.id === o.customerId)?.code ?? "",
      quantity: q,
      itemPriceUsd: item,
      feeUsd: fee,
      chargedUsd: charged,
      feePerUnitUsd: feePerUnit,
      profitShownUsd: Math.round(orderProfitUsd({ orderType: "commission", quantity: q, commissionFeeUsd: fee }) * 100) / 100,
      profitRealUsd: Math.round(orderProfitUsd({ orderType: "commission", quantity: q, commissionFeeUsd: feePerUnit }) * 100) / 100,
    });
  }
  return rows.sort((a, b) => b.profitShownUsd - b.profitRealUsd - (a.profitShownUsd - a.profitRealUsd));
}

/**
 * Store each named order's fee per unit. Each is checked again against its
 * charge first — an order fixed meanwhile, or no longer matching, is skipped.
 * Nothing on any account moves.
 */
export async function fixCommissionFeeStoredAsTotal(
  orderIds: number[],
  user: { id: number; role: string },
): Promise<{ fixed: number; skipped: number; profitRemovedUsd: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await findCommissionFeeStoredAsTotal(orderIds);
  let removed = 0;
  for (const r of rows) {
    await db
      .update(fullPackageOrders)
      .set({ commissionFeeUsd: r.feePerUnitUsd.toFixed(4), profitUsd: r.profitRealUsd.toFixed(2) })
      .where(eq(fullPackageOrders.id, r.orderId));
    await createAuditLog({
      userId: user.id,
      userRole: user.role,
      action: "fix_commission_fee_as_total",
      entityType: "full_package_order",
      entityId: r.orderId,
      oldValues: { commissionFeeUsd: r.feeUsd, profitShownUsd: r.profitShownUsd },
      newValues: { commissionFeeUsd: r.feePerUnitUsd, profitUsd: r.profitRealUsd, chargedUsd: r.chargedUsd },
    });
    removed += r.profitShownUsd - r.profitRealUsd;
  }
  return { fixed: rows.length, skipped: orderIds.length - rows.length, profitRemovedUsd: Math.round(removed * 100) / 100 };
}
