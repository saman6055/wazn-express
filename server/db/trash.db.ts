import { getDb } from "./connection";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { batches, deletedRecords, deliveryBoxItems, deliveryBoxes, fullPackageOrders, users } from "../../drizzle/schema";
import type { InsertDeletedRecord } from "../../drizzle/schema";
import type { TrashItem } from "@shared/trash";

/** Put a complete copy of a row into the bin, before it is deleted. */
export async function recordDeletion(entry: InsertDeletedRecord): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(deletedRecords).values(entry);
}

/**
 * Everything currently in the bin, newest first.
 *
 * Two sources, because two deletion models exist: snapshots taken of rows
 * that were removed outright, and rows still in place carrying a deletedAt
 * marker. They are normalised here so the screen never has to care which is
 * which.
 */
export async function listTrash(): Promise<TrashItem[]> {
  const db = await getDb();
  if (!db) return [];

  const snapshots = await db
    .select()
    .from(deletedRecords)
    .orderBy(desc(deletedRecords.deletedAt));

  const orders = await db
    .select({
      id: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      deletedAt: fullPackageOrders.deletedAt,
      deletionReason: fullPackageOrders.deletionReason,
      deletedById: fullPackageOrders.deletedById,
      deletedByName: users.name,
    })
    .from(fullPackageOrders)
    .leftJoin(users, eq(users.id, fullPackageOrders.deletedById))
    .where(isNotNull(fullPackageOrders.deletedAt))
    .orderBy(desc(fullPackageOrders.deletedAt));

  const items: TrashItem[] = [
    ...snapshots.map((r) => ({
      key: `${r.entityType}:${r.entityId}`,
      entityType: r.entityType as TrashItem["entityType"],
      entityId: r.entityId,
      label: r.label,
      deletedAt: r.deletedAt,
      deletedById: r.deletedById,
      deletedByName: r.deletedByName,
      deletionReason: r.deletionReason,
    })),
    ...orders.map((o) => ({
      key: `full_package_order:${o.id}`,
      entityType: "full_package_order" as const,
      entityId: o.id,
      label: o.orderCode ?? `#${o.id}`,
      deletedAt: o.deletedAt!,
      deletedById: o.deletedById,
      deletedByName: o.deletedByName,
      deletionReason: o.deletionReason,
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );
}

/** The stored snapshot for one deleted record, if the bin still has it. */
export async function getDeletedRecord(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(deletedRecords)
    .where(and(eq(deletedRecords.entityType, entityType), eq(deletedRecords.entityId, entityId)))
    .limit(1);
  return row ?? null;
}

/** Drop a bin entry — used after a successful restore, and by purge. */
export async function removeDeletedRecord(entityType: string, entityId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(deletedRecords)
    .where(and(eq(deletedRecords.entityType, entityType), eq(deletedRecords.entityId, entityId)));
}

/** Is a batch code free? Checked before restoring — it may have been reused. */
export async function isBatchCodeFree(batchCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(eq(batches.batchCode, batchCode))
    .limit(1);
  return !row;
}

/** Does a batch with this id already exist? Guards a double restore. */
export async function batchExists(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: batches.id }).from(batches).where(eq(batches.id, id)).limit(1);
  return !!row;
}

/**
 * Put a batch back, with the id it had.
 *
 * Keeping the original id matters: anything that recorded this batch by id
 * while it was gone — a scan log, an audit entry — points at the right row
 * again rather than at a stranger.
 */
export async function restoreBatchFromSnapshot(snapshot: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const row: Record<string, unknown> = { ...snapshot };
  for (const key of ["createdAt", "updatedAt", "departureDate", "estimatedArrival", "actualArrival"]) {
    if (row[key]) row[key] = new Date(row[key] as string);
  }
  await db.insert(batches).values(row as any);
}

/** Clear the deletedAt marker on a full-package order. */
export async function restoreFullPackageOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(fullPackageOrders)
    .set({ deletedAt: null, deletedById: null, deletionReason: null })
    .where(eq(fullPackageOrders.id, id));
}

/** Is this order actually in the bin? */
export async function getDeletedFullPackageOrder(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ id: fullPackageOrders.id, orderCode: fullPackageOrders.orderCode, customerId: fullPackageOrders.customerId, deletedAt: fullPackageOrders.deletedAt })
    .from(fullPackageOrders)
    .where(and(eq(fullPackageOrders.id, id), isNotNull(fullPackageOrders.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Remove an order for good. Admin only, and there is no way back. */
export async function purgeFullPackageOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fullPackageOrders).where(and(eq(fullPackageOrders.id, id), isNotNull(fullPackageOrders.deletedAt)));
}

// ============ DELIVERY BOXES ↔ TRASH ============

/**
 * Delete a box and the items inside it, returning what was there.
 *
 * The items are snapshots of what was scanned in, not the parcels
 * themselves — nothing else in the system points at a box, and no invoice or
 * ledger entry references one — so a box that was never delivered can be
 * removed cleanly. The rows come back so the bin can put them all back.
 */
export async function deleteDeliveryBoxWithItems(
  boxId: number
): Promise<Record<string, unknown>[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const items = await db.select().from(deliveryBoxItems).where(eq(deliveryBoxItems.boxId, boxId));
  await db.delete(deliveryBoxItems).where(eq(deliveryBoxItems.boxId, boxId));
  await db.delete(deliveryBoxes).where(eq(deliveryBoxes.id, boxId));
  return items as unknown as Record<string, unknown>[];
}

/** Is a box with this id already back? Guards a double restore. */
export async function deliveryBoxExists(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: deliveryBoxes.id }).from(deliveryBoxes).where(eq(deliveryBoxes.id, id)).limit(1);
  return !!row;
}

/** Is a box code free? Checked before restoring — it may have been reused. */
export async function isBoxCodeFree(boxCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: deliveryBoxes.id }).from(deliveryBoxes).where(eq(deliveryBoxes.boxCode, boxCode)).limit(1);
  return !row;
}

/** Put a box and its items back, with the ids they had. */
export async function restoreDeliveryBoxFromSnapshot(
  box: Record<string, unknown>,
  items: Record<string, unknown>[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const dates = ["createdAt", "updatedAt", "deliveredAt", "cancelledAt", "readyAt", "customerConfirmedAt"];
  const revive = (row: Record<string, unknown>) => {
    const out = { ...row };
    for (const key of dates) if (out[key]) out[key] = new Date(out[key] as string);
    return out;
  };

  await db.insert(deliveryBoxes).values(revive(box) as any);
  if (items.length > 0) {
    await db.insert(deliveryBoxItems).values(items.map(revive) as any);
  }
}
