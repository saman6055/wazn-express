import { eq, ne, desc, and, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import { getDb } from "./connection";
import { deliveryBoxes, deliveryBoxItems, packages, fullPackageOrders, fullPackageOrderTrackings, batches, customers } from "../../drizzle/schema";
import type { DeliveryBox, InsertDeliveryBox, DeliveryBoxItem, InsertDeliveryBoxItem } from "../../drizzle/schema/packages.schema";
import { appLogger } from "../utils/logger";

// ============ BOX CODE GENERATION ============

export async function generateBoxCode(): Promise<string> {
  const db = await getDb();
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = `BOX-${dateStr}-`;

  if (db) {
    try {
      const [result] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(deliveryBoxes)
        .where(sql`boxCode LIKE ${prefix + '%'}`);
      const seq = (result?.count || 0) + 1;
      return `${prefix}${String(seq).padStart(3, '0')}`;
    } catch {
      return `${prefix}${Date.now().toString(36).slice(-3).toUpperCase()}`;
    }
  }
  return `${prefix}001`;
}

// ============ DELIVERY BOX CRUD ============

export async function createDeliveryBox(data: Omit<InsertDeliveryBox, 'boxCode'>): Promise<DeliveryBox> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const boxCode = await generateBoxCode();
  const profit = (Number(data.deliveryChargeUsd || 0) - Number(data.deliveryCostUsd || 0)).toFixed(2);

  const result = await db.insert(deliveryBoxes).values({
    ...data,
    boxCode,
    deliveryProfitUsd: profit,
  });

  const insertId = Number(result[0].insertId);
  const [box] = await db.select().from(deliveryBoxes).where(eq(deliveryBoxes.id, insertId));
  return box;
}

export async function getDeliveryBoxById(id: number): Promise<DeliveryBox | null> {
  const db = await getDb();
  if (!db) return null;
  const [box] = await db.select().from(deliveryBoxes).where(eq(deliveryBoxes.id, id));
  return box || null;
}

export async function getDeliveryBoxByCode(code: string): Promise<DeliveryBox | null> {
  const db = await getDb();
  if (!db) return null;
  const [box] = await db.select().from(deliveryBoxes).where(eq(deliveryBoxes.boxCode, code));
  return box || null;
}

export async function getOpenBoxes(userId?: number): Promise<DeliveryBox[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    inArray(deliveryBoxes.status, ['open', 'ready']),
  ];
  if (userId) conditions.push(eq(deliveryBoxes.createdById, userId));
  return db.select().from(deliveryBoxes).where(and(...conditions)).orderBy(desc(deliveryBoxes.createdAt));
}

