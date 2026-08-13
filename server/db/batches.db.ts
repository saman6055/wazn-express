import { getDb } from './connection';
import { appLogger } from '../utils/logger';
import { chargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from '@shared/chargeableWeight';
import { getSetting, getVolumetricDivisor } from './settings.db';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import {
  InsertUser, users,
  customers, InsertCustomer, Customer,
  customerCodePrefixes, InsertCustomerCodePrefix, CustomerCodePrefix,
  countries, InsertCountry, Country,
  warehouses, InsertWarehouse, Warehouse,
  pricingRules, InsertPricingRule, PricingRule,
  batches, InsertBatch, Batch,
  batchStatusHistory,
  packages, InsertPackage, Package,
  deliveryBoxes,
  invoices, InsertInvoice, Invoice,
  exchangeRates, InsertExchangeRate, ExchangeRate,
  auditLogs, InsertAuditLog,
  permissions, subPermissions,
  notificationLogs, InsertNotificationLog,
  systemSettings, InsertSystemSetting,
  currencies, taxRates, emailTemplates, ipWhitelist,
  fullPackageOrders, InsertFullPackageOrder, FullPackageOrder,
  suppliers, InsertSupplier, Supplier,
  fullPackageStatusHistory, InsertFullPackageStatusHistory, FullPackageStatusHistory,
  customerNotificationPrefs, InsertCustomerNotificationPref, CustomerNotificationPref,
  vipCustomers, InsertVipCustomer, VipCustomer,
  packageQrCodes, InsertPackageQrCode, PackageQrCode,
  scheduledTasksLog, InsertScheduledTaskLog, ScheduledTaskLog,
  packageScans, InsertPackageScan, PackageScan,
  packageStatusHistory, InsertPackageStatusHistory, PackageStatusHistory,
  scanDevices, InsertScanDevice, ScanDevice,
  customerAccounts, InsertCustomerAccount, CustomerAccount,
  ledgerTransactions, InsertLedgerTransaction, LedgerTransaction,
  paymentRecords, InsertPaymentRecord, PaymentRecord,
  creditAdjustments, InsertCreditAdjustment, CreditAdjustment,
  paymentReminders, InsertPaymentReminder, PaymentReminder,
  productCategories, InsertProductCategory, ProductCategory,
  batchPricingTiers, InsertBatchPricingTier, BatchPricingTier,
  batchCustomerPricing, InsertBatchCustomerPricing, BatchCustomerPricing,
  notificationSettings, InsertNotificationSetting, NotificationSetting,
  expenseCategories, InsertExpenseCategory, ExpenseCategory,
  expenses, InsertExpense, Expense,
  partners, InsertPartner, Partner,
  partnerTransactions, InsertPartnerTransaction, PartnerTransaction,
  companyDebts, InsertCompanyDebt, CompanyDebt,
  debtPayments, InsertDebtPayment, DebtPayment,
  cashAccounts, InsertCashAccount, CashAccount,
  cashTransactions, InsertCashTransaction, CashTransaction,
  financialPeriods, InsertFinancialPeriod, FinancialPeriod,
  scanHistory, InsertScanHistory, ScanHistory,
  serviceTypes, InsertServiceType, ServiceType,
  extraServices, InsertExtraService, ExtraService,
  packageClaimRequests, InsertPackageClaimRequest, PackageClaimRequest,
  stockCategories, InsertStockCategory, StockCategory,
  stockProducts, InsertStockProduct, StockProduct,
  stockPurchases, InsertStockPurchase, StockPurchase,
  stockPurchaseItems, InsertStockPurchaseItem, StockPurchaseItem,
  stockSales, InsertStockSale, StockSale,
  stockSaleItems, InsertStockSaleItem, StockSaleItem,
  stockMovements, InsertStockMovement, StockMovement,
  customerMessages, InsertCustomerMessage, CustomerMessage,
  customerAddresses, InsertCustomerAddress, CustomerAddress,
  notificationTemplates, InsertNotificationTemplate, NotificationTemplate,
  labelTemplates, InsertLabelTemplate, LabelTemplate,
  invoiceTemplates, InsertInvoiceTemplate, InvoiceTemplate,
  customerNotifications, InsertCustomerNotification, CustomerNotification,
  revenueRecords, InsertRevenueRecord, RevenueRecord,
  dailyFinancialSummary, InsertDailyFinancialSummary, DailyFinancialSummary,
  blogPosts, InsertBlogPost, BlogPost,
  deletionLogs, InsertDeletionLog, DeletionLog,
  activityAlerts, InsertActivityAlert, ActivityAlert,
  supportChats, InsertSupportChat, SupportChat,
  chatMessages, InsertChatMessage, ChatMessage,
  backups, InsertBackup, Backup,
  expenseAlerts, InsertExpenseAlert, ExpenseAlert,
  expenseAlertLogs, InsertExpenseAlertLog, ExpenseAlertLog
} from "../../drizzle/schema";

// ============ BATCH OPERATIONS ============

/**
 * Auto-generate a batch code when the user leaves it blank. Batch codes are
 * now optional (free-form) — if the user types their own we keep it verbatim;
 * otherwise we mint one in the familiar "{SEA|AIR}-{YYYY}-{NNN}" shape, where
 * NNN is the next sequence for that prefix + year. Mirrors generateBoxCode.
 */
export async function generateBatchCode(shippingType: string): Promise<string> {
  const db = await getDb();
  const prefix = shippingType === "sea" ? "SEA" : "AIR";
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  if (db) {
    try {
      const [result] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(batches)
        .where(sql`batchCode LIKE ${base + '%'}`);
      let seq = (result?.count || 0) + 1;
      // Walk forward until the candidate is actually free — a manually-typed
      // code can occupy a slot the plain count would otherwise reuse, so the
      // count alone is not enough to guarantee uniqueness.
      for (let i = 0; i < 1000; i++) {
        const candidate = `${base}${String(seq).padStart(3, '0')}`;
        const exists = await db.select({ id: batches.id }).from(batches)
          .where(eq(batches.batchCode, candidate)).limit(1);
        if (exists.length === 0) return candidate;
        seq++;
      }
      return `${base}${Date.now().toString(36).slice(-4).toUpperCase()}`;
    } catch {
      return `${base}${Date.now().toString(36).slice(-3).toUpperCase()}`;
    }
  }
  return `${base}001`;
}

export async function createBatch(data: InsertBatch): Promise<Batch> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Batch code is optional: fill a generated one when the caller sent nothing.
  const batchCode = data.batchCode?.trim() ? data.batchCode.trim() : await generateBatchCode(data.shippingType);
  // Codes must stay unique. A manually-typed duplicate gets a clear message
  // instead of a raw DB constraint error. (Generated codes are already free.)
  const existing = await db.select({ id: batches.id }).from(batches)
    .where(eq(batches.batchCode, batchCode)).limit(1);
  if (existing.length > 0) {
    throw new Error(`کۆدی باچ «${batchCode}» پێشتر بەکارهاتووە — تکایە کۆدێکی جیاواز بنووسە`);
  }
  data = { ...data, batchCode };
  const result = await db.insert(batches).values(data);
  const insertId = Number(result[0].insertId);
  if (!insertId) throw new Error("Failed to insert batch");
  const inserted = await db.select().from(batches).where(eq(batches.id, insertId)).limit(1);
  if (!inserted[0]) throw new Error("Failed to retrieve inserted batch");
  return inserted[0];
}

