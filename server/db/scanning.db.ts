import { getDb } from './connection';
import { advanceStatus, type PackageStatus } from '../lib/scanStatus';
import { appLogger } from '../utils/logger';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { getCustomerById } from './customers.db';
import { getPackageById, getPackageOrderLinks, updatePackage } from './packages.db';
import { getFullPackageOrderByTrackingNumber, getAllOrdersByTrackingNumber, updateFullPackageOrder } from './fullPackage.db';
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

// ============ QR CODE OPERATIONS ============

export async function createPackageQrCode(data: InsertPackageQrCode): Promise<PackageQrCode> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(packageQrCodes).values(data);
  const inserted = await db.select().from(packageQrCodes).where(eq(packageQrCodes.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getQrCodeByPackage(packageId: number, packageType: 'regular' | 'full_package' = 'regular') {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packageQrCodes)
    .where(and(eq(packageQrCodes.packageId, packageId), eq(packageQrCodes.packageType, packageType)))
    .limit(1);
  return result[0];
}

export async function getQrCodeByCode(qrCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packageQrCodes).where(eq(packageQrCodes.qrCode, qrCode)).limit(1);
  return result[0];
}

export async function updateQrCodeScan(qrCode: string, scannedById: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(packageQrCodes).set({
    lastScannedAt: new Date(),
    lastScannedById: scannedById,
    scanCount: sql`${packageQrCodes.scanCount} + 1`,
  }).where(eq(packageQrCodes.qrCode, qrCode));
}


// ============ BARCODE SCANNING FUNCTIONS ============

// Search package by tracking number
export async function searchPackageByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  // Search by tracking number first
  let results = await db.select().from(packages).where(eq(packages.trackingNumber, trackingNumber)).limit(1);
  if (results[0]) return results[0];
  // If not found, search by package code
  results = await db.select().from(packages).where(eq(packages.packageCode, trackingNumber)).limit(1);
  return results[0] || null;
}

// Get package with customer info by tracking
export async function getPackageWithCustomerByTracking(trackingNumber: string) {
  const db = await getDb();
  const pkg = await searchPackageByTracking(trackingNumber);
  if (!pkg) return null;
  
  const customer = pkg.customerId ? await getCustomerById(pkg.customerId) : null;
  return { package: pkg, customer };
}

// Create package scan
export async function createPackageScan(data: InsertPackageScan) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(packageScans).values(data);
  return { id: Number(result[0].insertId) };
}

// Get scans for package
export async function getPackageScans(packageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageScans).where(eq(packageScans.packageId, packageId)).orderBy(desc(packageScans.scannedAt));
}

// Get scans by tracking number
export async function getScansByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageScans).where(eq(packageScans.trackingNumber, trackingNumber)).orderBy(desc(packageScans.scannedAt));
}

// Get recent scans by user
export async function getRecentScansByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageScans).where(eq(packageScans.scannedById, userId)).orderBy(desc(packageScans.scannedAt)).limit(limit);
}

// Get today's scans by warehouse
export async function getTodayScansByWarehouse(warehouseId: number) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.select().from(packageScans)
    .where(and(
      eq(packageScans.warehouseId, warehouseId),
      gte(packageScans.scannedAt, today)
    ))
    .orderBy(desc(packageScans.scannedAt));
}

// Create status history entry
export async function createStatusHistory(data: InsertPackageStatusHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(packageStatusHistory).values(data);
  return { id: Number(result[0].insertId) };
}

// Get status history for package
export async function getPackageStatusHistory(packageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageStatusHistory).where(eq(packageStatusHistory.packageId, packageId)).orderBy(desc(packageStatusHistory.changedAt));
}

// Register scan device
export async function registerScanDevice(data: InsertScanDevice) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(scanDevices).values(data);
  return { id: Number(result[0].insertId) };
}

// Get scan device by identifier
export async function getScanDeviceByIdentifier(identifier: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(scanDevices).where(eq(scanDevices.deviceIdentifier, identifier)).limit(1);
  return results[0] || null;
}

// Update device last active
export async function updateDeviceLastActive(deviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanDevices).set({ 
    lastActiveAt: new Date(),
    totalScans: sql`${scanDevices.totalScans} + 1`
  }).where(eq(scanDevices.id, deviceId));
}