export async function getAllDeliveryBoxes(filters?: {
  status?: string;
  customerId?: number;
  deliveryMethod?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  batchId?: number | null;
}): Promise<{ boxes: (DeliveryBox & { shippingType: string | null })[]; total: number }> {
  const db = await getDb();
  if (!db) return { boxes: [], total: 0 };

  const conditions = [];
  if (filters?.status) conditions.push(eq(deliveryBoxes.status, filters.status as any));
  if (filters?.customerId) conditions.push(eq(deliveryBoxes.customerId, filters.customerId));
  if (filters?.deliveryMethod) conditions.push(eq(deliveryBoxes.deliveryMethod, filters.deliveryMethod as any));
  if (filters?.search) {
    // Match the box itself (code, destination, recipient) OR any package it
    // contains (tracking / package code). The item match is a correlated
    // EXISTS subquery so a customer's "I never got this tracking" complaint
    // resolves straight to the box + its date, in ANY status (incl. delivered).
    const like = `%${filters.search}%`;
    conditions.push(sql`(
      ${deliveryBoxes.boxCode} LIKE ${like}
      OR ${deliveryBoxes.destinationCity} LIKE ${like}
      OR ${deliveryBoxes.recipientName} LIKE ${like}
      OR EXISTS (
        SELECT 1 FROM ${deliveryBoxItems}
        WHERE ${deliveryBoxItems.boxId} = ${deliveryBoxes.id}
          AND (${deliveryBoxItems.trackingNumber} LIKE ${like} OR ${deliveryBoxItems.packageCode} LIKE ${like})
      )
    )`);
  }
  if (filters?.startDate) conditions.push(gte(deliveryBoxes.createdAt, filters.startDate));
  if (filters?.endDate) conditions.push(lte(deliveryBoxes.createdAt, filters.endDate));
  // batchId: explicit null means "manual boxes only"; a number means specific batch; undefined means don't filter
  if (filters?.batchId === null) conditions.push(sql`${deliveryBoxes.batchId} IS NULL`);
  else if (typeof filters?.batchId === 'number') conditions.push(eq(deliveryBoxes.batchId, filters.batchId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(deliveryBoxes).where(where);
  const total = Number(countResult?.count || 0);

  const boxes = await db.select().from(deliveryBoxes)
    .where(where)
    .orderBy(desc(deliveryBoxes.createdAt))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);

  // Attach the batch shipping type so the list/table can show CBM vs kg
  // without a per-row query. Manual boxes (no batch) get null → kg.
  const batchIds = Array.from(new Set(boxes.map(b => b.batchId).filter((id): id is number => !!id)));
  const shippingTypeByBatch = new Map<number, string | null>();
  if (batchIds.length > 0) {
    const batchRows = await db.select({ id: batches.id, shippingType: batches.shippingType })
      .from(batches).where(inArray(batches.id, batchIds));
    for (const b of batchRows) shippingTypeByBatch.set(b.id, b.shippingType ?? null);
  }
  const boxesWithType = boxes.map(b => ({
    ...b,
    shippingType: b.batchId ? (shippingTypeByBatch.get(b.batchId) ?? null) : null,
  }));

  return { boxes: boxesWithType, total };
}

export async function updateDeliveryBox(id: number, data: Partial<InsertDeliveryBox>): Promise<DeliveryBox | null> {
  const db = await getDb();
  if (!db) return null;

  // Recalculate profit if cost or charge changed
  if (data.deliveryChargeUsd !== undefined || data.deliveryCostUsd !== undefined) {
    const existing = await getDeliveryBoxById(id);
    if (existing) {
      const charge = Number(data.deliveryChargeUsd ?? existing.deliveryChargeUsd ?? 0);
      const cost = Number(data.deliveryCostUsd ?? existing.deliveryCostUsd ?? 0);
      data.deliveryProfitUsd = (charge - cost).toFixed(2);
    }
  }

  await db.update(deliveryBoxes).set(data).where(eq(deliveryBoxes.id, id));
  return getDeliveryBoxById(id);
}

// ============ BOX STATUS TRANSITIONS ============

export async function sealBox(id: number, userId: number): Promise<DeliveryBox | null> {
  return updateDeliveryBox(id, {
    status: 'ready',
    sealedById: userId,
    sealedAt: new Date(),
  });
}

export async function markBoxInTransit(id: number, userId: number): Promise<DeliveryBox | null> {
  return updateDeliveryBox(id, {
    status: 'in_transit',
    inTransitAt: new Date(),
  });
}

export async function markBoxDelivered(id: number, userId: number, signature?: string, photo?: string): Promise<DeliveryBox | null> {
  return updateDeliveryBox(id, {
    status: 'delivered',
    deliveredById: userId,
    deliveredAt: new Date(),
    signature: signature || undefined,
    deliveryPhoto: photo || undefined,
  });
}

// ============ BOX ITEMS ============

export async function addItemToBox(data: InsertDeliveryBoxItem): Promise<DeliveryBoxItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(deliveryBoxItems).values(data);
  const insertId = Number(result[0].insertId);
  const [item] = await db.select().from(deliveryBoxItems).where(eq(deliveryBoxItems.id, insertId));

  // Update box totals
  await recalculateBoxTotals(data.boxId);

  return item;
}

export async function removeItemFromBox(itemId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [item] = await db.select().from(deliveryBoxItems).where(eq(deliveryBoxItems.id, itemId));
  if (!item) return;

  await db.delete(deliveryBoxItems).where(eq(deliveryBoxItems.id, itemId));
  await recalculateBoxTotals(item.boxId);
}

/**
 * Box items enriched with the prepayment that should be credited on the
 * receipt. Pulls from EVERY Full-Package order linked to the item — a
 * single physical package (one tracking number) can fulfil multiple
 * commission orders that share the carton, and the receipt's
 * `calculatedCostUsd` already sums all of them, so the advance must too.
 *
 * Per order type, "what has the customer already paid for this order's
 * goods?":
 *  - commission       → `advancePaidUsd` only (the advance actually paid
 *                        at order creation, recorded as a CREDIT_PAYMENT).
 *                        NOT `totalPrepaidUsd` — that is the goods value
 *                        (item × qty + commission) stored on every
 *                        commission order whether or not money was paid,
 *                        so using it credited the full order value and
 *                        under-billed at delivery. Legacy prepaid-at-
 *                        creation orders (`isPrepaid`) fall back to
 *                        `paidFromBalanceUsd`. See `fpAdvance` for detail.
 *  - full_package /
 *    purchase_request → MAX(`paidFromBalanceUsd`, `advancePaidUsd`).
 *                        - `advancePaidUsd` is set when a CASH advance
 *                          is recorded at order creation (line 285 in
 *                          fullPackage.router.ts).
 *                        - `paidFromBalanceUsd` is set when the order is
 *                          approved and the wallet is debited for the
 *                          full selling price (line 1340). The approve
 *                          flow does NOT mirror into advancePaidUsd, so
 *                          using only advancePaidUsd misses every
 *                          approved-from-wallet order — receipt then
 *                          shows $0 paid and bills the customer twice.
 *                        Taking MAX captures both pathways without
 *                        double-counting on commission-quickcreate
 *                        orders that mirror the same value into both
 *                        fields.
 *  - regular packages → 0 (no upstream FP order).
 *
 * Lookup priority per item:
 *  1. `item.fullPackageOrderId` — explicit single-order link (set when
 *     the item was scanned to a specific FP order, not a package). Use
 *     ONLY that order's advance because the item represents that order
 *     in isolation; sibling orders sharing the tracking are NOT in this
 *     box item.
 *  2. `item.trackingNumber` — sum advances of every order that owns this
 *     tracking via `fullPackageOrders.trackingNumber` OR the multi-
 *     tracking table. This is the path auto-create-from-batch and
 *     package-scanned flows take, and is where shared-tracking siblings
 *     used to silently drop out (single-result Map collision).
 *
 * The receipt subtracts the SUM of these from the grand total so the
 * customer sees only the balance still owed at delivery.
 */