/** Look up a batch by its (unique) code. Used to reject duplicate codes with
 *  a friendly message before insert. */
export async function getBatchByCode(batchCode: string): Promise<Batch | null> {
  const db = await getDb();
  if (!db) return null;
  const [batch] = await db.select().from(batches).where(eq(batches.batchCode, batchCode)).limit(1);
  return batch || null;
}

const BATCH_LIST_DEFAULT_LIMIT = 50;

export async function getAllBatches(options: { page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page: 1, pageSize: BATCH_LIST_DEFAULT_LIMIT, totalPages: 0 };
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? BATCH_LIST_DEFAULT_LIMIT));
  const offset = (page - 1) * pageSize;

  const countResult = await db.select({ count: count() }).from(batches);
  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const data = await db.select({
    id: batches.id,
    batchCode: batches.batchCode,
    originWarehouseId: batches.originWarehouseId,
    destinationCountryId: batches.destinationCountryId,
    shippingType: batches.shippingType,
    carrierInfo: batches.carrierInfo,
    // The carrier's own identifiers. These are not decoration on the list:
    // the edit dialog is populated from this very row, so a column missing
    // here reaches the form as blank — and a blank the operator then saves
    // over is how a recorded container number or tracking list disappears.
    airlineName: batches.airlineName,
    flightNumber: batches.flightNumber,
    shippingCompany: batches.shippingCompany,
    containerNumber: batches.containerNumber,
    vesselName: batches.vesselName,
    awbNumber: batches.awbNumber,
    shipmentTrackings: batches.shipmentTrackings,
    cartonCount: batches.cartonCount,
    // Where the work was done — Guangzhou or Erbil.
    createdInCountryId: batches.createdInCountryId,
    createdInCity: batches.createdInCity,
    createdById: batches.createdById,
    status: batches.status,
    totalPackages: batches.totalPackages,
    totalWeight: batches.totalWeight,
    actualWeightKg: batches.actualWeightKg,
    actualCbm: batches.actualCbm,
    costPerKg: batches.costPerKg,
    costPerCbm: batches.costPerCbm,
    pricePerKg: batches.pricePerKg,
    pricePerCbm: batches.pricePerCbm,
    useTieredPricing: batches.useTieredPricing,
    departureDate: batches.departureDate,
    estimatedArrival: batches.estimatedArrival,
    actualArrival: batches.actualArrival,
    createdAt: batches.createdAt,
    updatedAt: batches.updatedAt,
  })
    .from(batches)
    .orderBy(desc(batches.createdAt))
    .limit(pageSize)
    .offset(offset);

  /**
   * The real number of parcels in each batch, counted rather than read.
   *
   * `batches.totalPackages` is incremented when a package is assigned and is
   * never decremented, never recomputed, and not written at all by some of
   * the paths that assign one — so it drifts in both directions. Every batch
   * in the list was showing 0 while holding parcels, and the delete button
   * (offered only for an empty batch) appeared on batches that were not
   * empty. The server refused those, so nothing was lost, but the screen was
   * lying either way.
   *
   * One grouped query for the whole page, not one per row.
   */
  const ids = data.map((b) => b.id);
  const counts = ids.length
    ? await db
        .select({ batchId: packages.batchId, n: count() })
        .from(packages)
        .where(inArray(packages.batchId, ids))
        .groupBy(packages.batchId)
    : [];
  const countByBatch = new Map(counts.map((r) => [r.batchId, Number(r.n)]));

  const withCounts = data.map((batch) => ({
    ...batch,
    packageCount: countByBatch.get(batch.id) ?? 0,
  }));

  return { data: withCounts, total, page, pageSize, totalPages };
}

