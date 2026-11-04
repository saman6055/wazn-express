import { sql } from "drizzle-orm";
import { getDb } from "./connection";
import { appLogger } from "../utils/logger";

/**
 * Each carrier at a glance (owner, 2026-11-05: «لەم هەفتە چەند کیلۆمان
 * هەبووە، لە مانگێ چەند بوو، کام کۆمپانیا زووتر بارەکانی دەگات، کامە نرخی
 * باشە»). Read only, from what the batches already record:
 *   - the carrier: the batch's shipping company, else the first word of the
 *     carrier's batch number ("ANC 169" → ANC);
 *   - kilos: the carrier's billed kilos and our parcels' own kilos, for the
 *     batches that left in the last 7 and 30 days (by departure, else made);
 *   - days on the road: departure to actual arrival, batches that arrived in
 *     the last 90 days;
 *   - price: what the carrier billed per kilo, over the 30 days, where both
 *     the bill and its kilos are written.
 */
export interface CarrierRow {
  carrier: string;
  batchesMonth: number;
  carrierKgWeek: number;
  carrierKgMonth: number;
  ourKgWeek: number;
  ourKgMonth: number;
  ourKgPrevWeek: number;
  avgDays: number | null;
  arrivedCount: number;
  usdPerKg: number | null;
}

const CARRIER = sql.raw(`COALESCE(NULLIF(TRIM(b.shippingCompany), ''), NULLIF(SUBSTRING_INDEX(TRIM(b.carrierBatchNo), ' ', 1), ''), '—')`);
const LEFT_AT = sql.raw(`COALESCE(b.departureDate, b.createdAt)`);

export async function getCarrierSummary(): Promise<CarrierRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const [rows] = (await db.execute(sql`
      SELECT ${CARRIER} AS carrier,
             SUM(${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)) AS batchesMonth,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN CAST(COALESCE(b.chargedWeightKg, 0) AS DECIMAL(12,2)) ELSE 0 END) AS carrierKgWeek,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) THEN CAST(COALESCE(b.chargedWeightKg, 0) AS DECIMAL(12,2)) ELSE 0 END) AS carrierKgMonth,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN COALESCE(k.kg, 0) ELSE 0 END) AS ourKgWeek,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY) AND ${LEFT_AT} < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN COALESCE(k.kg, 0) ELSE 0 END) AS ourKgPrevWeek,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) THEN COALESCE(k.kg, 0) ELSE 0 END) AS ourKgMonth,
             AVG(CASE WHEN b.actualArrival IS NOT NULL AND b.departureDate IS NOT NULL
                       AND b.actualArrival >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
                       AND b.actualArrival >= b.departureDate
                      THEN TIMESTAMPDIFF(HOUR, b.departureDate, b.actualArrival) / 24 END) AS avgDays,
             SUM(b.actualArrival IS NOT NULL AND b.departureDate IS NOT NULL AND b.actualArrival >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)) AS arrivedCount,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
                       AND CAST(COALESCE(b.shippingCost, 0) AS DECIMAL(12,2)) > 0 AND CAST(COALESCE(b.chargedWeightKg, 0) AS DECIMAL(12,2)) > 0
                      THEN CAST(b.shippingCost AS DECIMAL(12,2)) ELSE 0 END) AS billUsd,
             SUM(CASE WHEN ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
                       AND CAST(COALESCE(b.shippingCost, 0) AS DECIMAL(12,2)) > 0 AND CAST(COALESCE(b.chargedWeightKg, 0) AS DECIMAL(12,2)) > 0
                      THEN CAST(b.chargedWeightKg AS DECIMAL(12,2)) ELSE 0 END) AS billKg
      FROM batches b
      LEFT JOIN (
        SELECT batchId, SUM(CAST(COALESCE(weightKg, 0) AS DECIMAL(12,3))) AS kg
        FROM packages WHERE batchId IS NOT NULL AND status NOT IN ('cancelled','returned')
        GROUP BY batchId
      ) k ON k.batchId = b.id
      WHERE ${LEFT_AT} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
         OR b.actualArrival >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)
      GROUP BY carrier
      ORDER BY ourKgMonth DESC`)) as unknown as [Array<Record<string, unknown>>];
    const n = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
    return (rows ?? [])
      .map((r) => ({
        carrier: String(r.carrier ?? "—"),
        batchesMonth: Number(r.batchesMonth) || 0,
        carrierKgWeek: n(r.carrierKgWeek),
        carrierKgMonth: n(r.carrierKgMonth),
        ourKgWeek: n(r.ourKgWeek),
        ourKgMonth: n(r.ourKgMonth),
        ourKgPrevWeek: n(r.ourKgPrevWeek),
        avgDays: r.avgDays == null ? null : Math.round(Number(r.avgDays) * 10) / 10,
        arrivedCount: Number(r.arrivedCount) || 0,
        usdPerKg: Number(r.billKg) > 0 ? Math.round((Number(r.billUsd) / Number(r.billKg)) * 100) / 100 : null,
      }))
      .filter((r) => r.batchesMonth > 0 || r.arrivedCount > 0);
  } catch (error) {
    appLogger.warn("[carrier summary] failed", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}
