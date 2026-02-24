import { getDb } from './connection';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import {
  InsertUser, users,
  customers, InsertCustomer, Customer,
  customerCodePrefixes, InsertCustomerCodePrefix, CustomerCodePrefix,
  countries, InsertCountry, Country,
  warehouses, InsertWarehouse, Warehouse,
  pricingRules, InsertPricingRule, PricingRule,
  batches, InsertBatch, Batch,
  packages, InsertPackage, Package,
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

export async function createBatch(data: InsertBatch): Promise<Batch> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(batches).values(data);
  const insertId = Number(result[0].insertId);
  if (!insertId) throw new Error("Failed to insert batch");
  const inserted = await db.select().from(batches).where(eq(batches.id, insertId)).limit(1);
  if (!inserted[0]) throw new Error("Failed to retrieve inserted batch");
  return inserted[0];
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

  return { data, total, page, pageSize, totalPages };
}

export async function getBatchById(id: number): Promise<Batch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
  return result[0];
}

export async function updateBatch(id: number, data: Partial<InsertBatch>) {
  const db = await getDb();
  if (!db) return;
  await db.update(batches).set(data).where(eq(batches.id, id));
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
    // Use chargeable weight (max of actual weight and volumetric weight)
    return customerPackages.reduce((sum, pkg) => {
      const actualKg = Number(pkg.weightKg) || 0;
      const lengthCm = Number(pkg.lengthCm) || 0;
      const widthCm = Number(pkg.widthCm) || 0;
      const heightCm = Number(pkg.heightCm) || 0;
      // Volumetric weight = (L × W × H) / 6000 for air shipping
      const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
      // Chargeable weight is the higher of actual weight and volumetric weight
      const chargeableKg = Math.max(actualKg, volumetricKg);
      return sum + chargeableKg;
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
  let totalChargeableWeight = 0;
  for (const pkg of batchPackages) {
    const actualKg = Number(pkg.weightKg) || 0;
    const lengthCm = Number(pkg.lengthCm) || 0;
    const widthCm = Number(pkg.widthCm) || 0;
    const heightCm = Number(pkg.heightCm) || 0;
    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
    const chargeableKg = Math.max(actualKg, volumetricKg);
    totalChargeableWeight += chargeableKg;
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
  
  // Calculate total revenue from packages
  const totalRevenue = batchPackages.reduce((sum, pkg) => sum + (Number(pkg.calculatedCostUsd) || 0), 0);
  
  // Get per-customer breakdown
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
    
    // Calculate chargeable weight for this package
    const actualKg = Number(pkg.weightKg) || 0;
    const lengthCm = Number(pkg.lengthCm) || 0;
    const widthCm = Number(pkg.widthCm) || 0;
    const heightCm = Number(pkg.heightCm) || 0;
    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
    const chargeableKg = Math.max(actualKg, volumetricKg);
    
    customerBreakdown[pkg.customerId].packages++;
    customerBreakdown[pkg.customerId].weight += actualKg;
    customerBreakdown[pkg.customerId].chargeableWeight += chargeableKg;
    customerBreakdown[pkg.customerId].cbm += Number(pkg.volumeCbm) || 0;
    customerBreakdown[pkg.customerId].revenue += Number(pkg.calculatedCostUsd) || 0;
  }
  
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