// Get all active devices
export async function getActiveDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanDevices).where(eq(scanDevices.isActive, true)).orderBy(desc(scanDevices.lastActiveAt));
}

// Get scan statistics for today
export async function getTodayScanStats(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (userId) {
    return db.select({
      scanType: packageScans.scanType,
      count: sql<number>`COUNT(*)`
    }).from(packageScans)
      .where(and(
        gte(packageScans.scannedAt, today),
        eq(packageScans.scannedById, userId)
      ))
      .groupBy(packageScans.scanType);
  }
  
  return db.select({
    scanType: packageScans.scanType,
    count: sql<number>`COUNT(*)`
  }).from(packageScans)
    .where(gte(packageScans.scannedAt, today))
    .groupBy(packageScans.scanType);
}

// Update package status via scan
export async function updatePackageStatusViaScan(
  packageId: number, 
  newStatus: string, 
  userId: number,
  scanId: number,
  metadata?: Record<string, unknown> | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  // Get current status
  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error("Package not found");
  
  const oldStatus = pkg.status;

  // Only ever forwards. Scans arrive out of order — a container unpacked late,
  // a parcel rescanned at the wrong station — and without this a stray scan
  // would drag a delivered package back to "in the Erbil depot" and tell the
  // customer their goods had un-arrived. Returning or cancelling is still
  // allowed from anywhere, since that is a deliberate act.
  const resolved = advanceStatus(oldStatus, newStatus as PackageStatus);
  if (!resolved) return { skipped: true, oldStatus, newStatus };

  // Through updatePackage, not straight at the column.
  //
  // The write itself is the same one; what was missing is everything
  // updatePackage does after it. Chief among them is syncing the status onto
  // every full-package and commission order linked to this parcel — so a
  // scan at the Erbil depot moves the customer's order to "arrived", and the
  // delivery scan moves it to "delivered".
  //
  // Writing the column directly meant no scan in the system's history ever
  // moved an order. The goods reached the customer's hand while their order
  // still said "in transit", on the portal and on every purchase report.
  await updatePackage(packageId, { status: resolved, updatedAt: new Date() });
  
  // Create status history
  await createStatusHistory({
    packageId,
    fromStatus: oldStatus,
    toStatus: resolved,
    changedById: userId,
    changeMethod: "scan",
    scanId,
    metadata
  });

  return { oldStatus, newStatus: resolved };
}


// Get today's scans (all or by warehouse)
export async function getTodayScans(warehouseId?: number) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (warehouseId) {
    return db.select().from(packageScans)
      .where(and(
        eq(packageScans.warehouseId, warehouseId),
        gte(packageScans.scannedAt, today)
      ))
      .orderBy(desc(packageScans.scannedAt))
      .limit(200);
  }
  
  return db.select().from(packageScans)
    .where(gte(packageScans.scannedAt, today))
    .orderBy(desc(packageScans.scannedAt))
    .limit(200);
}

// Get packages with missing info
export async function getPackagesMissingInfo() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packages)
    .where(or(
      isNull(packages.weightKg),
      eq(packages.weightKg, ''),
      isNull(packages.lengthCm),
      isNull(packages.widthCm),
      isNull(packages.heightCm)
    ))
    .orderBy(desc(packages.createdAt))
    .limit(100);
}




// ============ SMART SCANNER FUNCTIONS ============

// Get full package order by tracking number
export async function getFullPackageOrderByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(fullPackageOrders)
    .where(eq(fullPackageOrders.trackingNumber, trackingNumber))
    .limit(1);
  
  return result[0] || null;
}