export type BoxItemWithAdvance = DeliveryBoxItem & {
  advanceAppliedUsd: string;
  // Product photo resolved from the linked commission/full-package order
  // (productImage / first of productImages) or, for regular packages, the
  // first package photo. null when the source order/package has no image.
  productImage: string | null;
  // Sea (دەریایی) shipments are billed by volume (CBM), not weight — the
  // `weightKg` snapshot on the box item is 0/null for them. These two are
  // resolved live from the linked package / full-package order so the
  // receipt, label, and box panel can show CBM instead of kg. null when the
  // source has no measurement.
  volumeCbm: string | null;
  shippingType: string | null;
};

function fpAdvance(fp: typeof fullPackageOrders.$inferSelect): number {
  if (fp.orderType === 'commission') {
    // The ONLY money a customer pays toward a modern commission order
    // before delivery is the advance recorded at order creation
    // (`advancePaidUsd` — a real CREDIT_PAYMENT on the ledger, set by the
    // create/bulkCreate/edit flows). This is exactly what the authoritative
    // batch-delivery invoice credits (batches.router.ts: it sums
    // advancePaidUsd and nothing else), so the box must match it.
    //
    // Deliberately NOT `totalPrepaidUsd`: that is the GOODS VALUE
    // (item × qty + commission), stored on every commission order whether
    // or not any money changed hands. Crediting it treated the full order
    // value as "already paid" and under-billed the customer at delivery —
    // the production bug report this fixes.
    //
    // Deliberately NOT `paidFromBalanceUsd` for the modern path: for
    // commission, that field is the goods DEBIT applied AT batch delivery
    // (batches.router.ts:469 — what the customer now OWES), not a
    // prepayment.
    const adv = Number((fp as any).advancePaidUsd || 0) || 0;
    // Legacy `createCommissionOrder` charged item+commission from the wallet
    // at creation and flagged the order `isPrepaid: true` (the only writer of
    // that flag). For those historical orders the goods ARE genuinely
    // prepaid, so honor `paidFromBalanceUsd`. Modern orders never set
    // isPrepaid, so this branch can't reintroduce the over-credit.
    const legacyPrepaid = fp.isPrepaid ? (Number((fp as any).paidFromBalanceUsd || 0) || 0) : 0;
    return Math.max(adv, legacyPrepaid);
  }
  if (fp.orderType === 'full_package' || fp.orderType === 'purchase_request') {
    const a = Number((fp as any).advancePaidUsd || 0) || 0;
    const p = Number((fp as any).paidFromBalanceUsd || 0) || 0;
    return Math.max(a, p);
  }
  return 0;
}

