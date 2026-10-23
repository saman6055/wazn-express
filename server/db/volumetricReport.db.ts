/**
 * Volumetric parcels, counted - for the office only (owner, 2026-10-23).
 *
 * Every air parcel in the range, its scale, its volume, the kilos charged and
 * the discount, grouped by batch (against the carrier), by customer and by
 * box, with the parcels themselves biggest gap first. Reads only; the figures
 * are worked out in shared/volumetricReport.ts.
 */
import { and, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "./connection";
import { packages, batches, customers, deliveryBoxes, deliveryBoxItems } from "../../drizzle/schema";
import { getVolumetricDivisor } from "./settings.db";
import { getBatchCostsByRule } from "./batches.db";
import { DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";
import {
  addFigures, carrierVolumetric, roundFigures, volumetricOf, NO_FIGURES,
  type CarrierVolumetric, type VolumetricFigures,
} from "@shared/volumetricReport";

export interface VolumetricReportFilter {
  batchId?: number;
  customerId?: number;
  boxId?: number;
  from?: Date;
  to?: Date;
}

export interface VolumetricReport {
  total: VolumetricFigures;
  byBatch: Array<{ batchId: number; batchCode: string; figures: VolumetricFigures; carrier: CarrierVolumetric }>;
  byCustomer: Array<{ customerId: number; customerCode: string; customerName: string; figures: VolumetricFigures }>;
  byBox: Array<{ boxId: number; boxCode: string; customerCode: string; figures: VolumetricFigures }>;
  /** Parcels billed on their volume, the biggest gap first. */
  parcels: Array<{
    packageId: number;
    packageCode: string;
    trackingNumber: string | null;
    customerCode: string | null;
    batchCode: string | null;
    figures: VolumetricFigures;
  }>;
}

const AIR = ["air_regular", "air_irregular"] as const;
const PARCEL_LIMIT = 500;

export async function getVolumetricReport(filter: VolumetricReportFilter = {}): Promise<VolumetricReport> {
  const empty: VolumetricReport = { total: NO_FIGURES, byBatch: [], byCustomer: [], byBox: [], parcels: [] };
  const db = await getDb();
  if (!db) return empty;

  const where: SQL[] = [
    // Air only: the batch decides when the parcel is in one, else its own type.
    or(
      inArray(batches.shippingType, [...AIR]),
      and(isNull(packages.batchId), inArray(packages.shippingType, [...AIR])),
    )!,
  ];
  if (filter.batchId) where.push(eq(packages.batchId, filter.batchId));
  if (filter.customerId) where.push(eq(packages.customerId, filter.customerId));
  if (filter.from) where.push(gte(packages.createdAt, filter.from));
  if (filter.to) where.push(lte(packages.createdAt, filter.to));
  if (filter.boxId) {
    where.push(inArray(
      packages.id,
      sql`(SELECT ${deliveryBoxItems.packageId} FROM ${deliveryBoxItems} WHERE ${deliveryBoxItems.boxId} = ${filter.boxId})`,
    ));
  }

  const rows = await db
    .select({
      id: packages.id,
      packageCode: packages.packageCode,
      trackingNumber: packages.trackingNumber,
      customerId: packages.customerId,
      batchId: packages.batchId,
      weightKg: packages.weightKg,
      lengthCm: packages.lengthCm,
      widthCm: packages.widthCm,
      heightCm: packages.heightCm,
      volumeCbm: packages.volumeCbm,
      billedWeightKg: packages.billedWeightKg,
      calculatedCostUsd: packages.calculatedCostUsd,
      batchCode: batches.batchCode,
      pricePerKg: batches.pricePerKg,
      actualWeightKg: batches.actualWeightKg,
      chargedWeightKg: batches.chargedWeightKg,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(packages)
    .leftJoin(batches, eq(batches.id, packages.batchId))
    .leftJoin(customers, eq(customers.id, packages.customerId))
    .where(and(...where));
  if (rows.length === 0) return empty;

  const divisor = (await getVolumetricDivisor()) || DEFAULT_VOLUMETRIC_DIVISOR;
  const figuresOf = new Map<number, VolumetricFigures>();
  for (const r of rows) figuresOf.set(r.id, volumetricOf(r, divisor, Number(r.pricePerKg ?? 0) || 0));

  let total = NO_FIGURES;
  const batch = new Map<number, { code: string; actual: unknown; charged: unknown; figures: VolumetricFigures }>();
  const customer = new Map<number, { code: string; name: string; figures: VolumetricFigures }>();
  for (const r of rows) {
    const f = figuresOf.get(r.id)!;
    total = addFigures(total, f);
    if (r.batchId) {
      const b = batch.get(r.batchId) ?? { code: r.batchCode ?? `#${r.batchId}`, actual: r.actualWeightKg, charged: r.chargedWeightKg, figures: NO_FIGURES };
      b.figures = addFigures(b.figures, f);
      batch.set(r.batchId, b);
    }
    if (r.customerId) {
      const c = customer.get(r.customerId) ?? { code: r.customerCode ?? "", name: r.customerName ?? "", figures: NO_FIGURES };
      c.figures = addFigures(c.figures, f);
      customer.set(r.customerId, c);
    }
  }

  const costs = await getBatchCostsByRule(Array.from(batch.keys()));
  const byBatch = Array.from(batch.entries()).map(([batchId, b]) => {
    const figures = roundFigures(b.figures);
    const cost = costs.get(batchId);
    const costPerKg = cost && cost.unit === "kg" ? cost.effectiveRate : 0;
    return { batchId, batchCode: b.code, figures, carrier: carrierVolumetric(b.figures, { actualWeightKg: b.actual as string, chargedWeightKg: b.charged as string }, costPerKg) };
  }).sort((a, z) => z.batchId - a.batchId);

  const byCustomer = Array.from(customer.entries())
    .map(([customerId, c]) => ({ customerId, customerCode: c.code, customerName: c.name, figures: roundFigures(c.figures) }))
    .sort((a, z) => z.figures.extraKg - a.figures.extraKg);

  // The boxes these parcels went into (not cancelled).
  const ids = rows.map((r) => r.id);
  const boxLines = await db
    .select({ packageId: deliveryBoxItems.packageId, boxId: deliveryBoxes.id, boxCode: deliveryBoxes.boxCode, customerId: deliveryBoxes.customerId })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
    .where(and(inArray(deliveryBoxItems.packageId, ids), sql`${deliveryBoxes.status} <> 'cancelled'`));
  const codeOfCustomer = new Map(rows.map((r) => [r.customerId, r.customerCode ?? ""]));
  const box = new Map<number, { code: string; customerCode: string; figures: VolumetricFigures }>();
  for (const line of boxLines) {
    const f = line.packageId ? figuresOf.get(line.packageId) : undefined;
    if (!f) continue;
    const b = box.get(line.boxId) ?? { code: line.boxCode, customerCode: codeOfCustomer.get(line.customerId) ?? "", figures: NO_FIGURES };
    b.figures = addFigures(b.figures, f);
    box.set(line.boxId, b);
  }
  const byBox = Array.from(box.entries())
    .map(([boxId, b]) => ({ boxId, boxCode: b.code, customerCode: b.customerCode, figures: roundFigures(b.figures) }))
    .sort((a, z) => z.boxId - a.boxId);

  const parcels = rows
    .filter((r) => figuresOf.get(r.id)!.volumetricParcels > 0)
    .sort((a, z) => figuresOf.get(z.id)!.extraKg - figuresOf.get(a.id)!.extraKg)
    .slice(0, PARCEL_LIMIT)
    .map((r) => ({
      packageId: r.id,
      packageCode: r.packageCode,
      trackingNumber: r.trackingNumber,
      customerCode: r.customerCode,
      batchCode: r.batchCode,
      figures: roundFigures(figuresOf.get(r.id)!),
    }));

  return { total: roundFigures(total), byBatch, byCustomer, byBox, parcels };
}
