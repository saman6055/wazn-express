import { getDb } from './connection';
import { appLogger } from '../utils/logger';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { getFullPackageOrderByTrackingNumber, updateFullPackageOrder } from './fullPackage.db';
import { createCustomerNotification } from './portal.db';
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

// ============ PACKAGE OPERATIONS ============

export async function createPackage(data: InsertPackage): Promise<Package> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Auto-link to full package order if tracking number matches
  if (data.trackingNumber && !data.fullPackageOrderId) {
    const matchingOrder = await db.select({ id: fullPackageOrders.id, orderType: fullPackageOrders.orderType, customerId: fullPackageOrders.customerId })
      .from(fullPackageOrders)
      .where(eq(fullPackageOrders.trackingNumber, data.trackingNumber))
      .limit(1);
    
    if (matchingOrder.length > 0) {
      data.fullPackageOrderId = matchingOrder[0].id;
      // Also set the customer from the order if not already set
      if (!data.customerId && matchingOrder[0].customerId) {
        data.customerId = matchingOrder[0].customerId;
      }
    }
  }
  
  const result = await db.insert(packages).values(data);
  const inserted = await db.select().from(packages).where(eq(packages.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getPackageById(id: number): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return result[0];
}

export async function getPackageByCode(packageCode: string): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packages).where(eq(packages.packageCode, packageCode)).limit(1);
  return result[0];
}

const DEFAULT_PAGE_SIZE = 50;

export async function getAllPackages(options: {
  page?: number;
  pageSize?: number;
  cursor?: number;
  search?: string;
  status?: string;
  shippingType?: string;
  batchId?: number;
  customerId?: number;
  dateFrom?: Date;
  dateTo?: Date;
} = {}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0, nextCursor: undefined as number | undefined };
  
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, cursor, search, status, shippingType, batchId, customerId, dateFrom, dateTo } = options;
  const offset = (page - 1) * pageSize;
  
  // Build where conditions
  const conditions = [];
  
  if (search) {
    conditions.push(
      or(
        like(packages.trackingNumber, `%${search}%`),
        like(packages.packageCode, `%${search}%`)
      )
    );
  }
  
  if (status && status !== 'all') {
    conditions.push(eq(packages.status, status as any));
  }
  
  if (shippingType && shippingType !== 'all') {
    conditions.push(eq(packages.shippingType, shippingType as 'air_regular' | 'air_irregular' | 'sea'));
  }
  
  if (batchId) {
    conditions.push(eq(packages.batchId, batchId));
  }
  
  if (customerId) {
    conditions.push(eq(packages.customerId, customerId));
  }
  
  if (dateFrom) {
    conditions.push(gte(packages.createdAt, dateFrom));
  }
  
  if (dateTo) {
    conditions.push(lte(packages.createdAt, dateTo));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const dataConditions = [...conditions];
  if (cursor != null) {
    dataConditions.push(lt(packages.id, cursor));
  }
  const dataWhereClause = dataConditions.length > 0 ? and(...dataConditions) : undefined;
  
  // Get total count (full set, not filtered by cursor)
  const countResult = await db.select({ count: count() }).from(packages).where(whereClause);
  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);
  
  // Get paginated data (explicit columns only)
  const data = await db.select({
    id: packages.id,
    packageCode: packages.packageCode,
    trackingNumber: packages.trackingNumber,
    customerId: packages.customerId,
    originWarehouseId: packages.originWarehouseId,
    batchId: packages.batchId,
    fullPackageOrderId: packages.fullPackageOrderId,
    packageOwnership: packages.packageOwnership,
    categoryId: packages.categoryId,
    isUnclaimed: packages.isUnclaimed,
    weightKg: packages.weightKg,
    lengthCm: packages.lengthCm,
    widthCm: packages.widthCm,
    heightCm: packages.heightCm,
    volumeCbm: packages.volumeCbm,
    shippingType: packages.shippingType,
    description: packages.description,
    photos: packages.photos,
    calculatedCostUsd: packages.calculatedCostUsd,
    status: packages.status,
    createdAt: packages.createdAt,
    updatedAt: packages.updatedAt,
    // Full package order type for display
    orderType: fullPackageOrders.orderType,
  })
    .from(packages)
    .leftJoin(fullPackageOrders, eq(packages.fullPackageOrderId, fullPackageOrders.id))
    .where(dataWhereClause)
    .orderBy(desc(packages.id))
    .limit(pageSize)
    .offset(cursor != null ? 0 : offset);
  
  const nextCursor = cursor != null && data.length === pageSize && data.length > 0 ? (data[data.length - 1] as { id: number }).id : undefined;
  return { data, total, page, pageSize, totalPages, nextCursor };
}

