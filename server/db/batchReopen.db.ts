import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import { batches, countries, deliveryBoxItems, packageScans, packages } from "../../drizzle/schema";
import { batchMadeInChina } from "@shared/batchStage";
import { batchHasShipmentNumber } from "@shared/parcelStage";

/**
 * Closing a batch stamps every parcel in it «delivered», arrived or not. A
 * reopened China batch must show its cartons that never came as still on the
 * road, or they can never be found as missing (audit 2026-11-05).
 *
 * Put back: a parcel of a China batch, stamped delivered, never checked in
 * (no received_local scan), not registered outside China, and in no customer
 * box - a box is the one real hand-over. It goes back to on the road when the
 * batch has a shipment number, else to in the batch. Nothing else is touched;
 * no money moves.
 */
export async function undoCloseStampsOnReopen(batchId: number): Promise<{ restored: number; codes: string[] }> {
  const db = await getDb();
  if (!db) return { restored: 0, codes: [] };
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch) return { restored: 0, codes: [] };
  const chinaIds = new Set((await db.select({ id: countries.id }).from(countries).where(eq(countries.isoCode, "CN"))).map((r) => Number(r.id)));
  if (!batchMadeInChina(batch.createdInCountryId, chinaIds)) return { restored: 0, codes: [] };

  const stamped = await db
    .select({ id: packages.id, code: packages.packageCode, registeredIn: packages.registeredInCountryId })
    .from(packages)
    .where(and(eq(packages.batchId, batchId), eq(packages.status, "delivered")));
  const candidates = stamped.filter((p) => p.registeredIn == null || chinaIds.has(Number(p.registeredIn)));
  if (candidates.length === 0) return { restored: 0, codes: [] };
  const ids = candidates.map((p) => Number(p.id));

  const scanned = new Set((await db.select({ id: packageScans.packageId }).from(packageScans)
    .where(and(inArray(packageScans.packageId, ids), eq(packageScans.scanType, "received_local")))).map((r) => Number(r.id)));
  const boxed = new Set((await db.select({ id: deliveryBoxItems.packageId }).from(deliveryBoxItems)
    .where(inArray(deliveryBoxItems.packageId, ids))).map((r) => Number(r.id)));

  const back = candidates.filter((p) => !scanned.has(Number(p.id)) && !boxed.has(Number(p.id)));
  if (back.length === 0) return { restored: 0, codes: [] };
  const status = batchHasShipmentNumber(batch) ? "in_transit" : "in_batch";
  await db.update(packages).set({ status, deliveredAt: null } as never)
    .where(inArray(packages.id, back.map((p) => Number(p.id))));
  return { restored: back.length, codes: back.map((p) => String(p.code ?? p.id)) };
}