export async function getBatchById(id: number): Promise<Batch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
  return result[0];
}

/**
 * Update a batch, and record the move if its status changed.
 *
 * The history is written here rather than in the three routers that call
 * this, because a fourth caller added next year would otherwise have to
 * remember — and forgetting to write a link is exactly how the self-order
 * bug happened. There is one place a batch's status changes, so there is
 * one place the move is recorded.
 *
 * Only on an actual change. `updateBatch` is also called to bump a package
 * count, and a row saying "arrived → arrived" every time a parcel is added
 * would bury the six that mean something.
 *
 * `changedById` is optional and stays null for a background job. Inventing a
 * user id for one would be worse than recording none.
 */
export async function updateBatch(
  id: number,
  data: Partial<InsertBatch>,
  changedById?: number | null,
) {
  const db = await getDb();
  if (!db) return;

  // Read the old status before the write, and only when the write might
  // change it — an unrelated update should not cost a query.
  const nextStatus = (data as Partial<InsertBatch>).status;
  let previousStatus: string | null = null;
  if (nextStatus !== undefined) {
    const [before] = await db.select({ status: batches.status })
      .from(batches)
      .where(eq(batches.id, id))
      .limit(1);
    previousStatus = before?.status ?? null;
  }

  await db.update(batches).set(data).where(eq(batches.id, id));

  if (nextStatus !== undefined && nextStatus !== previousStatus) {
    try {
      await db.insert(batchStatusHistory).values({
        batchId: id,
        fromStatus: previousStatus,
        toStatus: nextStatus,
        changedById: changedById ?? null,
      });
    } catch (err) {
      // A shipment's status must never fail to save because its history
      // could not be written. The move has already happened; losing the note
      // about it costs a date on a timeline, not the state itself.
      appLogger.error("[Batch] status history write failed", { batchId: id, err });
    }
  }
}

