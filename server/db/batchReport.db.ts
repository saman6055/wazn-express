import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  batches, boxSettlements, customers, deliveryBoxes, fullPackageOrders, fullPackageOrderTrackings, packages, productCategories,
} from "../../drizzle/schema";
import { getBatchFinancialSummary } from "./batches.db";
import { getVolumetricDivisor } from "./settings.db";
import { chargeableWeight } from "@shared/chargeableWeight";

/**
 * The batch report, in detail (owner, 2026-11-09: «دیتێلی قازانج و زیان و
 * کیلۆیی قەبارەیی و زۆرترین کیلۆ بەبەر کێ کەوتووە ... هەروەها زۆر شتی تر»).
 *
 * Read only. Every money figure is the batch report's own: each parcel's
 * revenue is the one the totals add up (getBatchFinancialSummary.parcelRevenue)
 * and the cost is the report's total cost, shared out by each one's part of
 * what the batch sells by - chargeable kilos on air, m³ on sea - the same way
 * a carrier's invoice is split between customers. So a customer's or a kind's
 * profit adds up to the batch's.
 */

type Kind = "self" | "commission" | "full_package" | "purchase_request";
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function getBatchReportDetail(batchId: number) {
  const db = await getDb();
  if (!db) return null;
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch) return null;
  const summary = await getBatchFinancialSummary(batchId);
  if (!summary) return null;
  const sea = batch.shippingType === "sea";
  const divisor = await getVolumetricDivisor();

  const rows = await db.select().from(packages).where(eq(packages.batchId, batchId));
  // The same parcels the report's totals count: every one with an owner.
  const live = rows.filter((p) => Boolean(p.customerId));
  const revenueOf = (id: number) => Number((summary as { parcelRevenue?: Record<number, number> }).parcelRevenue?.[id] ?? 0) || 0;
  const totalCost = Number(summary.totalCost) || 0;
  const waiting = Boolean(summary.waitingFor);

  // The orders behind parcels, by link or by tracking: which kind each parcel is.
  const trackings = Array.from(new Set(live.map((p) => p.trackingNumber).filter((t): t is string => Boolean(t))));
  const linkedIds = Array.from(new Set(live.map((p) => p.fullPackageOrderId).filter((id): id is number => Boolean(id))));
  const byTracking = new Map<string, { orderType: string; platform: string | null }>();
  const byId = new Map<number, { orderType: string; platform: string | null }>();
  if (trackings.length > 0) {
    const viaTable = await db
      .select({ t: fullPackageOrderTrackings.trackingNumber, orderType: fullPackageOrders.orderType, platform: fullPackageOrders.platform })
      .from(fullPackageOrderTrackings)
      .innerJoin(fullPackageOrders, eq(fullPackageOrders.id, fullPackageOrderTrackings.fullPackageOrderId))
      .where(inArray(fullPackageOrderTrackings.trackingNumber, trackings));
    for (const r of viaTable) if (r.t) byTracking.set(r.t, { orderType: r.orderType, platform: r.platform });
    const legacy = await db
      .select({ t: fullPackageOrders.trackingNumber, orderType: fullPackageOrders.orderType, platform: fullPackageOrders.platform })
      .from(fullPackageOrders)
      .where(inArray(fullPackageOrders.trackingNumber, trackings));
    for (const r of legacy) if (r.t && !byTracking.has(r.t)) byTracking.set(r.t, { orderType: r.orderType, platform: r.platform });
  }
  if (linkedIds.length > 0) {
    const linked = await db.select({ id: fullPackageOrders.id, orderType: fullPackageOrders.orderType, platform: fullPackageOrders.platform })
      .from(fullPackageOrders).where(inArray(fullPackageOrders.id, linkedIds));
    for (const r of linked) byId.set(r.id, { orderType: r.orderType, platform: r.platform });
  }
  const orderOf = (p: (typeof live)[number]) => (p.fullPackageOrderId ? byId.get(p.fullPackageOrderId) : undefined) ?? (p.trackingNumber ? byTracking.get(p.trackingNumber) : undefined);

  // What each parcel weighs three ways, and what the batch sells it by.
  type Row = { p: (typeof live)[number]; kind: Kind; actualKg: number; volumetricKg: number; chargeableKg: number; discountKg: number; cbm: number; qty: number; revenue: number };
  const parcels: Row[] = live.map((p) => {
    const w = chargeableWeight(p, divisor);
    const cbm = Number(p.volumeCbm) || 0;
    const order = orderOf(p);
    const kind = (order?.orderType as Kind | undefined) ?? "self";
    return {
      p, kind,
      actualKg: w.actualKg,
      volumetricKg: w.volumetricKg,
      chargeableKg: w.chargeableKg,
      discountKg: w.discountKg ?? 0,
      cbm,
      qty: sea ? cbm : w.chargeableKg,
      revenue: revenueOf(p.id),
    };
  });
  const totalQty = parcels.reduce((t, r) => t + r.qty, 0);
  const costShare = (qty: number) => (totalQty > 0 && !waiting ? (totalCost * qty) / totalQty : 0);

  // Per customer.
  const customerIds = Array.from(new Set(parcels.map((r) => r.p.customerId).filter((id): id is number => Boolean(id))));
  const people = customerIds.length > 0
    ? await db.select({ id: customers.id, code: customers.customerCode, name: customers.fullName }).from(customers).where(inArray(customers.id, customerIds))
    : [];
  const nameOf = new Map(people.map((c) => [c.id, c]));
  // Returning: the customer had a parcel in an earlier batch.
  const returning = new Set<number>();
  if (customerIds.length > 0) {
    const earlier = await db.selectDistinct({ c: packages.customerId }).from(packages)
      .where(and(inArray(packages.customerId, customerIds), lt(packages.batchId, batchId)));
    for (const r of earlier) if (r.c) returning.add(r.c);
  }
  const perCustomer = customerIds.map((id) => {
    const mine = parcels.filter((r) => r.p.customerId === id);
    const qty = mine.reduce((t, r) => t + r.qty, 0);
    const revenue = mine.reduce((t, r) => t + r.revenue, 0);
    const cost = costShare(qty);
    return {
      customerId: id,
      code: nameOf.get(id)?.code ?? null,
      name: nameOf.get(id)?.name ?? null,
      parcels: mine.length,
      actualKg: round2(mine.reduce((t, r) => t + r.actualKg, 0)),
      volumetricKg: round2(mine.reduce((t, r) => t + r.volumetricKg, 0)),
      chargeableKg: round2(mine.reduce((t, r) => t + r.chargeableKg, 0)),
      cbm: round3(mine.reduce((t, r) => t + r.cbm, 0)),
      sharePercent: totalQty > 0 ? Math.round((qty / totalQty) * 1000) / 10 : 0,
      revenue: round2(revenue),
      cost: round2(cost),
      profit: waiting ? null : round2(revenue - cost),
      returning: returning.has(id),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Per kind of goods.
  const kinds: Kind[] = ["self", "commission", "full_package", "purchase_request"];
  const byKind = kinds.map((k) => {
    const mine = parcels.filter((r) => r.kind === k);
    const qty = mine.reduce((t, r) => t + r.qty, 0);
    const revenue = mine.reduce((t, r) => t + r.revenue, 0);
    const cost = costShare(qty);
    return { kind: k, parcels: mine.length, qty: sea ? round3(qty) : round2(qty), revenue: round2(revenue), profit: waiting ? null : round2(revenue - cost) };
  }).filter((k) => k.parcels > 0);

  // What the goods were.
  const catIds = Array.from(new Set(parcels.map((r) => r.p.categoryId).filter((id): id is number => Boolean(id))));
  const cats = catIds.length > 0
    ? await db.select({ id: productCategories.id, ku: productCategories.nameKu, en: productCategories.nameEn, icon: productCategories.icon }).from(productCategories).where(inArray(productCategories.id, catIds))
    : [];
  const catOf = new Map(cats.map((c) => [c.id, c]));
  const catMap = new Map<number | null, { parcels: number; qty: number }>();
  for (const r of parcels) {
    const key = r.p.categoryId ?? null;
    const was = catMap.get(key) ?? { parcels: 0, qty: 0 };
    catMap.set(key, { parcels: was.parcels + 1, qty: was.qty + r.qty });
  }
  const byCategory = Array.from(catMap.entries()).map(([id, v]) => ({
    categoryId: id,
    nameKu: id ? catOf.get(id)?.ku ?? null : null,
    nameEn: id ? catOf.get(id)?.en ?? null : null,
    icon: id ? catOf.get(id)?.icon ?? null : null,
    parcels: v.parcels,
    qty: sea ? round3(v.qty) : round2(v.qty),
    sharePercent: totalQty > 0 ? Math.round((v.qty / totalQty) * 1000) / 10 : 0,
  })).sort((a, b) => b.qty - a.qty);

  // Where it was bought: the shop on the orders behind the parcels.
  const sourceMap = new Map<string, number>();
  for (const r of parcels) {
    const o = orderOf(r.p);
    if (!o) continue;
    const key = (o.platform ?? "").trim().toLowerCase() || "other";
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
  }
  const bySource = Array.from(sourceMap.entries()).map(([platform, count]) => ({ platform, parcels: count })).sort((a, b) => b.parcels - a.parcels);

  // The heaviest parcels.
  const heaviest = [...parcels].sort((a, b) => b.qty - a.qty).slice(0, 5).map((r) => ({
    packageId: r.p.id,
    trackingNumber: r.p.trackingNumber ?? r.p.packageCode,
    customerCode: r.p.customerId ? nameOf.get(r.p.customerId)?.code ?? null : null,
    // The name beside the code (owner, 2026-11-13).
    customerName: r.p.customerId ? nameOf.get(r.p.customerId)?.name ?? null : null,
    qty: sea ? round3(r.qty) : round2(r.qty),
    revenue: round2(r.revenue),
  }));

  // Speed: registration to the batch's arrival.
  const arrival = batch.actualArrival ? new Date(batch.actualArrival).getTime() : null;
  const days = arrival
    ? parcels.map((r) => (r.p.registeredAt ? Math.max(0, Math.round((arrival - new Date(r.p.registeredAt).getTime()) / 86_400_000)) : null)).filter((d): d is number => d !== null)
    : [];

  // Discounts given on this batch's boxes at their receipts.
  const [disc] = await db
    .select({ usd: sql<string>`COALESCE(SUM(${boxSettlements.discountUsd}), 0)` })
    .from(boxSettlements)
    .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, boxSettlements.boxId))
    .where(and(eq(deliveryBoxes.batchId, batchId), eq(boxSettlements.status, "confirmed")));

  // The previous batch of the same kind, for comparison.
  const [prev] = await db.select({ id: batches.id, batchCode: batches.batchCode }).from(batches)
    .where(and(eq(batches.shippingType, batch.shippingType), lt(batches.id, batchId)))
    .orderBy(desc(batches.id)).limit(1);
  let previous: { batchCode: string; qty: number; revenue: number; profit: number | null } | null = null;
  if (prev) {
    const ps = await getBatchFinancialSummary(prev.id);
    if (ps) previous = {
      batchCode: prev.batchCode,
      qty: sea ? Number(ps.chargedCbm) || 0 : Number(ps.chargedWeight) || 0,
      revenue: round2(Number(ps.totalRevenue) || 0),
      profit: ps.waitingFor ? null : round2(Number(ps.profit) || 0),
    };
  }

  const totalRevenue = parcels.reduce((t, r) => t + r.revenue, 0);
  return {
    batchId,
    unit: sea ? ("cbm" as const) : ("kg" as const),
    waiting,
    weights: {
      actualKg: round2(parcels.reduce((t, r) => t + r.actualKg, 0)),
      volumetricKg: round2(parcels.reduce((t, r) => t + r.volumetricKg, 0)),
      chargeableKg: round2(parcels.reduce((t, r) => t + r.chargeableKg, 0)),
      volumetricDiscountKg: round2(parcels.reduce((t, r) => t + r.discountKg, 0)),
      cbm: round3(parcels.reduce((t, r) => t + r.cbm, 0)),
    },
    averages: {
      perParcelQty: parcels.length > 0 ? (sea ? round3(totalQty / parcels.length) : round2(totalQty / parcels.length)) : 0,
      revenuePerCustomer: customerIds.length > 0 ? round2(totalRevenue / customerIds.length) : 0,
      sellPerUnit: totalQty > 0 ? round2(totalRevenue / totalQty) : 0,
      costPerUnit: totalQty > 0 && !waiting ? round2(totalCost / totalQty) : null,
      profitPerUnit: totalQty > 0 && !waiting ? round2((totalRevenue - totalCost) / totalQty) : null,
    },
    customers: { total: customerIds.length, returning: perCustomer.filter((c) => c.returning).length, newcomers: perCustomer.filter((c) => !c.returning).length },
    perCustomer,
    lossCustomers: perCustomer.filter((c) => c.profit !== null && c.profit < -0.005).length,
    byKind,
    byCategory,
    bySource,
    heaviest,
    speed: days.length > 0 ? { avgDays: Math.round(days.reduce((t, d) => t + d, 0) / days.length), maxDays: Math.max(...days) } : null,
    problems: {
      unclaimed: rows.filter((p) => p.isUnclaimed).length,
      returnedOrCancelled: rows.filter((p) => p.status === "returned" || p.status === "cancelled").length,
      noPrice: parcels.filter((r) => r.revenue <= 0.005 && r.p.customerId).length,
      noMeasure: parcels.filter((r) => r.qty <= 0).length,
    },
    receiptDiscountsUsd: round2(Number(disc?.usd ?? 0)),
    previous,
  };
}
