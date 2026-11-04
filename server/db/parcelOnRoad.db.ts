import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import { batches, countries, deliveryBoxItems, deliveryBoxes, packageScans, packages } from "../../drizzle/schema";
import { batchMadeInChina } from "@shared/batchStage";

/** Statuses of a parcel that has not reached Erbil. */
const NOT_HERE = ["registered", "in_batch", "in_transit"];

/**
 * The parcels among these that are still on the road from China: in a batch
 * made in China, registered in China (or nowhere recorded), never checked in
 * at Erbil, and with a status that says so. «Box them all» puts such cartons
 * in their customer's box on purpose (owner, 2026-11-02); paying the box must
 * not then call them delivered before they come (audit 2026-11-05).
 */
export async function parcelsStillOnTheRoad(packageIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  const db = await getDb();
  if (!db || packageIds.length === 0) return out;
  const rows = await db
    .select({ id: packages.id, status: packages.status, registeredIn: packages.registeredInCountryId, batchCountry: batches.createdInCountryId })
    .from(packages)
    .innerJoin(batches, eq(batches.id, packages.batchId))
    .where(and(inArray(packages.id, packageIds), inArray(packages.status, NOT_HERE as never)));
  if (rows.length === 0) return out;
  const chinaIds = new Set((await db.select({ id: countries.id }).from(countries).where(eq(countries.isoCode, "CN"))).map((r) => Number(r.id)));
  const fromChina = rows.filter((r) => batchMadeInChina(r.batchCountry, chinaIds) && (r.registeredIn == null || chinaIds.has(Number(r.registeredIn))));
  if (fromChina.length === 0) return out;
  const scanned = new Set((await db.select({ id: packageScans.packageId }).from(packageScans)
    .where(and(inArray(packageScans.packageId, fromChina.map((r) => Number(r.id))), eq(packageScans.scanType, "received_local"))))
    .map((r) => Number(r.id)));
  for (const r of fromChina) if (!scanned.has(Number(r.id))) out.add(Number(r.id));
  return out;
}

/**
 * A parcel arriving now whose box was already finished (paid in full while
 * it was on the road) is delivered with its box, not left «ready».
 */
export async function parcelInFinishedBox(packageId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: deliveryBoxItems.id })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
    .where(and(eq(deliveryBoxItems.packageId, packageId), eq(deliveryBoxes.status, "delivered")))
    .limit(1);
  return !!row;
}