export async function getPackagesStats() {
  const db = await getDb();
  if (!db) return {
    total: 0,
    unclaimed: 0,
    inTransit: 0,
    delivered: 0,
    registered: 0,
    todayCount: 0,
    byStatus: [] as { status: string; count: number }[],
    byShippingType: [] as { shippingType: string; count: number }[]
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Total packages
  const totalResult = await db.select({ count: count() }).from(packages);
  const total = totalResult[0]?.count || 0;

  // Unclaimed packages
  const unclaimedResult = await db.select({ count: count() }).from(packages).where(eq(packages.isUnclaimed, true));
  const unclaimed = unclaimedResult[0]?.count || 0;

  // In transit packages
  const inTransitResult = await db.select({ count: count() }).from(packages).where(eq(packages.status, 'in_transit'));
  const inTransit = inTransitResult[0]?.count || 0;

  // Delivered packages
  const deliveredResult = await db.select({ count: count() }).from(packages).where(eq(packages.status, 'delivered'));
  const delivered = deliveredResult[0]?.count || 0;

  // Registered packages
  const registeredResult = await db.select({ count: count() }).from(packages).where(eq(packages.status, 'registered'));
  const registered = registeredResult[0]?.count || 0;

  // Today's packages
  const todayResult = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, today));
  const todayCount = todayResult[0]?.count || 0;

  // By status
  const byStatusResult = await db.select({
    status: packages.status,
    count: count()
  }).from(packages).groupBy(packages.status);
  const byStatus = byStatusResult.map(r => ({ status: r.status, count: Number(r.count) }));

  // By shipping type
  const byShippingTypeResult = await db.select({
    shippingType: packages.shippingType,
    count: count()
  }).from(packages).groupBy(packages.shippingType);
  const byShippingType = byShippingTypeResult.map(r => ({ shippingType: r.shippingType, count: Number(r.count) }));

  return {
    total: Number(total),
    unclaimed: Number(unclaimed),
    inTransit: Number(inTransit),
    delivered: Number(delivered),
    registered: Number(registered),
    todayCount: Number(todayCount),
    byStatus,
    byShippingType
  };
}

export async function getRecentPackages(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packages).orderBy(desc(packages.createdAt)).limit(limit);
}

export async function getPackagesByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packages).where(eq(packages.customerId, customerId)).orderBy(desc(packages.createdAt));
}

export async function getPackagesByBatch(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packages).where(eq(packages.batchId, batchId)).orderBy(desc(packages.createdAt));
}

