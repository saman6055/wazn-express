import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { packages, type Batch } from "../../drizzle/schema";
import type { SmallParcelRule } from "@shared/parcelCost";

/**
 * The small sea parcel rule, as one customer in one batch stands under it
 * (shared/parcelCost: smallParcelPrice).
 *
 * What is measured is everything the customer has in the batch (owner,
 * 2026-10-18: five small cartons of one person are not five small parcels).
 * A parcel that ended - returned, cancelled - is not counted.
 */

/** The batch's box is ticked, and it is a sea batch. Batches before the rule have it empty: off. */
export function smallParcelRuleOn(batch: Pick<Batch, "shippingType"> & { smallParcelRule?: boolean | number | null }): boolean {
  return batch.shippingType === "sea" && Boolean(batch.smallParcelRule);
}

/** Everything this customer has in this batch, in m³ - optionally without one parcel. */
export async function customerSeaCbmInBatch(batchId: number, customerId: number, excludePackageId?: number | null): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${packages.volumeCbm}), 0)` })
    .from(packages)
    .where(and(
      eq(packages.batchId, batchId),
      eq(packages.customerId, customerId),
      eq(packages.isUnclaimed, false),
      notInArray(packages.status, ["returned", "cancelled"]),
      ...(excludePackageId ? [ne(packages.id, excludePackageId)] : []),
    ));
  return Number(row?.total ?? 0) || 0;
}

/**
 * The rule for one parcel: its owner's total in the batch with this parcel
 * counted at the volume it has NOW (which may be a corrected one, or a new
 * parcel not yet written).
 */
export async function smallParcelRuleFor(
  batch: Pick<Batch, "id" | "shippingType"> & { smallParcelRule?: boolean | number | null },
  customerId: number | null | undefined,
  parcel: { id?: number | null; volumeCbm?: string | number | null },
): Promise<SmallParcelRule | null> {
  if (!customerId || !smallParcelRuleOn(batch)) return null;
  const others = await customerSeaCbmInBatch(batch.id, customerId, parcel.id ?? null);
  const own = Number(parcel.volumeCbm ?? 0) || 0;
  return { on: true, customerTotalCbm: others + own };
}

/** The customers who have parcels in a batch. */
export async function getBatchCustomerIds(batchId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ customerId: packages.customerId })
    .from(packages)
    .where(and(eq(packages.batchId, batchId), eq(packages.isUnclaimed, false)));
  return rows.map((r) => Number(r.customerId)).filter((id) => id > 0);
}
