import { and, eq, inArray, isNotNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { deliveryBoxes, deliveryBoxItems, packages } from "../../drizzle/schema";

/**
 * What a box is still waiting for.
 *
 * The owner, 2026-10-20: a parcel forgotten at the scanner went home with
 * the customer and was billed by nobody (Zainab, 79135534330219, more than
 * once). And 2026-10-21, on the first version: «مەفرووز بوو لێرە بگۆتبایە
 * 10/3» - of the customer's 10 parcels in the batch, 3 scanned. So the box
 * counts EVERY parcel of its customer in its batch, wherever it is - at the
 * office or still on the road - except one returned or cancelled. A box made
 * by hand (no batch) waits for the customer's parcels at the office.
 *
 * Scanned means in any box that was not cancelled - this one or another,
 * open or long delivered - by the parcel itself or by its tracking.
 *
 * Nothing is stored and nothing is changed: before a receipt goes out the
 * office is only asked «ئاگاداری...؟» (owner, 2026-10-21) - see
 * BoxMissingParcels.tsx.
 */
export interface MissingParcel {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  batchId: number | null;
  status: string;
}

export interface BoxScanState {
  /** The customer's parcels this box counts. */
  total: number;
  /** Of those, the ones in a box. */
  scanned: number;
  /** The rest, by name. */
  missing: MissingParcel[];
}

const ENDED = ["returned", "cancelled"] as const;

export async function getBoxScanState(boxId: number): Promise<BoxScanState> {
  const none: BoxScanState = { total: 0, scanned: 0, missing: [] };
  const db = await getDb();
  if (!db) return none;
  const [box] = await db
    .select({ id: deliveryBoxes.id, customerId: deliveryBoxes.customerId, batchId: deliveryBoxes.batchId, status: deliveryBoxes.status })
    .from(deliveryBoxes)
    .where(eq(deliveryBoxes.id, boxId))
    .limit(1);
  if (!box || box.status === "cancelled") return none;

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
      box.batchId
        ? and(eq(packages.batchId, box.batchId), notInArray(packages.status, [...ENDED]))
        : and(isNotNull(packages.batchId), eq(packages.status, "ready_for_delivery")),
    ));
  if (candidates.length === 0) return none;

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
  const missing = candidates
    .filter((c) => !boxedIds.has(c.id) && !(c.trackingNumber && boxedTrackings.has(c.trackingNumber)))
    .map((c) => ({ ...c, status: String(c.status) }));
  return { total: candidates.length, scanned: candidates.length - missing.length, missing };
}

/** The missing parcels alone. */
export async function getBoxMissingParcels(boxId: number): Promise<MissingParcel[]> {
  return (await getBoxScanState(boxId)).missing;
}

/**
 * A batch's arrival puts its parcels at the office, not in the customer's
 * hands (owner, 2026-10-20). The batch's delivered flow still writes
 * "delivered" first - its orders, charges and money are worked out exactly
 * as before - and then this steps every parcel that is not in a handed-over
 * box back to ready_for_delivery. Only the parcel rows move; no order, no
 * charge, no ledger row. A parcel becomes delivered later through its box:
 * handed over, paid in full, or three days after the box was made
 * (deliverParcelsOfOldBoxes).
 */
export async function stepUnboxedBatchParcelsToArrived(batchId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const handedOver = db
    .select({ packageId: deliveryBoxItems.packageId })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(eq(deliveryBoxes.status, "delivered"), isNotNull(deliveryBoxItems.packageId)));
  const result = await db
    .update(packages)
    .set({ status: "ready_for_delivery", deliveredAt: null })
    .where(and(
      eq(packages.batchId, batchId),
      eq(packages.status, "delivered"),
      notInArray(packages.id, handedOver),
    ));
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}

/** Days a box may stand before its parcels count as delivered (owner, 2026-10-20). */
export const BOX_DELIVERED_AFTER_DAYS = 3;

/**
 * «کاتێ بۆکس دروست کرا دوای 3 رۆژ ببێتە گەیەنرا ئەگەر بە مەنوەلی بۆی نەکرا»:
 * the parcels inside a box made three days ago or more are delivered, if
 * nobody marked them so by hand. Only parcels inside a box, never a missing
 * one; only their status and date; the box, its orders and its money are
 * left as they are.
 */
export async function deliverParcelsOfOldBoxes(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(now.getTime() - BOX_DELIVERED_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const inOldBoxes = db
    .select({ packageId: deliveryBoxItems.packageId })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(
      ne(deliveryBoxes.status, "cancelled"),
      lte(deliveryBoxes.createdAt, cutoff),
      isNotNull(deliveryBoxItems.packageId),
    ));
  const result = await db
    .update(packages)
    .set({ status: "delivered", deliveredAt: now })
    .where(and(
      inArray(packages.status, ["ready_for_delivery", "out_for_delivery"]),
      inArray(packages.id, inOldBoxes),
    ));
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}

export interface NeverBoxedParcel {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number;
  customerCode: string | null;
  customerName: string | null;
  batchId: number | null;
  batchCode: string | null;
  calculatedCostUsd: string | null;
  isCharged: number;
  orderCode: string | null;
  deliveredAt: string | null;
}

/**
 * Read only. The parcels that went out marked delivered without ever being
 * in a box (owner, 2026-10-20: «ئەگەر تاکیدی لەسەری ئەوە بۆم دروست بکە») -
 * Zainab's 79135534330219 and every one like it before the box learned to
 * count. A parcel is in a box when a box that was not cancelled holds it, by
 * the parcel or by its tracking. Nothing here changes anything.
 */
export async function getParcelsDeliveredWithoutBox(): Promise<NeverBoxedParcel[]> {
  const db = await getDb();
  if (!db) return [];
  const [rows] = (await db.execute(sql`
    SELECT p.id, p.packageCode, p.trackingNumber, p.customerId,
           c.customerCode, c.fullName AS customerName,
           p.batchId, b.batchCode, p.calculatedCostUsd, p.isCharged,
           o.orderCode, p.deliveredAt
    FROM packages p
    JOIN customers c ON c.id = p.customerId
    LEFT JOIN batches b ON b.id = p.batchId
    LEFT JOIN fullPackageOrders o ON o.id = p.fullPackageOrderId
    WHERE p.status = 'delivered'
      AND p.isUnclaimed = 0
      AND NOT EXISTS (
        SELECT 1 FROM deliveryBoxItems i
        JOIN deliveryBoxes x ON x.id = i.boxId AND x.status <> 'cancelled'
        WHERE i.packageId = p.id
           OR (p.trackingNumber IS NOT NULL AND p.trackingNumber <> ''
               AND i.trackingNumber COLLATE utf8mb4_unicode_ci = p.trackingNumber COLLATE utf8mb4_unicode_ci)
      )
    ORDER BY p.id DESC
    LIMIT 2000
  `)) as unknown as [NeverBoxedParcel[]];
  return rows ?? [];
}
