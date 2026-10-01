/**
 * What the company earns on one order — one rule, for the order form, the
 * stored figure and every profit report.
 *
 * The stored `profitUsd` of a commission order was written as
 * `commission − shipping`, for ONE unit, while the customer is charged
 * `commission × quantity` (commissionGoodsTotal). Five pieces at a $2 fee
 * earned $10 and were reported as $2. The reports also summed that stored
 * figure for every order ever entered — cancelled, rejected, refunded,
 * returned, deleted, and quotes nobody had accepted (found 2026-09-28,
 * fixed 2026-10-02).
 *
 * So the reports no longer read the stored figure. They compute it, from
 * the same columns, with the SQL below — which also puts right every order
 * already in the database without changing a row.
 */

export interface OrderProfitInput {
  orderType?: string | null;
  quantity?: number | null;
  purchasePriceUsd?: string | number | null;
  sellingPriceUsd?: string | number | null;
  commissionFeeUsd?: string | number | null;
  shippingCostUsd?: string | number | null;
}

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export function orderProfitUsd(order: OrderProfitInput): number {
  const quantity = Math.max(1, Math.trunc(num(order.quantity)) || 1);
  const shipping = num(order.shippingCostUsd);
  const profit = order.orderType === "commission"
    // The fee is per unit — and it IS the profit; the goods are passed on at cost.
    ? num(order.commissionFeeUsd) * quantity - shipping
    : (num(order.sellingPriceUsd) - num(order.purchasePriceUsd)) * quantity - shipping;
  return Math.round((profit + Number.EPSILON) * 100) / 100;
}

/** The same rule in SQL, over `fullPackageOrders` columns. */
export const ORDER_PROFIT_SQL = `(
  CASE WHEN orderType = 'commission'
    THEN COALESCE(commissionFeeUsd, 0) * GREATEST(COALESCE(quantity, 1), 1)
    ELSE (COALESCE(sellingPriceUsd, 0) - COALESCE(purchasePriceUsd, 0)) * GREATEST(COALESCE(quantity, 1), 1)
  END - COALESCE(shippingCostUsd, 0))`;

/** Orders that are not sales: undone, or a quote nobody has accepted yet. */
export const NOT_A_SALE_STATUSES = ["cancelled", "rejected", "refunded", "returned", "pending_quote", "quoted"] as const;

export function isLiveSale(order: { status?: string | null; deletedAt?: Date | string | null }): boolean {
  if (order.deletedAt) return false;
  return !(NOT_A_SALE_STATUSES as readonly string[]).includes(String(order.status ?? ""));
}

/** And that in SQL. */
export const LIVE_SALE_SQL =
  `(deletedAt IS NULL AND status NOT IN (${NOT_A_SALE_STATUSES.map((s) => `'${s}'`).join(", ")}))`;
