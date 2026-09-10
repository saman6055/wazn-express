/**
 * What a customer is allowed to see of a shipment (batch) they have goods in.
 *
 * This was a strip-list: the portal took the whole `batches` row and removed
 * the columns somebody had remembered were internal. Everything else went to
 * every customer with a parcel in the container — the batch's default selling
 * rate (which a customer on an agreed rate could hold against their own),
 * the container's total parcel count (everybody's goods), the flight and
 * vessel details nobody renders, and the city and warehouse the batch was
 * created in. And every column added to the table later was published by
 * default.
 *
 * Now it is an allow-list, like the order and parcel ones beside it. A new
 * column is invisible until someone decides a customer should see it.
 *
 * Container number, air waybill and shipping company stay on purpose: the
 * batch detail page shows them so the customer can follow the carrier.
 */

export const VISIBLE_BATCH_KEYS = [
  "id",
  "batchCode",
  "shippingType",
  "status",
  "departureDate",
  "estimatedArrival",
  "actualArrival",
  "containerNumber",
  "awbNumber",
  "shippingCompany",
  "createdAt",
  "updatedAt",
] as const;

export type VisibleBatchKey = (typeof VISIBLE_BATCH_KEYS)[number];

export function toCustomerVisibleBatch<B extends Record<VisibleBatchKey, unknown>>(
  batch: B,
): Pick<B, VisibleBatchKey> {
  const out = {} as Pick<B, VisibleBatchKey>;
  for (const key of VISIBLE_BATCH_KEYS) out[key] = batch[key];
  return out;
}

/** Columns that must never reach a customer. Asserted by the test. */
export const FORBIDDEN_BATCH_FIELDS = [
  "costPerKg",
  "costPerCbm",
  "shippingCost",
  "shipmentTrackings",
  "notes",
  "totalWeight",
  "actualWeightKg",
  "actualCbm",
  "chargedWeightKg",
  "chargedCbm",
  "createdById",
  "pricePerKg",
  "pricePerCbm",
  "totalPackages",
  "originWarehouseId",
  "createdInCity",
  "createdInCountryId",
] as const;