export async function getActiveBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batches).where(
    or(
      eq(batches.status, "preparing"),
      eq(batches.status, "in_transit"),
      eq(batches.status, "arrived"),
      eq(batches.status, "customs")
    )
  ).orderBy(desc(batches.createdAt));
}


// ============ BATCH HELPERS ============

export async function getBatchesByShippingType(shippingType: string): Promise<Batch[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(batches)
    .where(and(
      eq(batches.shippingType, shippingType as any),
      eq(batches.status, 'preparing')
    ))
    .orderBy(desc(batches.createdAt));
}



// ============ BATCH PRICING TIERS ============

export async function getBatchPricingTiers(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId)).orderBy(batchPricingTiers.sortOrder);
}

export async function createBatchPricingTier(data: InsertBatchPricingTier) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(batchPricingTiers).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function updateBatchPricingTier(id: number, data: Partial<InsertBatchPricingTier>) {
  const db = await getDb();
  if (!db) return;
  await db.update(batchPricingTiers).set(data).where(eq(batchPricingTiers.id, id));
}

export async function deleteBatchPricingTier(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.id, id));
}

export async function deleteBatchPricingTiersByBatch(batchId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId));
}

export async function setBatchPricingTiers(batchId: number, tiers: Omit<InsertBatchPricingTier, 'batchId'>[]) {
  const db = await getDb();
  if (!db) return;
  
  // Delete existing tiers
  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId));
  
  // Insert new tiers
  if (tiers.length > 0) {
    const tiersWithBatchId = tiers.map((tier, index) => ({
      ...tier,
      batchId,
      sortOrder: index
    }));
    await db.insert(batchPricingTiers).values(tiersWithBatchId);
  }
}

// Get the applicable price for a customer based on their total weight/CBM in a batch
export async function getApplicableTierPrice(batchId: number, customerTotalValue: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const tiers = await db.select().from(batchPricingTiers)
    .where(eq(batchPricingTiers.batchId, batchId))
    .orderBy(batchPricingTiers.sortOrder);
  
  if (tiers.length === 0) return null;
  
  // Find the matching tier
  for (const tier of tiers) {
    const minVal = Number(tier.minValue);
    const maxVal = tier.maxValue ? Number(tier.maxValue) : Infinity;
    
    if (customerTotalValue >= minVal && customerTotalValue < maxVal) {
      return Number(tier.pricePerUnit);
    }
  }
  
  // If no tier matches, return the last tier's price (for values above all tiers)
  return Number(tiers[tiers.length - 1].pricePerUnit);
}

/**
 * The divisor every volumetric calculation must agree on.
 *
 * It was written as a literal 6000 in three places here while the register
 * form read it from settings, so changing the setting would have moved the
 * quoted price and left the invoice where it was. One reader, one answer.
 */
// The divisor now has one reader, in settings.db — see getVolumetricDivisor there.