// Update package fields (for inline editing)
export async function updatePackageFields(packageId: number, data: {
  weightKg?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
  volumeCbm?: string;
  notes?: string;
  batchId?: number | null;
  shippingType?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Filter out undefined values
  const updateData: Record<string, any> = {};
  if (data.weightKg !== undefined) updateData.weightKg = data.weightKg;
  if (data.lengthCm !== undefined) updateData.lengthCm = data.lengthCm;
  if (data.widthCm !== undefined) updateData.widthCm = data.widthCm;
  if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
  if (data.volumeCbm !== undefined) updateData.volumeCbm = data.volumeCbm;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.batchId !== undefined) updateData.batchId = data.batchId;
  if (data.shippingType !== undefined) updateData.shippingType = data.shippingType;
  
  if (Object.keys(updateData).length === 0) {
    return getPackageById(packageId);
  }
  
  await db.update(packages).set(updateData).where(eq(packages.id, packageId));
  
  // Sync batchId to EVERY linked full-package order, not just the first one.
  // Resolution order:
  //   1. packageOrderLinks rows (canonical source from Phase 4 onward)
  //   2. shared-tracking fan-out via getAllOrdersByTrackingNumber (catches
  //      legacy rows that pre-date the link table; backfill only mirrors the
  //      primary, so siblings still need the tracking-based lookup)
  //   3. legacy single fullPackageOrderId via tracking (last resort)
  if (data.batchId !== undefined) {
    try {
      const pkg = await getPackageById(packageId);
      const targetOrderIds = new Set<number>();
      if (pkg) {
        const links = await getPackageOrderLinks(packageId);
        for (const l of links) targetOrderIds.add(l.fullPackageOrderId);
        if (pkg.trackingNumber) {
          // Pick up shared-tracking siblings even if not yet in the link table.
          const shared = await getAllOrdersByTrackingNumber(pkg.trackingNumber);
          for (const o of shared) targetOrderIds.add(o.id);
          // Fallback for very old rows that have neither links nor multi-tracking entries.
          if (targetOrderIds.size === 0) {
            const legacy = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
            if (legacy) targetOrderIds.add(legacy.id);
          }
        }
        if (pkg.fullPackageOrderId) targetOrderIds.add(pkg.fullPackageOrderId);
      }
      for (const orderId of Array.from(targetOrderIds)) {
        await updateFullPackageOrder(orderId, { batchId: data.batchId });
      }
      if (targetOrderIds.size > 0) {
        appLogger.info("[FullPackage] Synced batchId to all linked orders", {
          packageId,
          batchId: data.batchId,
          orderCount: targetOrderIds.size,
          orderIds: Array.from(targetOrderIds),
        });
      }
    } catch (e) {
      appLogger.error('[FullPackage] Failed to sync batchId from updatePackageFields', { error: e instanceof Error ? e.message : String(e) });
    }
  }
  
  return getPackageById(packageId);
}

// Update package status only
export async function updatePackageStatus(packageId: number, status: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(packages).set({ status: status as any }).where(eq(packages.id, packageId));
  return getPackageById(packageId);
}


// Get ledger transaction by ID
export async function getLedgerTransactionById(transactionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(ledgerTransactions)
    .where(eq(ledgerTransactions.id, transactionId))
    .limit(1);
  
  return result[0] || null;
}


// ============ SCAN HISTORY FUNCTIONS ============

export async function createScanRecord(data: Omit<InsertScanHistory, 'id' | 'scannedAt'>): Promise<ScanHistory> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(scanHistory).values({
    ...data,
    scannedAt: new Date()
  });
  const [record] = await db.select().from(scanHistory).where(eq(scanHistory.id, result.insertId));
  return record;
}