export async function getBoxItems(boxId: number): Promise<BoxItemWithAdvance[]> {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(deliveryBoxItems)
    .where(eq(deliveryBoxItems.boxId, boxId))
    .orderBy(deliveryBoxItems.scannedAt);
  if (items.length === 0) return [];

  const trackingNumbers = Array.from(new Set(
    items.map(i => i.trackingNumber).filter((t): t is string => !!t)
  ));
  const fpOrderIds = Array.from(new Set(
    items.map(i => i.fullPackageOrderId).filter((id): id is number => !!id)
  ));

  // tracking → list of FP orders (multi-tracking + legacy single field).
  // List, not scalar — shared trackings produce >1 row.
  const fpsByTracking = new Map<string, typeof fullPackageOrders.$inferSelect[]>();
  const fpById = new Map<number, typeof fullPackageOrders.$inferSelect>();

  if (trackingNumbers.length > 0) {
    // 1. Legacy single-tracking field on the order itself.
    const legacy = await db.select().from(fullPackageOrders)
      .where(inArray(fullPackageOrders.trackingNumber, trackingNumbers));
    for (const fp of legacy) {
      fpById.set(fp.id, fp);
      if (fp.trackingNumber) {
        const list = fpsByTracking.get(fp.trackingNumber) || [];
        list.push(fp);
        fpsByTracking.set(fp.trackingNumber, list);
      }
    }

    // 2. Multi-tracking table — picks up shared trackings + multi-carton
    //    orders whose primary tracking is different from the carton tracking.
    const trackRows = await db.select({
      trackingNumber: fullPackageOrderTrackings.trackingNumber,
      orderId: fullPackageOrderTrackings.fullPackageOrderId,
    }).from(fullPackageOrderTrackings)
      .where(inArray(fullPackageOrderTrackings.trackingNumber, trackingNumbers));
    const extraOrderIds = Array.from(new Set(trackRows.map(r => r.orderId).filter(id => !fpById.has(id))));
    if (extraOrderIds.length > 0) {
      const extras = await db.select().from(fullPackageOrders)
        .where(inArray(fullPackageOrders.id, extraOrderIds));
      for (const fp of extras) fpById.set(fp.id, fp);
    }
    for (const r of trackRows) {
      const fp = fpById.get(r.orderId);
      if (!fp) continue;
      const list = fpsByTracking.get(r.trackingNumber) || [];
      // Dedup by id — an order can sit in both legacy and multi-tracking.
      if (!list.some(o => o.id === fp.id)) list.push(fp);
      fpsByTracking.set(r.trackingNumber, list);
    }
  }

  if (fpOrderIds.length > 0) {
    const missing = fpOrderIds.filter(id => !fpById.has(id));
    if (missing.length > 0) {
      const fps = await db.select().from(fullPackageOrders)
        .where(inArray(fullPackageOrders.id, missing));
      for (const fp of fps) fpById.set(fp.id, fp);
    }
  }

  // Regular-package photos, for items scanned as plain packages (no FP order).
  const packageIds = Array.from(new Set(
    items.map(i => i.packageId).filter((id): id is number => !!id)
  ));
  const pkgById = new Map<number, typeof packages.$inferSelect>();
  if (packageIds.length > 0) {
    const pkgs = await db.select().from(packages).where(inArray(packages.id, packageIds));
    for (const p of pkgs) pkgById.set(p.id, p);
  }

  // Resolve one product photo per item: FP-order image (commission /
  // full_package) wins, else the first regular-package photo, else null.
  const imageFor = (item: typeof items[number]): string | null => {
    let fp = item.fullPackageOrderId ? fpById.get(item.fullPackageOrderId) : undefined;
    if (!fp && item.trackingNumber) fp = (fpsByTracking.get(item.trackingNumber) || [])[0];
    if (fp) {
      const imgs = (fp as any).productImages;
      const img = (fp as any).productImage || (Array.isArray(imgs) ? imgs[0] : null);
      if (img) return img;
    }
    if (item.packageId) {
      const photos = (pkgById.get(item.packageId) as any)?.photos;
      if (Array.isArray(photos) && photos[0]) return photos[0];
    }
    return null;
  };

  // ── Dedup-once-per-box guard ──
  //
  // One full-package or commission order's advance is a SINGLE credit on
  // the customer's wallet, regardless of how many physical cartons that
  // order spans. Previously, the per-item map summed advance N times
  // when an order had N cartons in the same box (very common for
  // multi-tracking commission orders), so receipts showed an inflated
  // credit and customers were under-billed at the delivery step.
  //
  // Production bug report: "زۆربەی کات کە پارەی پێشەکی دراو دەنوسیت
  // بەهەڵە دەینوسیت". Reproduction: commission CM-X with totalPrepaidUsd
  // = $50, two cartons sharing the order, both in one box → receipt
  // showed `-$100 پارەی پێشەکی دراو` but the customer only ever paid $50.
  //
  // Fix: track which FP order ids we've already credited within this box
  // and attribute the advance to the FIRST item that resolves to that
  // order (in scan order). Subsequent items linked to the same order get
  // `advanceAppliedUsd: '0'` so the client-side SUM lands at the correct
  // single-credit total. The math is the same; the attribution is what
  // changes.
  const creditedOrderIds = new Set<number>();
  const advanceOnce = (fp: typeof fullPackageOrders.$inferSelect): number => {
    if (creditedOrderIds.has(fp.id)) return 0;
    creditedOrderIds.add(fp.id);
    return fpAdvance(fp);
  };

  // Resolve the sea/CBM measurement for an item from its linked source.
  // Priority mirrors the advance/photo lookups: explicit package → explicit
  // FP order → first FP order sharing the tracking. Sea packages carry the
  // meaningful number in `volumeCbm`; air packages leave it null and fall
  // back to `weightKg` on the receipt.
  const measureFor = (item: typeof items[number]): { volumeCbm: string | null; shippingType: string | null } => {
    if (item.packageId) {
      const p = pkgById.get(item.packageId);
      if (p) return { volumeCbm: (p as any).volumeCbm ?? null, shippingType: (p as any).shippingType ?? null };
    }
    let fp = item.fullPackageOrderId ? fpById.get(item.fullPackageOrderId) : undefined;
    if (!fp && item.trackingNumber) fp = (fpsByTracking.get(item.trackingNumber) || [])[0];
    if (fp) return { volumeCbm: (fp as any).volumeCbm ?? null, shippingType: (fp as any).shippingType ?? null };
    return { volumeCbm: null, shippingType: null };
  };

  return items.map((item): BoxItemWithAdvance => {
    const productImage = imageFor(item);
    const { volumeCbm, shippingType } = measureFor(item);

    // Direct FP-order scan path — single order owns the item, no sibling sum.
    if (item.fullPackageOrderId) {
      const fp = fpById.get(item.fullPackageOrderId);
      return { ...item, advanceAppliedUsd: fp ? advanceOnce(fp).toFixed(2) : '0', productImage, volumeCbm, shippingType };
    }

    // Tracking-based path — sum every linked order's advance, but skip
    // orders already credited on an earlier item in this same box.
    if (item.trackingNumber) {
      const linked = fpsByTracking.get(item.trackingNumber) || [];
      const total = linked.reduce((s, fp) => s + advanceOnce(fp), 0);
      return { ...item, advanceAppliedUsd: total.toFixed(2), productImage, volumeCbm, shippingType };
    }

    return { ...item, advanceAppliedUsd: '0', productImage, volumeCbm, shippingType };
  });
}

