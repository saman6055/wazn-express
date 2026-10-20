import { and, eq, inArray, isNotNull, ne, notInArray, or } from "drizzle-orm";
import { getDb } from "./connection";
import { deliveryBoxes, deliveryBoxItems, packages } from "../../drizzle/schema";

/**
 * The customer's parcels that should be in this box and are not.
 *
 * The owner, 2026-10-20: a parcel forgotten at the scanner went home with
 * the customer and was billed by nobody (Zainab, 79135534330219, more than
 * once). So the box knows what it is waiting for: every parcel of its
 * customer that has reached the office in its batch - or, for a box made by
 * hand, in any batch - and is in no box at all, by parcel or by tracking.
 *
 * "Reached the office" is ready_for_delivery, out_for_delivery or delivered
 * (until 2026-10-20 a batch's arrival wrote delivered on every parcel, boxed
 * or not; those are exactly the ones this must catch). A parcel the office
 * said has not arrived is put back to in_transit and so drops out here, until
 * it is scanned into a box - which moves it forward again.
 */
export const ARRIVED_PARCEL_STATUSES = ["ready_for_delivery", "out_for_delivery", "delivered"] as const;

export interface MissingParcel {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  batchId: number | null;
  status: string;
}

export async function getBoxMissingParcels(boxId: number): Promise<MissingParcel[]> {
  const db = await getDb();
  if (!db) return [];
  const [box] = await db
    .select({ id: deliveryBoxes.id, customerId: deliveryBoxes.customerId, batchId: deliveryBoxes.batchId, status: deliveryBoxes.status })
    .from(deliveryBoxes)
    .where(eq(deliveryBoxes.id, boxId))
    .limit(1);
  if (!box || box.status === "cancelled") return [];

  const candidates = await db
    .select({
      id: packages.id,
      packageCode: packages.packageCode,
      trackingNumber: packages.trackingNumber,
      batchId: packages.batchId,
      status: packages.status,
    })
    .from(packages)
    .where(and(
      eq(packages.customerId, box.customerId),
      eq(packages.isUnclaimed, false),
      // A hand-made box waits only for parcels that reached the office the
      // new way; a batch box also for its batch's old "delivered" ones.
      box.batchId
        ? and(eq(packages.batchId, box.batchId), inArray(packages.status, [...ARRIVED_PARCEL_STATUSES]))
        : and(isNotNull(packages.batchId), eq(packages.status, "ready_for_delivery")),
    ));
  if (candidates.length === 0) return [];

  // In any box that was not cancelled - this one or another, open or long
  // delivered - by the parcel itself or by its tracking.
  const ids = candidates.map((c) => c.id);
  const trackings = candidates.map((c) => c.trackingNumber).filter((t): t is string => Boolean(t));
  const boxed = await db
    .select({ packageId: deliveryBoxItems.packageId, trackingNumber: deliveryBoxItems.trackingNumber })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(
      ne(deliveryBoxes.status, "cancelled"),
      or(
        inArray(deliveryBoxItems.packageId, ids),
        ...(trackings.length > 0 ? [inArray(deliveryBoxItems.trackingNumber, trackings)] : []),
      ),
    ));
  const boxedIds = new Set(boxed.map((b) => b.packageId).filter((x): x is number => x != null));
  const boxedTrackings = new Set(boxed.map((b) => b.trackingNumber).filter((x): x is string => Boolean(x)));
  return candidates
    .filter((c) => !boxedIds.has(c.id) && !(c.trackingNumber && boxedTrackings.has(c.trackingNumber)))
    .map((c) => ({ ...c, status: String(c.status) }));
}

/**
 * «نەگەیشتووە»: the office says this parcel is not here. Only the parcel's
 * own status moves back, to in_transit - its linked order, its charge and
 * its money are left exactly as they are. Refused unless it is one of this
 * box's missing parcels.
 */
export async function markMissingParcelNotArrived(boxId: number, packageId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const missing = await getBoxMissingParcels(boxId);
  if (!missing.some((m) => m.id === packageId)) return false;
  await db
    .update(packages)
    .set({ status: "in_transit" })
    .where(and(eq(packages.id, packageId), notInArray(packages.status, ["returned", "cancelled"])));
  return true;
}
