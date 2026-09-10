/**
 * The total a customer is charged for an order, as the portal shows it.
 *
 * It decides nothing. It mirrors what the ledger posts (server-side
 * computeOrderChargeAmount) so the screen cannot print a different number:
 *
 *  - agreed-price orders (full package, purchase request): the agreed unit
 *    price × quantity. The order card used to headline the unit price, so
 *    three of a $52 item read "$52" beside a $156 debit.
 *  - commission: totalPrepaidUsd, which is already (goods + fee) × quantity.
 *
 * Null when nothing has been priced yet, so the caller prints a dash rather
 * than "$0.00".
 */
type Money = string | number | null | undefined;

const present = (v: Money): v is string | number =>
  v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

export function orderDisplayTotal(order: {
  orderType?: string | null;
  sellingPriceUsd?: Money;
  totalPrepaidUsd?: Money;
  quantity?: number | string | null;
}): number | null {
  if (order.orderType === "commission") {
    return present(order.totalPrepaidUsd) ? Number(order.totalPrepaidUsd) : null;
  }
  const quantity = Math.max(1, Number(order.quantity) || 1);
  if (present(order.sellingPriceUsd)) {
    return Math.round(Number(order.sellingPriceUsd) * quantity * 100) / 100;
  }
  return present(order.totalPrepaidUsd) ? Number(order.totalPrepaidUsd) : null;
}