export async function isPackageInAnyBox(packageId: number): Promise<{ inBox: boolean; boxCode?: string; boxId?: number }> {
  const db = await getDb();
  if (!db) return { inBox: false };

  const items = await db.select({
    boxId: deliveryBoxItems.boxId,
    boxCode: deliveryBoxes.boxCode,
    boxStatus: deliveryBoxes.status,
  })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(
      eq(deliveryBoxItems.packageId, packageId),
      inArray(deliveryBoxes.status, ['open', 'ready', 'in_transit']),
    ))
    .limit(1);

  if (items.length > 0) {
    return { inBox: true, boxCode: items[0].boxCode, boxId: items[0].boxId };
  }
  return { inBox: false };
}

export async function isFPOrderInAnyBox(fpOrderId: number): Promise<{ inBox: boolean; boxCode?: string; boxId?: number }> {
  const db = await getDb();
  if (!db) return { inBox: false };

  const items = await db.select({
    boxId: deliveryBoxItems.boxId,
    boxCode: deliveryBoxes.boxCode,
  })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(
      eq(deliveryBoxItems.fullPackageOrderId, fpOrderId),
      inArray(deliveryBoxes.status, ['open', 'ready', 'in_transit']),
    ))
    .limit(1);

  if (items.length > 0) {
    return { inBox: true, boxCode: items[0].boxCode, boxId: items[0].boxId };
  }
  return { inBox: false };
}

// Stricter variant for the customer-reassignment guard: true if the order sits
// in ANY box that isn't cancelled — including a DELIVERED box (whose delivery
// charge was already billed to that box's customer). isFPOrderInAnyBox above
// only flags active boxes, which is right for "can I still add this to a box"
// but NOT for "is this order financially/physically committed to a customer".
export async function isFPOrderBoxedNonCancelled(fpOrderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const items = await db.select({ boxId: deliveryBoxItems.boxId })
    .from(deliveryBoxItems)
    .innerJoin(deliveryBoxes, eq(deliveryBoxItems.boxId, deliveryBoxes.id))
    .where(and(
      eq(deliveryBoxItems.fullPackageOrderId, fpOrderId),
      ne(deliveryBoxes.status, 'cancelled'),
    ))
    .limit(1);
  return items.length > 0;
}

// ============ RECALCULATE BOX TOTALS ============

async function recalculateBoxTotals(boxId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const items = await getBoxItems(boxId);
  const totalPackages = items.length;
  const totalWeightKg = items.reduce((sum, i) => sum + Number(i.weightKg || 0), 0);
  const totalValueUsd = items.reduce((sum, i) => sum + Number(i.calculatedCostUsd || 0), 0);

  await db.update(deliveryBoxes).set({
    totalPackages,
    totalWeightKg: totalWeightKg.toFixed(3),
    totalValueUsd: totalValueUsd.toFixed(2),
  }).where(eq(deliveryBoxes.id, boxId));
}

// ============ DELIVERY BOX PROFIT REPORTS ============

export async function getDeliveryBoxProfitBreakdown(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { totalCharge: 0, totalCost: 0, totalProfit: 0, boxCount: 0, packageCount: 0 };

  try {
    const result = await db.select({
      totalCharge: sql<number>`COALESCE(SUM(deliveryChargeUsd), 0)`,
      totalCost: sql<number>`COALESCE(SUM(deliveryCostUsd), 0)`,
      totalProfit: sql<number>`COALESCE(SUM(deliveryProfitUsd), 0)`,
      boxCount: sql<number>`COUNT(*)`,
      packageCount: sql<number>`COALESCE(SUM(totalPackages), 0)`,
    }).from(deliveryBoxes).where(and(
      inArray(deliveryBoxes.status, ['in_transit', 'delivered']),
      gte(deliveryBoxes.createdAt, startDate),
      lte(deliveryBoxes.createdAt, endDate),
    ));

    const r = result[0];
    return {
      totalCharge: Number(r?.totalCharge || 0),
      totalCost: Number(r?.totalCost || 0),
      totalProfit: Number(r?.totalProfit || 0),
      boxCount: Number(r?.boxCount || 0),
      packageCount: Number(r?.packageCount || 0),
    };
  } catch (err) {
    appLogger.error("getDeliveryBoxProfitBreakdown failed", { error: err instanceof Error ? err.message : String(err) });
    return { totalCharge: 0, totalCost: 0, totalProfit: 0, boxCount: 0, packageCount: 0 };
  }
}

