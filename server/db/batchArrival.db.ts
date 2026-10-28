import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { countries, packageScans, packages } from "../../drizzle/schema";
import { batchMadeInChina } from "@shared/batchStage";

/**
 * When each batch last had goods arrive in Erbil: its last arrival scan, or
 * for a batch made in Erbil its last registration there. Forty hours after it
 * the batch reads «ئامادەیە بۆ دابەشکردن» (shared/batchStage). Two grouped
 * queries for the whole page.
 */
/** Made by the China office, per batch (null place = an old China batch). */
export async function madeInChinaPerBatch(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  rows: Array<{ id: number; createdInCountryId: number | null }>,
): Promise<Map<number, boolean>> {
  const chinaIds = new Set((await db.select({ id: countries.id }).from(countries).where(eq(countries.isoCode, "CN"))).map((r) => Number(r.id)));
  return new Map(rows.map((r) => [r.id, batchMadeInChina(r.createdInCountryId, chinaIds)]));
}

export async function lastArrivalPerBatch(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  rows: Array<{ id: number; createdInCountryId: number | null }>,
): Promise<Map<number, Date>> {
  const out = new Map<number, Date>();
  if (rows.length === 0) return out;
  const ids = rows.map((r) => r.id);
  const later = (id: number, v: unknown) => {
    if (!v) return;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return;
    const held = out.get(id);
    if (!held || d > held) out.set(id, d);
  };
  const scans = await db
    .select({ batchId: packages.batchId, at: sql<Date>`MAX(${packageScans.scannedAt})` })
    .from(packageScans)
    .innerJoin(packages, eq(packages.id, packageScans.packageId))
    .where(and(inArray(packages.batchId, ids), eq(packageScans.scanType, "received_local")))
    .groupBy(packages.batchId);
  for (const s of scans) later(Number(s.batchId), s.at);

  const chinaIds = new Set((await db.select({ id: countries.id }).from(countries).where(eq(countries.isoCode, "CN"))).map((r) => Number(r.id)));
  const erbilIds = rows.filter((r) => !batchMadeInChina(r.createdInCountryId, chinaIds)).map((r) => r.id);
  if (erbilIds.length > 0) {
    const regs = await db
      .select({ batchId: packages.batchId, at: sql<Date>`MAX(${packages.createdAt})` })
      .from(packages)
      .where(inArray(packages.batchId, erbilIds))
      .groupBy(packages.batchId);
    for (const r of regs) later(Number(r.batchId), r.at);
  }
  return out;
}