export async function getScanHistory(options: {
  startDate?: Date;
  endDate?: Date;
  scanType?: string;
  customerId?: number;
  scannedById?: number;
  status?: string;
  trackingNumber?: string;
  limit?: number;
  offset?: number;
}): Promise<{ scans: ScanHistory[]; total: number }> {
  const db = await getDb();
  if (!db) return { scans: [], total: 0 };
  
  const conditions = [];
  
  if (options.startDate) {
    conditions.push(gte(scanHistory.scannedAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(scanHistory.scannedAt, options.endDate));
  }
  if (options.scanType) {
    conditions.push(eq(scanHistory.scanType, options.scanType as any));
  }
  if (options.customerId) {
    conditions.push(eq(scanHistory.customerId, options.customerId));
  }
  if (options.scannedById) {
    conditions.push(eq(scanHistory.scannedById, options.scannedById));
  }
  if (options.status) {
    conditions.push(eq(scanHistory.status, options.status as any));
  }
  if (options.trackingNumber) {
    conditions.push(like(scanHistory.trackingNumber, `%${options.trackingNumber}%`));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(scanHistory)
    .where(whereClause);
  
  const scans = await db.select()
    .from(scanHistory)
    .where(whereClause)
    .orderBy(desc(scanHistory.scannedAt))
    .limit(options.limit || 100)
    .offset(options.offset || 0);
  
  return { scans, total: totalResult?.count || 0 };
}

export async function getScanStatistics(startDate: Date, endDate: Date): Promise<{
  totalScans: number;
  successScans: number;
  errorScans: number;
  byType: { type: string; count: number }[];
  byUser: { userId: number; userName: string; count: number }[];
  byHour: { hour: number; count: number }[];
}> {
  const db = await getDb();
  if (!db) return { totalScans: 0, successScans: 0, errorScans: 0, byType: [], byUser: [], byHour: [] };
  
  const conditions = [
    gte(scanHistory.scannedAt, startDate),
    lte(scanHistory.scannedAt, endDate)
  ];
  
  // Total counts
  const [totals] = await db.select({
    total: sql<number>`count(*)`,
    success: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
    error: sql<number>`sum(case when status != 'success' then 1 else 0 end)`
  }).from(scanHistory).where(and(...conditions));
  
  // By type
  const byType = await db.select({
    type: scanHistory.scanType,
    count: sql<number>`count(*)`
  }).from(scanHistory)
    .where(and(...conditions))
    .groupBy(scanHistory.scanType);
  
  // By user
  const byUser = await db.select({
    userId: scanHistory.scannedById,
    userName: scanHistory.scannedByName,
    count: sql<number>`count(*)`
  }).from(scanHistory)
    .where(and(...conditions))
    .groupBy(scanHistory.scannedById, scanHistory.scannedByName);
  
  // By hour
  const byHour = await db.select({
    hour: sql<number>`HOUR(scannedAt)`,
    count: sql<number>`count(*)`
  }).from(scanHistory)
    .where(and(...conditions))
    .groupBy(sql`HOUR(scannedAt)`);
  
  return {
    totalScans: totals?.total || 0,
    successScans: totals?.success || 0,
    errorScans: totals?.error || 0,
    byType: byType.map(t => ({ type: t.type, count: t.count })),
    byUser: byUser.map(u => ({ userId: u.userId, userName: u.userName || 'Unknown', count: u.count })),
    byHour: byHour.map(h => ({ hour: h.hour, count: h.count }))
  };
}

export async function getTodayScanSummary(userId?: number): Promise<{
  total: number;
  register: number;
  receive: number;
  ship: number;
  arrive: number;
  deliver: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, register: 0, receive: 0, ship: 0, arrive: 0, deliver: 0, errors: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const conditions = [
    gte(scanHistory.scannedAt, today),
    lt(scanHistory.scannedAt, tomorrow)
  ];
  
  if (userId) {
    conditions.push(eq(scanHistory.scannedById, userId));
  }
  
  const [result] = await db.select({
    total: sql<number>`count(*)`,
    register: sql<number>`sum(case when scanType = 'register' then 1 else 0 end)`,
    receive: sql<number>`sum(case when scanType = 'receive' then 1 else 0 end)`,
    ship: sql<number>`sum(case when scanType = 'ship' then 1 else 0 end)`,
    arrive: sql<number>`sum(case when scanType = 'arrive' then 1 else 0 end)`,
    deliver: sql<number>`sum(case when scanType = 'deliver' then 1 else 0 end)`,
    errors: sql<number>`sum(case when status != 'success' then 1 else 0 end)`
  }).from(scanHistory).where(and(...conditions));
  
  return {
    total: result?.total || 0,
    register: result?.register || 0,
    receive: result?.receive || 0,
    ship: result?.ship || 0,
    arrive: result?.arrive || 0,
    deliver: result?.deliver || 0,
    errors: result?.errors || 0
  };
}



// ============ SCAN REPORTS ============

// Get scans by date range
export async function getScansByDateRange(startDate: Date, endDate: Date, scanType?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    gte(packageScans.scannedAt, startDate),
    lte(packageScans.scannedAt, endDate)
  ];
  
  if (scanType && scanType !== 'all') {
    conditions.push(eq(packageScans.scanType, scanType as any));
  }
  
  return db.select({
    scan: packageScans,
    scannedBy: users
  })
    .from(packageScans)
    .leftJoin(users, eq(packageScans.scannedById, users.id))
    .where(and(...conditions))
    .orderBy(desc(packageScans.scannedAt));
}

// Get scan statistics by date range
export async function getScanStatsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Use raw SQL to avoid GROUP BY issues with MySQL strict mode
  const results = await db.execute(sql`
    SELECT 
      scanType,
      COUNT(*) as count,
      DATE(scannedAt) as date
    FROM packageScans
    WHERE scannedAt >= ${startDate} AND scannedAt <= ${endDate}
    GROUP BY scanType, DATE(scannedAt)
    ORDER BY DATE(scannedAt)
  `);
  
  return ((results[0] as unknown) as any[]).map(row => ({
    scanType: String(row.scanType),
    count: Number(row.count),
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
  }));
}

