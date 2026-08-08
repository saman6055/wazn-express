/**
 * What a customer is allowed to see of their own order.
 *
 * The portal used to hand back whatever the database join produced. That row
 * carries three things the customer must never have:
 *
 *   • our side of the trade — `purchasePriceUsd`, `purchasePriceCny`,
 *     `grossProfitUsd`, `netProfitUsd`, `profitUsd`. A commission customer
 *     could read exactly what we paid and exactly what we made on them.
 *   • the supplier — `contactPerson`, `phone`, `wechatId`, `platformShopUrl`.
 *     That is the whole relationship, handed over. A customer with it has no
 *     reason to order through us again.
 *   • the customer's own row joined in whole, which carries `passwordHash`,
 *     `passportUrl`, `nationalIdUrl` and the staff-only `notes`.
 *
 * Written as explicit field lists rather than a generic filter so the shape is
 * part of the type: adding a column to the orders table does not silently add
 * it to what the portal publishes, and the client keeps precise types.
 */

type AnyRow = Record<string, any>;

export function toCustomerVisibleOrder(order: AnyRow) {
  return {
    ...customerVisibleOrderFields(order),
    // The joined customer row is the caller themselves — they already have
    // their own profile from getMyAccount, so dropping it costs nothing and
    // stops passwordHash travelling over the wire. The supplier is dropped
    // outright.
    batch: order.batch
      ? {
          id: order.batch.id,
          batchCode: order.batch.batchCode,
          status: order.batch.status,
          shippingType: order.batch.shippingType,
          departureDate: order.batch.departureDate ?? null,
          arrivalDate: order.batch.arrivalDate ?? null,
          estimatedArrival: order.batch.estimatedArrival ?? null,
        }
      : null,
  };
}

export function toCustomerVisibleOrders(orders: AnyRow[] | null | undefined) {
  return (orders ?? []).map(customerVisibleOrderFields);
}

function customerVisibleOrderFields(o: AnyRow) {
  return {
    id: o.id,
    orderCode: o.orderCode ?? null,
    orderType: o.orderType,
    status: o.status,
    customerId: o.customerId ?? null,

    // What was bought
    productName: o.productName ?? null,
    productDescription: o.productDescription ?? null,
    productLink: o.productLink ?? null,
    productImage: o.productImage ?? null,
    productImages: o.productImages ?? null,
    platform: o.platform ?? null,
    quantity: o.quantity ?? null,
    color: o.color ?? null,
    size: o.size ?? null,
    notes: o.notes ?? null,

    // What the customer pays, and what they have already paid. Never what we
    // paid, and never the margin.
    sellingPriceUsd: o.sellingPriceUsd ?? null,
    itemPriceUsd: o.itemPriceUsd ?? null,
    commissionFeeUsd: o.commissionFeeUsd ?? null,
    totalPrepaidUsd: o.totalPrepaidUsd ?? null,
    advancePaidUsd: o.advancePaidUsd ?? null,
    advancePaymentMethod: o.advancePaymentMethod ?? null,
    shippingCostUsd: o.shippingCostUsd ?? null,
    /** What the customer is charged for shipping — not what it cost us. */
    shippingChargedUsd: o.shippingChargedUsd ?? null,
    totalPriceUsd: o.totalPriceUsd ?? null,
    quoteAmountUsd: o.quoteAmountUsd ?? null,
    quoteNote: o.quoteNote ?? null,
    quoteRespondedAt: o.quoteRespondedAt ?? null,

    // Where it is
    trackingNumber: o.trackingNumber ?? null,
    shippingType: o.shippingType ?? null,
    weightKg: o.weightKg ?? null,
    volumeCbm: o.volumeCbm ?? null,
    dimensionLength: o.dimensionLength ?? null,
    dimensionWidth: o.dimensionWidth ?? null,
    dimensionHeight: o.dimensionHeight ?? null,
    batchId: o.batchId ?? null,

    createdAt: o.createdAt,
    updatedAt: o.updatedAt ?? null,
    deliveredAt: o.deliveredAt ?? null,
  };
}

/** The columns that must never reach a customer. Asserted by the test. */
export const FORBIDDEN_ORDER_FIELDS = [
  "purchasePriceUsd",
  "purchasePriceCny",
  "grossProfitUsd",
  "netProfitUsd",
  "profitUsd",
  "supplierId",
  "supplierOrderNumber",
  "supplierTrackingNumber",
  "purchaseInvoiceUrl",
  "passwordHash",
  "passportUrl",
  "nationalIdUrl",
] as const;