// Calculate customer's total weight/CBM in a batch
// For kg unit, uses chargeable weight (max of actual weight and volumetric weight)
export async function getCustomerTotalInBatch(batchId: number, customerId: number, unit: 'kg' | 'cbm'): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const customerPackages = await db.select().from(packages)
    .where(and(
      eq(packages.batchId, batchId),
      eq(packages.customerId, customerId)
    ));
  
  if (unit === 'kg') {
    // Chargeable weight: the greater of the scale and the dimensions. Same
    // calculation the register form quotes from, so the two cannot drift.
    const divisor = await getVolumetricDivisor();
    return customerPackages.reduce((sum, pkg) => {
      return sum + chargeableWeight(pkg, divisor).chargeableKg;
    }, 0);
  } else {
    return customerPackages.reduce((sum, pkg) => sum + (Number(pkg.volumeCbm) || 0), 0);
  }
}


// ============ BATCH CUSTOMER PRICING FUNCTIONS ============

export async function getBatchCustomerPricing(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
}

/** Batch fetch customer pricing for multiple batches (avoids N+1). */
export async function getBatchCustomerPricingForBatches(batchIds: number[]): Promise<Map<number, { customerId: number; pricePerKg?: string; pricePerCbm?: string }[]>> {
  const db = await getDb();
  const map = new Map<number, { customerId: number; pricePerKg?: string; pricePerCbm?: string }[]>();
  if (!db || batchIds.length === 0) return map;
  const rows = await db.select({
    batchId: batchCustomerPricing.batchId,
    customerId: batchCustomerPricing.customerId,
    pricePerKg: batchCustomerPricing.pricePerKg,
    pricePerCbm: batchCustomerPricing.pricePerCbm,
  })
    .from(batchCustomerPricing)
    .where(inArray(batchCustomerPricing.batchId, batchIds));
  for (const row of rows) {
    const list = map.get(row.batchId) ?? [];
    list.push({ customerId: row.customerId, pricePerKg: row.pricePerKg ?? undefined, pricePerCbm: row.pricePerCbm ?? undefined });
    map.set(row.batchId, list);
  }
  return map;
}

export async function getCustomerPricingInBatch(batchId: number, customerId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(batchCustomerPricing)
    .where(and(
      eq(batchCustomerPricing.batchId, batchId),
      eq(batchCustomerPricing.customerId, customerId)
    ))
    .limit(1);
  return result[0] || null;
}

export async function createBatchCustomerPricing(data: InsertBatchCustomerPricing) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(batchCustomerPricing).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function updateBatchCustomerPricing(id: number, data: Partial<InsertBatchCustomerPricing>) {
  const db = await getDb();
  if (!db) return;
  await db.update(batchCustomerPricing).set(data).where(eq(batchCustomerPricing.id, id));
}

export async function deleteBatchCustomerPricing(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.id, id));
}

export async function deleteBatchCustomerPricingByBatch(batchId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
}

export async function setBatchCustomerPricing(batchId: number, customerPricing: Omit<InsertBatchCustomerPricing, 'batchId'>[]) {
  const db = await getDb();
  if (!db) return;
  
  // Delete existing customer pricing for this batch
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
  
  // Insert new customer pricing
  if (customerPricing.length > 0) {
    const pricingWithBatchId = customerPricing.map(pricing => ({
      ...pricing,
      batchId
    }));
    await db.insert(batchCustomerPricing).values(pricingWithBatchId);
  }
}

// Get the applicable price for a customer in a batch (checks customer-specific price first, then default)
export async function getCustomerPriceInBatch(batchId: number, customerId: number, unit: 'kg' | 'cbm'): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // First check for customer-specific pricing
  const customerPricing = await getCustomerPricingInBatch(batchId, customerId);
  if (customerPricing) {
    if (unit === 'kg' && customerPricing.pricePerKg) {
      return Number(customerPricing.pricePerKg);
    } else if (unit === 'cbm' && customerPricing.pricePerCbm) {
      return Number(customerPricing.pricePerCbm);
    }
  }
  
  // Fall back to batch default price
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  
  if (unit === 'kg' && batch.pricePerKg) {
    return Number(batch.pricePerKg);
  } else if (unit === 'cbm' && batch.pricePerCbm) {
    return Number(batch.pricePerCbm);
  }
  
  return null;
}