// Get daily scan summary
export async function getDailyScanSummary(date: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Use raw SQL to avoid GROUP BY issues with MySQL strict mode
  const results = await db.execute(sql`
    SELECT 
      scanType,
      COUNT(*) as count,
      HOUR(scannedAt) as hour
    FROM packageScans
    WHERE scannedAt >= ${startOfDay} AND scannedAt <= ${endOfDay}
    GROUP BY scanType, HOUR(scannedAt)
    ORDER BY HOUR(scannedAt)
  `);
  
  return ((results[0] as unknown) as any[]).map(row => ({
    scanType: row.scanType,
    count: Number(row.count),
    hour: Number(row.hour)
  }));
}

// Get monthly scan summary
export async function getMonthlyScanSummary(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  
  // Use raw SQL to avoid GROUP BY issues with MySQL strict mode
  const results = await db.execute(sql`
    SELECT 
      scanType,
      COUNT(*) as count,
      DAY(scannedAt) as day
    FROM packageScans
    WHERE scannedAt >= ${startOfMonth} AND scannedAt <= ${endOfMonth}
    GROUP BY scanType, DAY(scannedAt)
    ORDER BY DAY(scannedAt)
  `);
  
  return ((results[0] as unknown) as any[]).map(row => ({
    scanType: row.scanType,
    count: Number(row.count),
    day: Number(row.day)
  }));
}

// Get scan totals by type for date range
export async function getScanTotalsByType(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    scanType: packageScans.scanType,
    count: sql<number>`COUNT(*)`
  })
    .from(packageScans)
    .where(and(
      gte(packageScans.scannedAt, startDate),
      lte(packageScans.scannedAt, endDate)
    ))
    .groupBy(packageScans.scanType);
}

// Get scans by employee for date range
export async function getScansByEmployee(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    userId: packageScans.scannedById,
    userName: users.name,
    scanType: packageScans.scanType,
    count: sql<number>`COUNT(*)`
  })
    .from(packageScans)
    .leftJoin(users, eq(packageScans.scannedById, users.id))
    .where(and(
      gte(packageScans.scannedAt, startDate),
      lte(packageScans.scannedAt, endDate)
    ))
    .groupBy(packageScans.scannedById, users.name, packageScans.scanType)
    .orderBy(users.name);
}

// ============ SCAN ANALYTICS (for dashboard) ============

export async function getDailyScanCounts(days: number): Promise<{ date: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`DATE(${packageScans.scannedAt})`.as("date"),
      count: count().as("count"),
    })
    .from(packageScans)
    .where(gte(packageScans.scannedAt, startDate))
    .groupBy(sql`DATE(${packageScans.scannedAt})`)
    .orderBy(asc(sql`DATE(${packageScans.scannedAt})`));

  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export async function getScanCountsByType(days: number): Promise<{ scanType: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const rows = await db
    .select({
      scanType: packageScans.scanType,
      count: count().as("count"),
    })
    .from(packageScans)
    .where(gte(packageScans.scannedAt, startDate))
    .groupBy(packageScans.scanType);

  return rows.map((r) => ({ scanType: String(r.scanType), count: Number(r.count) }));
}

export async function getTopScanners(days: number): Promise<{ userId: number; userName: string | null; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const rows = await db
    .select({
      userId: packageScans.scannedById,
      userName: users.name,
      count: count().as("count"),
    })
    .from(packageScans)
    .leftJoin(users, eq(packageScans.scannedById, users.id))
    .where(gte(packageScans.scannedAt, startDate))
    .groupBy(packageScans.scannedById, users.name)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

  return rows.map((r) => ({
    userId: r.userId,
    userName: r.userName ?? null,
    count: Number(r.count),
  }));
}

