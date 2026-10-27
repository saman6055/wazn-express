/**
 * What the dispatch check knows, for the people who use it after China
 * (owner, 2026-10-26): where each batch stands (shared/dispatchStage), the
 * batch in figures - trackings, kilos, volume, the parcels whose size costs
 * most, every customer and their cartons - a search for "where is my
 * parcel?", and the portal notice each customer gets when their goods leave.
 * Read only, except the notice.
 */
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { batchCartonItems, batchCartons, batches, customerNotifications, customers, packageScans, packages } from "../../drizzle/schema";
import { chargeableWeight } from "@shared/chargeableWeight";
import { billLooksPartial } from "@shared/carrierParts";
import { dispatchStage, leftChinaNotice, parcelHasArrived, type DispatchStage } from "@shared/dispatchStage";
import { getVolumetricDivisor } from "./settings.db";
import { createCustomerNotification } from "./portal.db";
import { getDispatchHistory } from "./dispatch.db";
import { appLogger } from "../utils/logger";

async function need() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Every packed parcel of these batches, with whether it has reached Erbil. */
async function packedParcels(batchIds: number[]) {
  const db = await need();
  if (batchIds.length === 0) return [];
  const rows = await db
    .select({
      batchId: batchCartonItems.batchId,
      cartonId: batchCartonItems.cartonId,
      cartonNo: batchCartons.cartonNo,
      packageId: packages.id,
      trackingNumber: packages.trackingNumber,
      packageCode: packages.packageCode,
      status: packages.status,
      weightKg: packages.weightKg,
      billedWeightKg: packages.billedWeightKg,
      lengthCm: packages.lengthCm,
      widthCm: packages.widthCm,
      heightCm: packages.heightCm,
      customerId: packages.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      mobile: customers.mobileNumber,
    })
    .from(batchCartonItems)
    .innerJoin(packages, eq(packages.id, batchCartonItems.packageId))
    .innerJoin(batchCartons, eq(batchCartons.id, batchCartonItems.cartonId))
    .leftJoin(customers, eq(customers.id, packages.customerId))
    .where(inArray(batchCartonItems.batchId, batchIds));
  const ids = rows.map((r) => r.packageId);
  const scanned = new Set(
    ids.length === 0
      ? []
      : (await db.selectDistinct({ id: packageScans.packageId }).from(packageScans)
          .where(and(inArray(packageScans.packageId, ids), eq(packageScans.scanType, "received_local")))).map((r) => Number(r.id)),
  );
  const divisor = await getVolumetricDivisor();
  return rows.map((r) => {
    const w = chargeableWeight(r, divisor);
    return {
      ...r,
      arrived: parcelHasArrived({ scannedIn: scanned.has(r.packageId), status: r.status }),
      scaleKg: w.actualKg,
      volumeKg: w.volumetricKg,
      fullKg: w.fullKg ?? w.chargeableKg,
    };
  });
}

/** The cards: every batch packed in China, with its stage and what is missing. */
export async function getDispatchOverview() {
  const history = await getDispatchHistory();
  const ids = history.map((h) => h.batchId);
  const parcels = await packedParcels(ids);
  const db = await need();
  const money = ids.length === 0 ? [] : await db
    .select({ id: batches.id, chargedWeightKg: batches.chargedWeightKg, partsAcceptedAt: batches.partsAcceptedAt })
    .from(batches).where(inArray(batches.id, ids));
  const moneyOf = new Map(money.map((m) => [Number(m.id), m]));

  return history.map((h) => {
    const mine = parcels.filter((p) => p.batchId === h.batchId);
    const arrived = mine.filter((p) => p.arrived).length;
    const stage: DispatchStage = dispatchStage({ finished: !!h.finishedAt, packed: mine.length, arrived });
    const byCarton = new Map<number, { cartonNo: number; total: number; missing: number }>();
    for (const p of mine) {
      const c = byCarton.get(p.cartonId) ?? { cartonNo: p.cartonNo, total: 0, missing: 0 };
      c.total += 1;
      if (!p.arrived) c.missing += 1;
      byCarton.set(p.cartonId, c);
    }
    const missingCartons = Array.from(byCarton.values()).filter((c) => c.missing > 0).sort((a, b) => a.cartonNo - b.cartonNo);
    // Short because a second load is still on its way (shared/carrierParts).
    const m = moneyOf.get(h.batchId);
    const ourKg = mine.reduce((s, p) => s + p.fullKg, 0);
    const waitingSecondLoad = stage === "arriving" && !m?.partsAcceptedAt && billLooksPartial(ourKg, Number(m?.chargedWeightKg) || 0);
    return { ...h, stage, packed: mine.length, arrived, missingCartons, waitingSecondLoad };
  });
}