// ============ BATCH AUTO-BOX CREATION ============

/**
 * Auto-create per-customer delivery boxes for all packages in a batch.
 * Skips customers who already have a box for this batch.
 * Returns summary + list of created boxes.
 */
export async function createDeliveryBoxesForBatch(
  batchId: number,
  deliveryMethod: "warehouse_pickup" | "home_delivery" | "city_transfer",
  userId: number,
): Promise<{ created: number; skipped: number; totalPackages: number; boxes: DeliveryBox[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const batch = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (batch.length === 0) throw new Error("Batch not found");
  const batchRow = batch[0];

  // Get all packages in the batch
  const batchPackages = await db.select().from(packages).where(eq(packages.batchId, batchId));
  if (batchPackages.length === 0) {
    return { created: 0, skipped: 0, totalPackages: 0, boxes: [] };
  }

  // Group packages by customerId
  const packagesByCustomer = new Map<number, typeof batchPackages>();
  for (const pkg of batchPackages) {
    if (!pkg.customerId) continue;
    const arr = packagesByCustomer.get(pkg.customerId) || [];
    arr.push(pkg);
    packagesByCustomer.set(pkg.customerId, arr);
  }

  // Existing boxes for this batch (skip duplicates)
  const existingBoxes = await db.select()
    .from(deliveryBoxes)
    .where(eq(deliveryBoxes.batchId, batchId));
  const existingCustomerIds = new Set(existingBoxes.map(b => b.customerId));

  const createdBoxes: DeliveryBox[] = [];
  let created = 0;
  let skipped = 0;

  for (const [customerId, pkgs] of Array.from(packagesByCustomer.entries())) {
    if (existingCustomerIds.has(customerId)) {
      skipped++;
      continue;
    }

    // Load customer for recipient info auto-fill
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);

    // Create the box
    const boxCode = await generateBoxCode();
    const insertResult = await db.insert(deliveryBoxes).values({
      boxCode,
      customerId,
      batchId,
      deliveryMethod,
      destinationCity: customer?.city || undefined,
      recipientName: customer?.fullName || undefined,
      recipientPhone: customer?.mobileNumber || undefined,
      deliveryCostUsd: "0",
      deliveryChargeUsd: "0",
      deliveryProfitUsd: "0",
      createdById: userId,
      notes: `Auto-created from batch ${batchRow.batchCode}`,
    });
    const boxId = Number(insertResult[0].insertId);

    // Build one item per package via the shared helper — keeps shared-tracking
    // sum, fresh shipping recompute, and chargeable-weight logic in a single
    // place that recompute also calls.
    for (const pkg of pkgs) {
      const values = await buildBoxItemValuesFromPackage(pkg, batchRow, userId);
      await db.insert(deliveryBoxItems).values({ boxId, ...values });
    }

    // Recalculate totals (use inline calc since we're inside this function)
    const items = await db.select().from(deliveryBoxItems).where(eq(deliveryBoxItems.boxId, boxId));
    const totalPackages = items.length;
    const totalWeightKg = items.reduce((s, i) => s + Number(i.weightKg || 0), 0);
    const totalValueUsd = items.reduce((s, i) => s + Number(i.calculatedCostUsd || 0), 0);
    await db.update(deliveryBoxes).set({
      totalPackages,
      totalWeightKg: totalWeightKg.toFixed(3),
      totalValueUsd: totalValueUsd.toFixed(2),
    }).where(eq(deliveryBoxes.id, boxId));

    const [finalBox] = await db.select().from(deliveryBoxes).where(eq(deliveryBoxes.id, boxId));
    createdBoxes.push(finalBox);
    created++;
  }

  return { created, skipped, totalPackages: batchPackages.length, boxes: createdBoxes };
}

// ============ ITEM BUILDER (shared by create + recompute) ============

/**
 * Resolve the values for a delivery-box item built from a single package.
 *
 * Centralises the pricing logic that was previously inlined in both
 * `createDeliveryBoxesForBatch` and `scanning.addItem`. Two callers means
 * two places where shared-tracking sibling orders could be silently
 * dropped — the historical bug fixed by 1d11fa1. Keeping a single source
 * of truth here means future fixes apply uniformly to fresh boxes,
 * recomputed boxes, and manually scanned items.
 *
 * Behaviour:
 *  - Chargeable weight = max(actual, volumetric).
 *  - Shipping recomputed FRESH from the batch's current per-kg/per-cbm rate
 *    (falling back to the package's persisted `calculatedCostUsd` only when
 *    the rate is missing — see the `freshShippingCost` comment block in
 *    `createDeliveryBoxesForBatch` for why).
 *  - Resolves EVERY FP order linked to `pkg.trackingNumber` via both the
 *    multi-tracking table and the legacy single field, then sums their
 *    goods/commission so shared-tracking cartons charge for all siblings.
 *  - Commission cartons: `calculatedCostUsd = goods + shippingCost`.
 *    Full-package cartons: selling price already covers shipping → just goods.
 */
