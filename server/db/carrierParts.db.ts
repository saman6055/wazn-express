/**
 * The loads a carrier delivers one batch in (owner, 2026-10-25).
 *
 * Each load has its own invoice: kilos (or CBM) billed and money paid. Once a
 * batch has loads, its billed weight and total cost ARE their sums - written
 * onto the batch through updateBatch, so the price history records the change
 * and every cost rule (shared/batchCost) keeps reading the batch as before.
 * Nothing here computes money of its own.
 *
 * A batch that already had one invoice typed on it, the old way, becomes load
 * 1 the moment a second load is added, so nothing typed is lost.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { batches, batchCarrierParts } from "../../drizzle/schema";
import { getBatchById, updateBatch } from "./batches.db";
import { sumCarrierParts } from "@shared/carrierParts";

export interface CarrierPartInput {
  arrivedOn?: string | null;
  billedKg?: string | null;
  billedCbm?: string | null;
  costUsd?: string | null;
  awbNumber?: string | null;
  note?: string | null;
}

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};
const decimalOrNull = (v: string | null | undefined) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? String(n) : null;
};

/** The money of the invoice typed on the batch, when only a rate was typed. */
function firstLoadCost(batch: { chargedWeightKg?: string | null; chargedCbm?: string | null; costPerKg?: string | null; costPerCbm?: string | null }): string | null {
  const kg = parseFloat(String(batch.chargedWeightKg ?? "")), perKg = parseFloat(String(batch.costPerKg ?? ""));
  if (kg > 0 && perKg > 0) return (Math.round(kg * perKg * 100) / 100).toFixed(2);
  const cbm = parseFloat(String(batch.chargedCbm ?? "")), perCbm = parseFloat(String(batch.costPerCbm ?? ""));
  if (cbm > 0 && perCbm > 0) return (Math.round(cbm * perCbm * 100) / 100).toFixed(2);
  return null;
}

export async function listCarrierParts(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchCarrierParts)
    .where(eq(batchCarrierParts.batchId, batchId))
    .orderBy(asc(batchCarrierParts.partNo));
}

/** Writes the loads' sums onto the batch - the one place they reach money. */
async function syncBatchFromParts(batchId: number, userId: number) {
  const parts = await listCarrierParts(batchId);
  if (parts.length === 0) return;
  const sum = sumCarrierParts(parts);
  await updateBatch(batchId, {
    chargedWeightKg: sum.billedKg,
    chargedCbm: sum.billedCbm,
    shippingCost: sum.costUsd,
  } as never, userId);
}

export async function addCarrierPart(batchId: number, input: CarrierPartInput, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found");

  let parts = await listCarrierParts(batchId);
  // The invoice typed on the batch before loads existed is load 1.
  if (parts.length === 0 && (decimalOrNull(batch.chargedWeightKg) || decimalOrNull(batch.chargedCbm) || decimalOrNull(batch.shippingCost))) {
    await db.insert(batchCarrierParts).values({
      batchId,
      partNo: 1,
      arrivedOn: batch.actualArrival ? new Date(batch.actualArrival).toISOString().slice(0, 10) : null,
      billedKg: decimalOrNull(batch.chargedWeightKg),
      billedCbm: decimalOrNull(batch.chargedCbm),
      // A total typed on the batch; else its weight at its typed rate (AIR-2026-069:
      // 74 kg at $8.80, no total) - or load 1 would carry no money at all.
      costUsd: decimalOrNull(batch.shippingCost) ?? decimalOrNull(firstLoadCost(batch)),
      awbNumber: clean(batch.awbNumber),
      createdById: userId,
    });
    parts = await listCarrierParts(batchId);
  }
  const partNo = parts.reduce((m, p) => Math.max(m, p.partNo), 0) + 1;
  await db.insert(batchCarrierParts).values({
    batchId,
    partNo,
    arrivedOn: clean(input.arrivedOn),
    billedKg: decimalOrNull(input.billedKg),
    billedCbm: decimalOrNull(input.billedCbm),
    costUsd: decimalOrNull(input.costUsd),
    awbNumber: clean(input.awbNumber),
    note: clean(input.note),
    createdById: userId,
  });
  await syncBatchFromParts(batchId, userId);
  return { partNo };
}

export async function updateCarrierPart(partId: number, input: CarrierPartInput, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [part] = await db.select().from(batchCarrierParts).where(eq(batchCarrierParts.id, partId)).limit(1);
  if (!part) throw new Error("Load not found");
  await db.update(batchCarrierParts).set({
    arrivedOn: clean(input.arrivedOn),
    billedKg: decimalOrNull(input.billedKg),
    billedCbm: decimalOrNull(input.billedCbm),
    costUsd: decimalOrNull(input.costUsd),
    awbNumber: clean(input.awbNumber),
    note: clean(input.note),
  }).where(eq(batchCarrierParts.id, partId));
  await syncBatchFromParts(part.batchId, userId);
  return { batchId: part.batchId };
}

/**
 * A load taken out. The last one taken out leaves the batch's figures as the
 * loads last summed them - the batch is back to one invoice typed on itself.
 */
export async function removeCarrierPart(partId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [part] = await db.select().from(batchCarrierParts).where(eq(batchCarrierParts.id, partId)).limit(1);
  if (!part) throw new Error("Load not found");
  await db.delete(batchCarrierParts).where(eq(batchCarrierParts.id, partId));
  await syncBatchFromParts(part.batchId, userId);
  return { batchId: part.batchId };
}

export async function partBatchId(partId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [part] = await db.select({ batchId: batchCarrierParts.batchId }).from(batchCarrierParts).where(eq(batchCarrierParts.id, partId)).limit(1);
  return part ? part.batchId : null;
}

/** An admin: "I know why the bill is short - do not wait." Null note undoes it. */
export async function setPartsAccepted(batchId: number, note: string | null, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const text = clean(note);
  await db.update(batches).set(text
    ? { partsAcceptedAt: new Date(), partsAcceptedById: userId, partsAcceptedNote: text }
    : { partsAcceptedAt: null, partsAcceptedById: null, partsAcceptedNote: null },
  ).where(eq(batches.id, batchId));
}