// Get batch financial summary
export async function getBatchFinancialSummary(batchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const batch = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch[0]) return null;
  
  const batchData = batch[0];
  const batchPackages = await db.select().from(packages).where(eq(packages.batchId, batchId));
  
  // Calculate totals from packages if batch fields are not set
  let packageTotalWeight = 0;
  let packageTotalCbm = 0;
  for (const pkg of batchPackages) {
    packageTotalWeight += Number(pkg.weightKg) || 0;
    packageTotalCbm += Number(pkg.volumeCbm) || 0;
  }
  
  // Calculate chargeable weight for each package (max of actual vs volumetric)
  const divisor = await getVolumetricDivisor();
  let totalChargeableWeight = 0;
  for (const pkg of batchPackages) {
    totalChargeableWeight += chargeableWeight(pkg, divisor).chargeableKg;
  }
  
  // Use batch values if set, otherwise use calculated values from packages
  const actualWeight = Number(batchData.actualWeightKg) || packageTotalWeight;
  const actualCbm = Number(batchData.actualCbm) || packageTotalCbm;
  const chargedWeight = Number(batchData.chargedWeightKg) || totalChargeableWeight;
  const chargedCbm = Number(batchData.chargedCbm) || packageTotalCbm;
  
  // Calculate total cost using chargeable weight (from packages) × cost per KG
  let totalCost = 0;
  if (batchData.shippingType === 'sea') {
    const costPerCbm = Number(batchData.costPerCbm) || 0;
    totalCost = chargedCbm * costPerCbm;
  } else {
    const costPerKg = Number(batchData.costPerKg) || 0;
    // Use totalChargeableWeight (sum of max(actual, volumetric) for each package)
    totalCost = totalChargeableWeight * costPerKg;
  }

  // Per-customer breakdown — built in TWO passes:
  //  1. Sum chargeable weight / cbm per customer.
  //  2. Resolve each customer's rate (override → tier → batch default) and
  //     compute revenue = customer_total × rate.
  //
  // We do NOT trust `pkg.calculatedCostUsd` for in-flight batches: that field
  // is set at registration using raw actualKg (not chargeable kg) and at
  // whatever rate was current then, so it goes stale whenever pricing or
  // dimensions change. For delivered/closed batches we DO honor the stored
  // value because it represents the actual amount billed to the customer.
  const isSea = batchData.shippingType === 'sea';
  const unit: 'kg' | 'cbm' = isSea ? 'cbm' : 'kg';
  const batchDefaultRate = isSea
    ? Number(batchData.pricePerCbm) || 0
    : Number(batchData.pricePerKg) || 0;
  const isFinalized = batchData.status === 'delivered' || batchData.status === 'closed';

  const customerBreakdown: Record<number, { customerId: number; packages: number; weight: number; chargeableWeight: number; cbm: number; revenue: number }> = {};

  for (const pkg of batchPackages) {
    if (!pkg.customerId) continue;

    if (!customerBreakdown[pkg.customerId]) {
      customerBreakdown[pkg.customerId] = {
        customerId: pkg.customerId,
        packages: 0,
        weight: 0,
        chargeableWeight: 0,
        cbm: 0,
        revenue: 0
      };
    }

    const actualKg = Number(pkg.weightKg) || 0;
    const chargeableKg = chargeableWeight(pkg, divisor).chargeableKg;

    customerBreakdown[pkg.customerId].packages++;
    customerBreakdown[pkg.customerId].weight += actualKg;
    customerBreakdown[pkg.customerId].chargeableWeight += chargeableKg;
    customerBreakdown[pkg.customerId].cbm += Number(pkg.volumeCbm) || 0;
    // Stored revenue accumulator — only consulted when the batch is finalized.
    customerBreakdown[pkg.customerId].revenue += Number(pkg.calculatedCostUsd) || 0;
  }

  // Pass 2 — recompute revenue from current rates for in-flight batches.
  if (!isFinalized) {
    // Pull customer overrides once, build a lookup map.
    const overrides = await db.select().from(batchCustomerPricing)
      .where(eq(batchCustomerPricing.batchId, batchId));
    const overrideMap = new Map<number, { pricePerKg?: string | null; pricePerCbm?: string | null }>();
    for (const o of overrides) {
      overrideMap.set(o.customerId, { pricePerKg: o.pricePerKg, pricePerCbm: o.pricePerCbm });
    }

    for (const customerEntry of Object.values(customerBreakdown)) {
      const customerTotal = unit === 'kg' ? customerEntry.chargeableWeight : customerEntry.cbm;
      let rate: number | null = null;

      // 1. Customer-specific override
      const override = overrideMap.get(customerEntry.customerId);
      if (override) {
        const v = unit === 'kg' ? override.pricePerKg : override.pricePerCbm;
        if (v != null && v !== '') rate = Number(v);
      }

      // 2. Tiered pricing (rate depends on this customer's total in the batch)
      if (rate === null && batchData.useTieredPricing) {
        rate = await getApplicableTierPrice(batchId, customerTotal);
      }

      // 3. Batch default
      if (rate === null) rate = batchDefaultRate;

      customerEntry.revenue = (rate || 0) * customerTotal;
    }
  }

  const totalRevenue = Object.values(customerBreakdown)
    .reduce((sum, c) => sum + c.revenue, 0);
  
  return {
    batchId,
    shippingType: batchData.shippingType,
    actualWeight,
    actualCbm,
    chargedWeight,
    chargedCbm,
    totalChargeableWeight, // Sum of max(actual, volumetric) for each package
    costPerKg: Number(batchData.costPerKg) || 0,
    costPerCbm: Number(batchData.costPerCbm) || 0,
    totalCost,
    totalRevenue,
    profit: totalRevenue - totalCost,
    profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0,
    totalPackages: batchPackages.length,
    customerBreakdown: Object.values(customerBreakdown)
  };
}