async function buildBoxItemValuesFromPackage(
  pkg: typeof packages.$inferSelect,
  batchRow: typeof batches.$inferSelect,
  userId: number,
): Promise<Omit<InsertDeliveryBoxItem, 'boxId'>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const batchPricePerKg = parseFloat(batchRow.pricePerKg?.toString() || "0") || 0;
  const batchPricePerCbm = parseFloat(batchRow.pricePerCbm?.toString() || "0") || 0;
  const batchIsSea = batchRow.shippingType === 'sea';

  let itemType: 'regular' | 'full_package' | 'commission' = 'regular';
  let sourceInfo = `باچ ${batchRow.batchCode}`;
  let description = pkg.description || pkg.trackingNumber || '';

  // Chargeable weight = max(actual, volumetric).
  const actualKg = parseFloat(pkg.weightKg?.toString() || '0') || 0;
  const lN = parseFloat((pkg as any).lengthCm?.toString() || '0') || 0;
  const wN = parseFloat((pkg as any).widthCm?.toString() || '0') || 0;
  const hN = parseFloat((pkg as any).heightCm?.toString() || '0') || 0;
  const volumetricKg = (lN * wN * hN) / 6000;
  const chargeableKgNum = Math.max(actualKg, volumetricKg);
  const chargeableKg = chargeableKgNum.toFixed(2);

  // Recompute shipping cost FRESH from current pkg measurements × batch rate.
  let freshShippingCost = 0;
  if (batchIsSea && batchPricePerCbm > 0) {
    const pkgCbm = parseFloat((pkg as any).volumeCbm?.toString() || '0') || 0;
    freshShippingCost = pkgCbm * batchPricePerCbm;
  } else if (batchPricePerKg > 0) {
    freshShippingCost = chargeableKgNum * batchPricePerKg;
  }
  const persistedCost = parseFloat(pkg.calculatedCostUsd?.toString() || '0') || 0;
  const shippingCost = freshShippingCost > 0 ? freshShippingCost : persistedCost;

  let calculatedCostUsd = shippingCost.toFixed(2);

  if (pkg.trackingNumber) {
    // Resolve EVERY FP order linked to this tracking number — a single
    // physical package can fulfil multiple commission/full-package orders
    // that share the carton (shared trackings).
    const orderIdSet: Record<number, true> = {};
    const fromMulti = await db.select({ id: fullPackageOrderTrackings.fullPackageOrderId })
      .from(fullPackageOrderTrackings)
      .where(eq(fullPackageOrderTrackings.trackingNumber, pkg.trackingNumber));
    for (const r of fromMulti) orderIdSet[r.id] = true;
    const fromLegacy = await db.select({ id: fullPackageOrders.id })
      .from(fullPackageOrders)
      .where(eq(fullPackageOrders.trackingNumber, pkg.trackingNumber));
    for (const r of fromLegacy) orderIdSet[r.id] = true;

    const orderIds = Object.keys(orderIdSet).map(Number);
    const linkedOrders: typeof fullPackageOrders.$inferSelect[] = [];
    if (orderIds.length > 0) {
      const rows = await db.select().from(fullPackageOrders)
        .where(inArray(fullPackageOrders.id, orderIds));
      linkedOrders.push(...rows);
    }

    if (linkedOrders.length > 0) {
      const isAnyCommission = linkedOrders.some(o => o.orderType === 'commission');
      itemType = isAnyCommission ? 'commission'
        : (linkedOrders[0].orderType === 'commission' ? 'commission' : 'full_package');

      const orderCodes = linkedOrders.map(o => o.orderCode).join(' + ');
      const productNames = Array.from(new Set(linkedOrders.map(o => o.productName).filter(Boolean))).join(' + ');
      sourceInfo = `${orderCodes} - ${sourceInfo}`;
      description = productNames || description;

      let goodsTotal = 0;
      for (const o of linkedOrders) {
        const qty = o.quantity || 1;
        if (o.orderType === 'commission') {
          const itemPrice = Number(o.itemPriceUsd || 0);
          const commFee = Number(o.commissionFeeUsd || o.commissionAmount || 0);
          goodsTotal += (itemPrice * qty) + commFee;
        } else {
          const sellingPrice = Number(o.sellingPriceUsd || 0);
          goodsTotal += sellingPrice * qty;
        }
      }

      if (isAnyCommission) {
        calculatedCostUsd = (goodsTotal + shippingCost).toFixed(2);
        const head = productNames || linkedOrders[0].productName || '';
        description = linkedOrders.length > 1
          ? `${head} (${linkedOrders.length} ئۆردەری هاوبەش) | نرخی بەرهەم: $${goodsTotal.toFixed(2)} + نرخی گواستنەوە: $${shippingCost.toFixed(2)}`
          : `${head} | نرخی بەرهەم: $${goodsTotal.toFixed(2)} + نرخی گواستنەوە: $${shippingCost.toFixed(2)}`;
      } else {
        calculatedCostUsd = goodsTotal.toFixed(2);
      }
    }
  }

  return {
    packageId: pkg.id,
    trackingNumber: pkg.trackingNumber || undefined,
    packageCode: pkg.packageCode || undefined,
    description,
    weightKg: chargeableKg,
    calculatedCostUsd,
    itemType,
    sourceInfo,
    scannedById: userId,
  };
}

