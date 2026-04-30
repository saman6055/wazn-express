import { eq, desc, and, gte, lte, sql, inArray, isNull } from "drizzle-orm";
import { getDb } from "./connection";
import { deliveryBoxes, deliveryBoxItems, packages, fullPackageOrders, batches, customers } from "../../drizzle/schema";
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
}): Promise<{ boxes: DeliveryBox[]; total: number }> {
  const db = await getDb();
  if (!db) return { boxes: [], total: 0 };

  const conditions = [];
  if (filters?.status) conditions.push(eq(deliveryBoxes.status, filters.status as any));
  if (filters?.customerId) conditions.push(eq(deliveryBoxes.customerId, filters.customerId));
  if (filters?.deliveryMethod) conditions.push(eq(deliveryBoxes.deliveryMethod, filters.deliveryMethod as any));
  if (filters?.search) conditions.push(sql`(${deliveryBoxes.boxCode} LIKE ${`%${filters.search}%`} OR ${deliveryBoxes.destinationCity} LIKE ${`%${filters.search}%`})`);
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

  return { boxes, total };
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

export async function getBoxItems(boxId: number): Promise<DeliveryBoxItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deliveryBoxItems)
    .where(eq(deliveryBoxItems.boxId, boxId))
    .orderBy(deliveryBoxItems.scannedAt);
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

    // Insert items — reuse the pricing logic from scanning.router.ts addItem
    for (const pkg of pkgs) {
      // Determine pricing based on linked FP order (if any)
      let itemType: 'regular' | 'full_package' | 'commission' = 'regular';
      let sourceInfo = `باچ ${batchRow.batchCode}`;
      let description = pkg.description || pkg.trackingNumber || '';
      let calculatedCostUsd = pkg.calculatedCostUsd?.toString() || '0';

      if (pkg.trackingNumber) {
        const [linkedFP] = await db.select().from(fullPackageOrders)
          .where(eq(fullPackageOrders.trackingNumber, pkg.trackingNumber))
          .limit(1);
        if (linkedFP) {
          itemType = linkedFP.orderType === 'commission' ? 'commission' : 'full_package';
          sourceInfo = `${linkedFP.orderCode} - ${sourceInfo}`;
          description = linkedFP.productName || description;
          const qty = linkedFP.quantity || 1;
          if (linkedFP.orderType === 'commission') {
            const itemPrice = Number(linkedFP.itemPriceUsd || 0);
            const commFee = Number(linkedFP.commissionFeeUsd || linkedFP.commissionAmount || 0);
            const shippingCost = Number(pkg.calculatedCostUsd || 0);
            // Per spec: commission rolls into a single "نرخی بەرهەم" total
            // on box receipts — no separate commission line. Shipping stays
            // on its own line so the customer can still see what they paid
            // for transport vs. goods.
            const goodsTotal = (itemPrice * qty) + commFee;
            calculatedCostUsd = (goodsTotal + shippingCost).toFixed(2);
            description = `${linkedFP.productName || ''} | نرخی بەرهەم: $${goodsTotal.toFixed(2)} + نرخی گواستنەوە: $${shippingCost.toFixed(2)}`;
          } else {
            const sellingPrice = Number(linkedFP.sellingPriceUsd || 0);
            calculatedCostUsd = (sellingPrice * qty).toFixed(2);
          }
        }
      }

      await db.insert(deliveryBoxItems).values({
        boxId,
        packageId: pkg.id,
        trackingNumber: pkg.trackingNumber || undefined,
        packageCode: pkg.packageCode || undefined,
        description,
        weightKg: pkg.weightKg?.toString() || '0',
        calculatedCostUsd,
        itemType,
        sourceInfo,
        scannedById: userId,
      });
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