/**
 * Every recorded move for one batch, oldest first.
 *
 * Only ever as many rows as a shipment has stages, so no ceiling is needed —
 * a batch that somehow accumulated hundreds would be a data problem worth
 * seeing rather than hiding behind a limit.
 */
export async function getBatchStatusHistory(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    fromStatus: batchStatusHistory.fromStatus,
    toStatus: batchStatusHistory.toStatus,
    changedAt: batchStatusHistory.changedAt,
  })
    .from(batchStatusHistory)
    .where(eq(batchStatusHistory.batchId, batchId))
    .orderBy(asc(batchStatusHistory.changedAt));
}

/**
 * The first time each batch reached each status, for a whole set at once.
 *
 * The portal's shipment list draws a stepper per card, so asking per batch
 * would be one query per row — the fan-out this codebase has had to undo
 * twice already. One query, grouped in memory.
 *
 * First occurrence, not last: if a shipment was moved to `customs` twice, the
 * date a customer cares about is when it got there, not when someone
 * corrected the record.
 */
export async function getBatchStatusTimestamps(batchIds: number[]): Promise<Map<number, Record<string, Date>>> {
  const byBatch = new Map<number, Record<string, Date>>();
  if (batchIds.length === 0) return byBatch;

  const db = await getDb();
  if (!db) return byBatch;

  const rows = await db.select({
    batchId: batchStatusHistory.batchId,
    toStatus: batchStatusHistory.toStatus,
    changedAt: batchStatusHistory.changedAt,
  })
    .from(batchStatusHistory)
    .where(inArray(batchStatusHistory.batchId, batchIds))
    .orderBy(asc(batchStatusHistory.changedAt));

  for (const row of rows) {
    const existing = byBatch.get(row.batchId) ?? {};
    // Ordered oldest first, so the first write for a status is the one to keep.
    if (!existing[row.toStatus]) existing[row.toStatus] = row.changedAt;
    byBatch.set(row.batchId, existing);
  }

  return byBatch;
}