// ============ RECOMPUTE EXISTING BOX ============

/**
 * Recompute every package-linked item in an existing box.
 *
 * Why this exists: `createDeliveryBoxesForBatch` is "create once" — it
 * skips customers who already have a box (deliveryBoxes.db.ts:484-488).
 * That meant any pricing/tracking fix that landed AFTER a box was
 * created (e.g. the shared-tracking sum from 1d11fa1, or an updated
 * batch rate) never reached the existing box. Boxes silently undercharged.
 *
 * What this does:
 *  - Validates the box is in a mutable state (open/sealed only — never
 *    delivered/cancelled).
 *  - Re-fetches the batch's packages for the box's customer.
 *  - For each package: rebuilds the item values via the shared helper.
 *    - If an item already exists for that package: UPDATE in place.
 *    - Otherwise: INSERT new.
 *  - Removes package-linked items whose package is no longer in the batch
 *    or no longer assigned to this customer.
 *  - Preserves items that have NO `packageId` (manual scans entered by
 *    `scanning.addItem` without a batch package — those are out of scope).
 *  - Recomputes box-level totals.
 *
 * Returns counts so the UI can show "X added, Y updated, Z removed".
 */
export async function recomputeBoxItems(
  boxId: number,
  userId: number,
): Promise<{
  added: number;
  updated: number;
  removed: number;
  totalPackages: number;
  totalWeightKg: number;
  totalValueUsd: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [box] = await db.select().from(deliveryBoxes).where(eq(deliveryBoxes.id, boxId)).limit(1);
  if (!box) throw new Error("Box not found");
  if (box.status === 'delivered' || box.status === 'cancelled') {
    throw new Error("بۆکسی گەیاندراو/هەڵوەشاوە نوێ ناکرێتەوە");
  }
  if (!box.batchId || !box.customerId) {
    throw new Error("بۆکس بەستراو نییە بە باچ یاخود کریار");
  }

  const [batchRow] = await db.select().from(batches).where(eq(batches.id, box.batchId)).limit(1);
  if (!batchRow) throw new Error("Batch not found");

  // All packages in the batch belonging to this customer.
  const customerPkgs = await db.select().from(packages)
    .where(and(eq(packages.batchId, box.batchId), eq(packages.customerId, box.customerId)));
  const pkgIds = new Set(customerPkgs.map(p => p.id));

  // Existing items in the box, split into package-linked vs manual.
  const existingItems = await db.select().from(deliveryBoxItems)
    .where(eq(deliveryBoxItems.boxId, boxId));
  const existingByPkgId = new Map<number, typeof existingItems[number]>();
  for (const it of existingItems) {
    if (it.packageId) existingByPkgId.set(it.packageId, it);
  }

  let added = 0;
  let updated = 0;
  let removed = 0;

  // Remove package-linked items whose package is no longer in scope.
  for (const it of existingItems) {
    if (it.packageId && !pkgIds.has(it.packageId)) {
      await db.delete(deliveryBoxItems).where(eq(deliveryBoxItems.id, it.id));
      removed++;
    }
  }

  // Insert/update one item per package using the shared builder.
  for (const pkg of customerPkgs) {
    const values = await buildBoxItemValuesFromPackage(pkg, batchRow, userId);
    const existing = existingByPkgId.get(pkg.id);
    if (existing) {
      await db.update(deliveryBoxItems).set({
        trackingNumber: values.trackingNumber,
        packageCode: values.packageCode,
        description: values.description,
        weightKg: values.weightKg,
        calculatedCostUsd: values.calculatedCostUsd,
        itemType: values.itemType,
        sourceInfo: values.sourceInfo,
      }).where(eq(deliveryBoxItems.id, existing.id));
      updated++;
    } else {
      await db.insert(deliveryBoxItems).values({ boxId, ...values });
      added++;
    }
  }

  // Recompute box totals from the (now refreshed) items.
  const items = await db.select().from(deliveryBoxItems).where(eq(deliveryBoxItems.boxId, boxId));
  const totalPackages = items.length;
  const totalWeightKg = items.reduce((s, i) => s + Number(i.weightKg || 0), 0);
  const totalValueUsd = items.reduce((s, i) => s + Number(i.calculatedCostUsd || 0), 0);
  await db.update(deliveryBoxes).set({
    totalPackages,
    totalWeightKg: totalWeightKg.toFixed(3),
    totalValueUsd: totalValueUsd.toFixed(2),
  }).where(eq(deliveryBoxes.id, boxId));

  appLogger.info("[DeliveryBox] Recomputed box items", {
    boxId, boxCode: box.boxCode, added, updated, removed,
    totalPackages, totalWeightKg, totalValueUsd,
  });

  return { added, updated, removed, totalPackages, totalWeightKg, totalValueUsd };
}
