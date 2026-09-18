import { getDb } from "./connection";
import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import { batches, customers, deletedRecords, deliveryBoxItems, deliveryBoxes, fullPackageOrders, users } from "../../drizzle/schema";
import type { InsertDeletedRecord } from "../../drizzle/schema";
import { deliveryBoxSnapshotFacts, type TrashItem } from "@shared/trash";

/**
 * A row as the bin keeps it, made fit to insert again.
 *
 * The bin stores JSON, so every date comes back as text. Restoring used to
 * turn a hand-written list of names back into dates, and a date missing from
 * the list reached the driver as text: the insert threw ("value.toISOString is
 * not a function"). A parcel's scannedAt was never on it, so since 2026-08-13
 * a box with parcels came back without them — the box row went in, its
 * parcels failed, and the box stood with a record counting parcels it did not
 * have (BOX-20260719-003, owner, 2026-09-17). A sealed box's sealedAt and a
 * batch's flightArrivedAt were missing too.
 *
 * Now every date column is revived, read from the table itself, and only the
 * table's own columns go in: a box item in the bin also carries what the
 * screen added to it (the advance, the order note, the order numbers).
 */
export function snapshotRowForInsert(table: MySqlTable, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (!(key in row)) continue;
    const value = row[key];
    out[key] = column.dataType === "date" && value != null && !(value instanceof Date) ? new Date(value as string) : value;
  }
  return out;
}

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
      customerId: fullPackageOrders.customerId,
      deletedAt: fullPackageOrders.deletedAt,
      deletionReason: fullPackageOrders.deletionReason,
      deletedById: fullPackageOrders.deletedById,
      deletedByName: users.name,
    })
    .from(fullPackageOrders)
    .leftJoin(users, eq(users.id, fullPackageOrders.deletedById))
    .where(isNotNull(fullPackageOrders.deletedAt))
    .orderBy(desc(fullPackageOrders.deletedAt));

  // Whose each box and order was, and what a box held (owner, 2026-09-17: a
  // bin of bare box codes does not say which is whose). Read-only.
  const boxFacts = new Map<number, ReturnType<typeof deliveryBoxSnapshotFacts>>();
  for (const r of snapshots) {
    if (r.entityType === "delivery_box") boxFacts.set(r.id, deliveryBoxSnapshotFacts(r.snapshot));
  }
  const customerIds = Array.from(new Set(
    [...Array.from(boxFacts.values()).map((f) => f.customerId), ...orders.map((o) => o.customerId)]
      .filter((id): id is number => typeof id === "number" && id > 0),
  ));
  const owners = new Map<number, { customerCode: string | null; fullName: string | null }>();
  if (customerIds.length > 0) {
    const rows = await db
      .select({ id: customers.id, customerCode: customers.customerCode, fullName: customers.fullName })
      .from(customers)
      .where(inArray(customers.id, customerIds));
    for (const row of rows) owners.set(row.id, row);
  }
  const ownerOf = (customerId: number | null | undefined) => {
    const owner = customerId ? owners.get(customerId) : undefined;
    return { customerCode: owner?.customerCode ?? null, customerName: owner?.fullName ?? null };
  };

  const items: TrashItem[] = [
    ...snapshots.map((r) => {
      const facts = boxFacts.get(r.id);
      return {
        key: `${r.entityType}:${r.entityId}`,
        entityType: r.entityType as TrashItem["entityType"],
        entityId: r.entityId,
        label: r.label,
        deletedAt: r.deletedAt,
        deletedById: r.deletedById,
        deletedByName: r.deletedByName,
        deletionReason: r.deletionReason,
        ...(facts
          ? { ...ownerOf(facts.customerId), parcelCount: facts.parcelCount, recordedParcels: facts.recordedParcels }
          : {}),
      };
    }),
    ...orders.map((o) => ({
      key: `full_package_order:${o.id}`,
      entityType: "full_package_order" as const,
      entityId: o.id,
      label: o.orderCode ?? `#${o.id}`,
      deletedAt: o.deletedAt!,
      deletedById: o.deletedById,
      deletedByName: o.deletedByName,
      deletionReason: o.deletionReason,
      ...ownerOf(o.customerId),
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
  await db.insert(batches).values(snapshotRowForInsert(batches, snapshot) as any);
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

/**
 * Put a box and its items back, with the ids they had — together or not at
 * all. A box back without its parcels is worse than a box still in the bin:
 * it looks whole, its record counts parcels, and nothing in it is real.
 */
export async function restoreDeliveryBoxFromSnapshot(
  box: Record<string, unknown>,
  items: Record<string, unknown>[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    await tx.insert(deliveryBoxes).values(snapshotRowForInsert(deliveryBoxes, box) as any);
    if (items.length > 0) {
      await tx.insert(deliveryBoxItems).values(items.map((item) => snapshotRowForInsert(deliveryBoxItems, item)) as any);
    }
  });
}