/**
 * What is standing in the way of deleting this batch.
 *
 * Counted from the referencing tables, never from `batches.totalPackages` —
 * that counter is incremented when a package is assigned and is never
 * decremented when one is moved away, so a batch that has been emptied still
 * reads as full. Deciding a deletion on it would refuse the exact case this
 * exists for.
 *
 * Everything counted here represents work already done against the batch.
 * Its own children — pricing tiers, customer pricing, status history — are
 * not blockers; they are deleted with it.
 */
export async function getBatchDeletionBlockers(batchId: number): Promise<{
  packages: number;
  deliveryBoxes: number;
  invoices: number;
  fullPackageOrders: number;
  total: number;
}> {
  const db = await getDb();
  const empty = { packages: 0, deliveryBoxes: 0, invoices: 0, fullPackageOrders: 0, total: 0 };
  if (!db) return empty;

  const one = async (table: any, column: any) => {
    const rows = await db.select({ n: count() }).from(table).where(eq(column, batchId));
    return Number(rows[0]?.n ?? 0);
  };

  const result = {
    packages: await one(packages, packages.batchId),
    deliveryBoxes: await one(deliveryBoxes, deliveryBoxes.batchId),
    invoices: await one(invoices, invoices.batchId),
    fullPackageOrders: await one(fullPackageOrders, fullPackageOrders.batchId),
    total: 0,
  };
  result.total =
    result.packages + result.deliveryBoxes + result.invoices + result.fullPackageOrders;
  return result;
}

/**
 * Delete a batch and the rows that belong to it.
 *
 * Callers must check `getBatchDeletionBlockers` first — this does not, so
 * that the router can refuse with a message naming what is in the way.
 * Scan history keeps its batch id: it is a record of something that
 * happened, and rewriting it to hide a deletion would be worse than a
 * dangling id.
 */
export async function deleteBatch(batchId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId));
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
  await db.delete(batchStatusHistory).where(eq(batchStatusHistory.batchId, batchId));
  await db.delete(batches).where(eq(batches.id, batchId));
}

/**
 * Let go of every parcel in a batch, and say which ones they were.
 *
 * A batch created by mistake usually has parcels scanned into it already —
 * that is how the mistake gets noticed. Deleting the batch must not take
 * them with it: they go back to unassigned, exactly as they were before the
 * scan, and can be scanned into the right batch straight away.
 *
 * Returns the ids so the recycle bin can record them. Restoring the batch
 * then knows which parcels to put back, rather than guessing from a batchId
 * that no longer exists anywhere.
 */
export async function releasePackagesFromBatch(batchId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.batchId, batchId));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  await db
    .update(packages)
    // Back to where a parcel sits before anyone scans it into a shipment.
    .set({ batchId: null, status: "registered" })
    .where(eq(packages.batchId, batchId));

  return ids;
}

/**
 * Put released parcels back into a restored batch.
 *
 * Only the ones still free: a parcel scanned into another batch in the
 * meantime belongs there now, and dragging it back would silently move
 * somebody's goods onto the wrong shipment. Returns how many were reattached
 * and how many had moved on, so the restore can say so.
 */
export async function reattachPackagesToBatch(
  batchId: number,
  packageIds: number[]
): Promise<{ reattached: number; movedOn: number }> {
  const db = await getDb();
  if (!db || packageIds.length === 0) return { reattached: 0, movedOn: 0 };

  const free = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(inArray(packages.id, packageIds), isNull(packages.batchId)));
  const freeIds = free.map((r) => r.id);

  if (freeIds.length > 0) {
    await db
      .update(packages)
      .set({ batchId, status: "in_batch" })
      .where(inArray(packages.id, freeIds));
  }

  return { reattached: freeIds.length, movedOn: packageIds.length - freeIds.length };
}