/** One batch in figures - opened by a click on its card. */
export async function getDispatchDetails(batchId: number) {
  const parcels = await packedParcels([batchId]);
  const cartons = new Set(parcels.map((p) => p.cartonId));
  const customersMap = new Map<string, {
    customerId: number | null; customerCode: string | null; customerName: string | null; mobile: string | null;
    count: number; scaleKg: number; fullKg: number; cartons: Set<number>; trackings: string[]; arrived: number;
  }>();
  for (const p of parcels) {
    const key = String(p.customerId ?? "none");
    const c = customersMap.get(key) ?? { customerId: p.customerId ?? null, customerCode: p.customerCode ?? null, customerName: p.customerName ?? null, mobile: p.mobile ?? null, count: 0, scaleKg: 0, fullKg: 0, cartons: new Set<number>(), trackings: [], arrived: 0 };
    c.count += 1;
    c.scaleKg += p.scaleKg;
    c.fullKg += p.fullKg;
    c.cartons.add(p.cartonNo);
    c.trackings.push(p.trackingNumber || p.packageCode);
    if (p.arrived) c.arrived += 1;
    customersMap.set(key, c);
  }
  const topVolume = parcels
    .filter((p) => p.volumeKg > p.scaleKg)
    .sort((a, b) => (b.volumeKg - b.scaleKg) - (a.volumeKg - a.scaleKg))
    .slice(0, 5)
    .map((p) => ({
      trackingNumber: p.trackingNumber || p.packageCode,
      customerCode: p.customerCode,
      cartonNo: p.cartonNo,
      scaleKg: r2(p.scaleKg),
      volumeKg: r2(p.volumeKg),
      times: p.scaleKg > 0 ? Math.round((p.volumeKg / p.scaleKg) * 10) / 10 : null,
    }));
  return {
    totals: {
      trackings: parcels.length,
      cartons: cartons.size,
      customers: customersMap.size,
      scaleKg: r2(parcels.reduce((s, p) => s + p.scaleKg, 0)),
      volumeKg: r2(parcels.reduce((s, p) => s + p.volumeKg, 0)),
      chargedKg: r2(parcels.reduce((s, p) => s + p.fullKg, 0)),
      arrived: parcels.filter((p) => p.arrived).length,
    },
    topVolume,
    customers: Array.from(customersMap.values())
      .map((c) => ({ ...c, scaleKg: r2(c.scaleKg), fullKg: r2(c.fullKg), cartons: Array.from(c.cartons).sort((a, b) => a - b) }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * "Where is my parcel?" for the office in Erbil: a tracking, or a customer's
 * code, against every batch packed in China.
 */
export async function findInDispatch(query: string) {
  const q = query.trim();
  if (q.length < 3) return [];
  const db = await need();
  const rows = await db
    .select({
      batchId: batchCartonItems.batchId,
      batchCode: batches.batchCode,
      cartonNo: batchCartons.cartonNo,
      packageId: packages.id,
      trackingNumber: packages.trackingNumber,
      status: packages.status,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      finishedAt: batches.dispatchCheckedAt,
    })
    .from(batchCartonItems)
    .innerJoin(packages, eq(packages.id, batchCartonItems.packageId))
    .innerJoin(batchCartons, eq(batchCartons.id, batchCartonItems.cartonId))
    .innerJoin(batches, eq(batches.id, batchCartonItems.batchId))
    .leftJoin(customers, eq(customers.id, packages.customerId))
    .where(or(eq(customers.customerCode, q.toUpperCase()), eq(packages.trackingNumber, q), like(packages.trackingNumber, `%${q.replace(/[%_]/g, "")}`)))
    .limit(200);
  const ids = rows.map((r) => r.packageId);
  const scanned = new Set(
    ids.length === 0
      ? []
      : (await db.selectDistinct({ id: packageScans.packageId }).from(packageScans)
          .where(and(inArray(packageScans.packageId, ids), eq(packageScans.scanType, "received_local")))).map((r) => Number(r.id)),
  );
  return rows.map((r) => {
    const arrived = parcelHasArrived({ scannedIn: scanned.has(r.packageId), status: r.status });
    return { ...r, arrived, stage: !r.finishedAt ? ("packing" as const) : arrived ? ("arrived" as const) : ("left" as const) };
  });
}

/**
 * The portal tells every customer whose goods are in the cartons (owner,
 * 2026-10-26: automatic, no arrival date). Once per customer per batch: a
 * second finish, after a reopened carton, does not tell them twice.
 */
export async function notifyLeftChina(batchId: number): Promise<number> {
  const db = await need();
  const [batch] = await db.select({ batchCode: batches.batchCode }).from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch) return 0;
  const counts = await db
    .select({ customerId: packages.customerId, n: sql<number>`COUNT(*)` })
    .from(batchCartonItems)
    .innerJoin(packages, eq(packages.id, batchCartonItems.packageId))
    .where(and(eq(batchCartonItems.batchId, batchId), sql`${packages.customerId} IS NOT NULL`))
    .groupBy(packages.customerId);
  const text = (n: number) => leftChinaNotice(batch.batchCode, n);
  const already = new Set(
    (await db.select({ customerId: customerNotifications.customerId }).from(customerNotifications)
      .where(and(eq(customerNotifications.relatedType, "batch"), eq(customerNotifications.relatedId, batchId), eq(customerNotifications.title, text(1).titleEn))))
      .map((r) => Number(r.customerId)),
  );
  let told = 0;
  for (const c of counts) {
    const customerId = Number(c.customerId);
    if (!customerId || already.has(customerId)) continue;
    const t = text(Number(c.n) || 0);
    try {
      await createCustomerNotification({
        customerId,
        type: "package",
        relatedType: "batch",
        relatedId: batchId,
        title: t.titleEn,
        titleKu: t.titleKu,
        titleAr: t.titleAr,
        titleZh: t.titleZh,
        message: t.en,
        messageKu: t.ku,
        messageAr: t.ar,
        messageZh: t.zh,
      });
      told += 1;
    } catch (e) {
      appLogger.warn("[Dispatch] portal notice failed", { batchId, customerId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return told;
}
