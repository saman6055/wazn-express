import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "./connection";
import {
  deliveryBoxItems,
  fullPackageOrders,
  fullPackageOrderTrackings,
  packages,
} from "../../drizzle/schema";
import { appLogger } from "../utils/logger";

/**
 * The goods a customer already has, put on their account.
 *
 * An order bought for a customer — کڕین بە تێچوو or پاکێجی تەواو — is a debt
 * from the moment it is entered (fullPackage.db chargeOrderAtCreation, the
 * owner's rule of 2026-09-15). That covers every order typed in since. It
 * does not cover the ones typed in before it, and it cannot cover an entry
 * whose charge failed, because that path deliberately never throws.
 *
 * For those, there was no second door. An order that travels as a *parcel*
 * in a batch — the box item carries `packageId`, not `fullPackageOrderId` —
 * slipped past all four:
 *
 *  • batch pricing charges shipping for self-order parcels only, because an
 *    order is billed through its own invoice (batchCharging.db);
 *  • marking the box delivered updates orders reached through
 *    `fullPackageOrderId`, and a parcel-shaped carton has none
 *    (lib/boxLifecycle markBoxContentsDelivered);
 *  • the receipt refuses to charge an order carton, because the order flow
 *    is supposed to have done it (boxSettlement.db);
 *  • and the order's own delivery charge fires on the ORDER's status, which
 *    nothing moved.
 *
 * Every one of those four is right on its own. Together they left a customer
 * holding $211 of goods with nothing on their account — and then a receipt
 * for the box posted the payment and the discount as credits against a debt
 * that was never there, which is how an account ends up owing the customer
 * money for goods they were given.
 *
 * So this is the fifth door, and it is the one the owner named, 2026-09-26:
 * the invoice exists when the tracking goes into the box, and when the batch
 * is delivered. Both call the same thing, it is idempotent through
 * `isCharged` / `chargeTransactionId`, and it charges through the identical
 * path an order entered today takes — so nothing can be billed twice, and
 * the amount is the one rule there has ever been.
 */

/** A tracking, as it is written on a parcel and on an order. */
const clean = (t: string | null | undefined): string => String(t ?? "").trim();

/**
 * Charge every order that arrived on these trackings and has never been
 * billed. Returns what it did, and never throws: an order that cannot be
 * charged is one the office can still see and fix, while a refusal here
 * would stop a parcel going into a box.
 */
export async function chargeOrdersBehindTrackings(
  trackingNumbers: Array<string | null | undefined>,
  userId: number,
): Promise<{ charged: number; amountUsd: number }> {
  const trackings = Array.from(new Set(trackingNumbers.map(clean).filter(Boolean)));
  if (trackings.length === 0) return { charged: 0, amountUsd: 0 };

  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0 };

  try {
    // An order names its tracking in one of two places: on the order itself,
    // or in its list of trackings when it arrived in several pieces.
    const [direct, viaList] = await Promise.all([
      db
        .select({ id: fullPackageOrders.id })
        .from(fullPackageOrders)
        .where(inArray(fullPackageOrders.trackingNumber, trackings)),
      db
        .select({ id: fullPackageOrderTrackings.fullPackageOrderId })
        .from(fullPackageOrderTrackings)
        .where(inArray(fullPackageOrderTrackings.trackingNumber, trackings)),
    ]);

    const ids = Array.from(new Set([...direct, ...viaList].map((r) => Number(r.id)).filter(Boolean)));
    if (ids.length === 0) return { charged: 0, amountUsd: 0 };

    /*
     * Only what has never been billed, and only what can be: a quote is not
     * a debt until it is approved, and a deleted order is not a debt at all.
     * `chargeOrderAtCreation` checks the same things again — this is here so
     * the common case costs one query and no work.
     */
    const rows = await db
      .select()
      .from(fullPackageOrders)
      .where(and(
        inArray(fullPackageOrders.id, ids),
        eq(fullPackageOrders.isCharged, false),
        isNull(fullPackageOrders.chargeTransactionId),
        isNull(fullPackageOrders.deletedAt),
      ));

    let charged = 0;
    let amountUsd = 0;
    // Imported here, not at the top: fullPackage.db is a large module that
    // reaches back into this side of the graph, and a cycle between them
    // surfaces as an unrelated "not a function" at runtime.
    const { chargeOrderAtCreation } = await import("./fullPackage.db");
    for (const order of rows) {
      const result = await chargeOrderAtCreation(order as never, userId);
      if (result.charged) {
        charged += 1;
        amountUsd = Math.round((amountUsd + result.amount) * 100) / 100;
      }
    }
    if (charged > 0) {
      appLogger.info("[OrderCharge] billed orders that travelled as parcels", {
        trackings: trackings.length, charged, amountUsd,
      });
    }
    return { charged, amountUsd };
  } catch (e) {
    appLogger.error("[OrderCharge] failed to bill orders behind parcels", {
      trackings: trackings.length,
      error: e instanceof Error ? e.message : String(e),
    });
    return { charged: 0, amountUsd: 0 };
  }
}

/**
 * The moment a tracking is in the box.
 *
 * The goods are in front of the customer; the account must already know what
 * they cost. Called from every door that puts items in a box.
 */
export async function chargeOrdersInBox(
  boxId: number,
  userId: number,
): Promise<{ charged: number; amountUsd: number }> {
  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0 };
  const items = await db
    .select({
      trackingNumber: deliveryBoxItems.trackingNumber,
      orderId: deliveryBoxItems.fullPackageOrderId,
    })
    .from(deliveryBoxItems)
    .where(eq(deliveryBoxItems.boxId, boxId));
  if (items.length === 0) return { charged: 0, amountUsd: 0 };

  const byTracking = await chargeOrdersBehindTrackings(items.map((i) => i.trackingNumber), userId);

  // A carton that names its order outright does not need the tracking at all.
  const named = Array.from(new Set(items.map((i) => Number(i.orderId)).filter(Boolean)));
  if (named.length === 0) return byTracking;

  const rows = await db
    .select()
    .from(fullPackageOrders)
    .where(and(
      inArray(fullPackageOrders.id, named),
      eq(fullPackageOrders.isCharged, false),
      isNull(fullPackageOrders.chargeTransactionId),
      isNull(fullPackageOrders.deletedAt),
    ));
  if (rows.length === 0) return byTracking;

  const { chargeOrderAtCreation } = await import("./fullPackage.db");
  let charged = byTracking.charged;
  let amountUsd = byTracking.amountUsd;
  for (const order of rows) {
    const result = await chargeOrderAtCreation(order as never, userId);
    if (result.charged) {
      charged += 1;
      amountUsd = Math.round((amountUsd + result.amount) * 100) / 100;
    }
  }
  return { charged, amountUsd };
}

/**
 * The moment the batch is delivered.
 *
 * The safety net for everything that reached Erbil without passing a box —
 * and for boxes built before this door existed. Same idempotent charge.
 */
export async function chargeOrdersInBatch(
  batchId: number,
  userId: number,
): Promise<{ charged: number; amountUsd: number }> {
  const db = await getDb();
  if (!db) return { charged: 0, amountUsd: 0 };
  const rows = await db
    .select({ trackingNumber: packages.trackingNumber })
    .from(packages)
    .where(eq(packages.batchId, batchId));
  return chargeOrdersBehindTrackings(rows.map((r) => r.trackingNumber), userId);
}
