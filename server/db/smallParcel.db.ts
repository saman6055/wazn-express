import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { batches, packages, type Batch } from "../../drizzle/schema";
import { smallParcelBreakdown, type SmallParcelBreakdown, type SmallParcelRule } from "@shared/parcelCost";
import { getBatchRateForCustomer } from "./batches.db";

/**
 * The small sea parcel rule, as one parcel stands under it
 * (shared/parcelCost: smallParcelPrice). Since 2026-11-07 each parcel is
 * measured by itself; customerSeaCbmInBatch stays for the screens that show a
 * customer's share of a batch.
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
 * The rule for one parcel, measured by itself (2026-11-07): its own volume -
 * every carton under its one tracking - and whether the office took the extra
 * off it. The waiver is read from the parcel when the caller did not say.
 * The owner's other parcels in the batch play no part any more.
 */
export async function smallParcelRuleFor(
  batch: Pick<Batch, "id" | "shippingType"> & { smallParcelRule?: boolean | number | null },
  customerId: number | null | undefined,
  parcel: { id?: number | null; volumeCbm?: string | number | null; smallParcelWaived?: boolean | number | null },
): Promise<SmallParcelRule | null> {
  if (!customerId || !smallParcelRuleOn(batch)) return null;
  let waived = parcel.smallParcelWaived;
  if (waived === undefined && parcel.id) {
    const db = await getDb();
    if (db) {
      const [row] = await db.select({ w: packages.smallParcelWaived }).from(packages).where(eq(packages.id, parcel.id)).limit(1);
      waived = row?.w ?? null;
    }
  }
  return { on: true, parcelCbm: parcel.volumeCbm ?? 0, waived: Boolean(waived) };
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

/**
 * The office's view of the rule on these parcels (owner-approved mockup,
 * 2026-11-07): for each sea parcel under the line in a batch with the rule on,
 * its base price, final price, percent and whether the extra was waived - at
 * the rate its charge uses. Never sent to a customer: the portal, the receipt
 * and WhatsApp show the final price only.
 */
export async function smallParcelViewFor(packageIds: number[]): Promise<Map<number, SmallParcelBreakdown & { packageId: number; cbm: number }>> {
  const out = new Map<number, SmallParcelBreakdown & { packageId: number; cbm: number }>();
  const ids = Array.from(new Set(packageIds.filter((id) => id > 0)));
  const db = await getDb();
  if (!db || ids.length === 0) return out;
  const rows = await db
    .select({
      id: packages.id,
      customerId: packages.customerId,
      batchId: packages.batchId,
      volumeCbm: packages.volumeCbm,
      waived: packages.smallParcelWaived,
      shippingType: batches.shippingType,
      smallParcelRule: batches.smallParcelRule,
    })
    .from(packages)
    .innerJoin(batches, eq(batches.id, packages.batchId))
    .where(inArray(packages.id, ids));
  const rates = new Map<string, number>();
  for (const r of rows) {
    if (!r.customerId || !r.batchId || !smallParcelRuleOn({ shippingType: r.shippingType, smallParcelRule: r.smallParcelRule })) continue;
    const key = `${r.batchId}:${r.customerId}`;
    if (!rates.has(key)) rates.set(key, (await getBatchRateForCustomer(r.batchId, r.customerId, { unit: "cbm" })).rate || 0);
    const rate = rates.get(key) ?? 0;
    const cbm = Number(r.volumeCbm ?? 0) || 0;
    if (!(rate > 0) || !(cbm > 0)) continue;
    const b = smallParcelBreakdown(Math.round(rate * cbm * 100) / 100, { on: true, parcelCbm: cbm, waived: Boolean(r.waived) });
    if (b.eligible) out.set(r.id, { ...b, packageId: r.id, cbm });
  }
  return out;
}