export async function updatePackage(id: number, data: Partial<InsertPackage>) {
  const db = await getDb();
  if (!db) return;
  
  // Get package before update to check tracking number
  const pkg = await getPackageById(id);
  
  await db.update(packages).set(data).where(eq(packages.id, id));
  
  // Sync batchId to fullPackageOrder when package is added to/removed from a batch
  if (data.batchId !== undefined && pkg?.trackingNumber) {
    try {
      const fullPackageOrder = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
      if (fullPackageOrder) {
        await updateFullPackageOrder(fullPackageOrder.id, { batchId: data.batchId });
        appLogger.info("[FullPackage] Synced batchId from package to order", { batchId: data.batchId, packageCode: pkg.packageCode, orderId: fullPackageOrder.id });
      }
    } catch (e) {
      appLogger.error('[FullPackage] Failed to sync batchId to fullPackageOrder', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Sync status to fullPackageOrder if status changed and package has tracking number
  if (data.status && pkg?.trackingNumber) {
    try {
      const fullPackageOrder = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
      if (fullPackageOrder) {
        // Map package status to fullPackageOrder status
        const statusMap: Record<string, string> = {
          'registered': 'ordered',
          'in_batch': 'in_transit',
          'in_transit': 'in_transit',
          'customs_processing': 'in_transit',
          'ready_for_delivery': 'arrived',
          'out_for_delivery': 'arrived',
          'delivered': 'delivered',
          'returned': 'ordered',
          'cancelled': 'cancelled'
        };
        
        const newStatus = statusMap[data.status];
        if (newStatus && newStatus !== fullPackageOrder.status) {
          const updateData: Record<string, unknown> = { status: newStatus };
          
          // If delivered, update shipping cost and recalculate profit
          if (data.status === 'delivered' && (data.calculatedCostUsd || pkg.calculatedCostUsd)) {
            const shippingCost = parseFloat(data.calculatedCostUsd || pkg.calculatedCostUsd || '0');
            updateData.shippingCostUsd = shippingCost.toFixed(2);
            appLogger.info("[FullPackage] Updating order with shipping cost", { orderId: fullPackageOrder.id, shippingCost });
            
            // Notify customer about shipping cost
            try {
              await createCustomerNotification({
                customerId: fullPackageOrder.customerId,
                type: 'package',
                title: 'Package Delivered',
                titleKu: 'پاکەت گەیشت',
                titleAr: 'تم تسليم الطرد',
                message: `Your order ${fullPackageOrder.orderCode} (${fullPackageOrder.productName}) has been delivered. Shipping cost: $${shippingCost}`,
                messageKu: `سفارشەکەت ${fullPackageOrder.orderCode} (${fullPackageOrder.productName}) گەیشت. کۆستی هێنانەوە: $${shippingCost}`,
                messageAr: `تم تسليم طلبك ${fullPackageOrder.orderCode} (${fullPackageOrder.productName}). تكلفة الشحن: $${shippingCost}`,
                relatedType: 'full_package',
                relatedId: fullPackageOrder.id,
              });
              appLogger.info("[Notification] Sent shipping cost notification to customer", { customerId: fullPackageOrder.customerId });
            } catch (e) {
              appLogger.error('[Notification] Failed to send shipping cost notification', { error: e instanceof Error ? e.message : String(e) });
            }
          }
          
          await updateFullPackageOrder(fullPackageOrder.id, updateData);
          appLogger.info("[FullPackage] Synced status from package to order", { packageCode: pkg.packageCode, orderId: fullPackageOrder.id, newStatus });
        }
      }
    } catch (e) {
      appLogger.error('[FullPackage] Failed to sync status to fullPackageOrder', { error: e instanceof Error ? e.message : String(e) });
    }
  }
}

export async function deletePackage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(packages).where(eq(packages.id, id));
}

export async function getPackagesByStatus(status: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packages).where(eq(packages.status, status as any)).orderBy(desc(packages.createdAt));
}

export async function getNextPackageCode(prefix: string): Promise<string> {
  const db = await getDb();
  if (!db) return `${prefix}001`;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(packages).where(like(packages.packageCode, `${prefix}%`));
  const count = (result[0]?.count || 0) + 1;
  return `${prefix}${count.toString().padStart(6, '0')}`;
}


// ============ UNCLAIMED PACKAGES ============

export async function getNextUnclaimedPackageCode(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the highest UNC code
  const result = await db.select({ packageCode: packages.packageCode })
    .from(packages)
    .where(like(packages.packageCode, 'UNC-%'))
    .orderBy(desc(packages.id))
    .limit(1);
  
  let nextNum = 1;
  if (result.length > 0 && result[0].packageCode) {
    const match = result[0].packageCode.match(/UNC-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }
  
  return `UNC-${nextNum.toString().padStart(6, '0')}`;
}

export async function getUnclaimedPackages(): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(packages)
    .where(eq(packages.isUnclaimed, true))
    .orderBy(desc(packages.createdAt));
}

export async function claimPackage(
  packageId: number, 
  customerId: number, 
  claimedById: number
): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(packages)
    .set({
      customerId,
      isUnclaimed: false,
      claimedAt: new Date(),
      claimedById,
    })
    .where(eq(packages.id, packageId));
  
  const [updated] = await db.select().from(packages).where(eq(packages.id, packageId));
  return updated;
}

export async function getUnclaimedPackageCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(packages)
    .where(eq(packages.isUnclaimed, true));
  
  return result[0]?.count || 0;
}

