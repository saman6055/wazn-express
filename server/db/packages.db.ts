import { getDb } from './connection';
import { appLogger } from '../utils/logger';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import {
  getFullPackageOrderByTrackingNumber,
  getAllOrdersByTrackingNumber,
  getFullPackageOrderById,
  updateFullPackageOrder,
} from './fullPackage.db';
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
  expenseAlertLogs, InsertExpenseAlertLog, ExpenseAlertLog,
  packageOrderLinks, InsertPackageOrderLink, PackageOrderLink,
  fullPackageOrderTrackings,
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

  // ── Root cause of the "Failed query: insert into packages ..." crash ──
  //
  // Drizzle MySQL's buildInsertQuery iterates EVERY column on the schema
  // and, for any key that's missing from the data object OR whose value
  // is `undefined`, emits the literal SQL keyword `DEFAULT` in the
  // VALUES list. In MySQL with sql_mode=STRICT_TRANS_TABLES (the
  // production default on PlanetScale, RDS, and most managed hosts),
  // `DEFAULT` is rejected for any column that doesn't have an explicit
  // DEFAULT clause — including nullable columns. The packages table
  // has many such columns: trackingNumber, customerId, batchId,
  // claimedAt, claimedById, deliveryType, deliveredAt, deliveredById,
  // recipientName, recipientSignature, deliveryPhoto, notes, etc. Any
  // INSERT where the handler doesn't pass values for all of them
  // crashes on the first `DEFAULT` written for one of these columns.
  //
  // Fix in two layers:
  //
  //  1. Pre-seed every nullable-without-DEFAULT column with `null`. The
  //     spread `{ ...nullableDefaults, ...data }` then lets any value
  //     the handler actually supplied override the null. This guarantees
  //     none of these columns ever fall through to Drizzle's `DEFAULT`.
  //
  //  2. For keys the handler DID pass but with the value `undefined`
  //     (e.g. an optional input that wasn't filled in), map to `null`
  //     too. Drizzle then emits `?` with a NULL binding instead of
  //     `DEFAULT`. NULL is always valid for nullable columns.
  //
  // Columns intentionally absent (id, packageOwnership, isCharged,
  // status, registeredAt, createdAt, updatedAt) all HAVE explicit DB
  // defaults, so Drizzle's `DEFAULT` keyword resolves cleanly for them.
  const nullableDefaults: Partial<InsertPackage> = {
    trackingNumber: null,
    customerId: null,
    batchId: null,
    fullPackageOrderId: null,
    categoryId: null,
    claimedAt: null,
    claimedById: null,
    qrCodeData: null,
    qrCodeSignature: null,
    weightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    volumeCbm: null,
    description: null,
    photos: null,
    calculatedCostUsd: null,
    appliedPricingRuleId: null,
    deliveryType: null,
    deliveredAt: null,
    deliveredById: null,
    recipientName: null,
    recipientSignature: null,
    deliveryPhoto: null,
    notes: null,
  };

  const merged = { ...nullableDefaults, ...data };
  const cleanData = Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, v === undefined ? null : v]),
  ) as InsertPackage;

  try {
    const result = await db.insert(packages).values(cleanData);
    const insertId = Number(result[0].insertId);
    if (!insertId) throw new Error("Failed to insert package");
    const inserted = await db.select().from(packages).where(eq(packages.id, insertId)).limit(1);
    if (!inserted[0]) throw new Error("Failed to retrieve inserted package");
    return inserted[0];
  } catch (err: unknown) {
    // Surface the full structured error to logs so we can diagnose the
    // exact MySQL reason on next deploy if anything else is still wrong.
    // mysql2 attaches code/errno/sqlMessage either directly on the
    // thrown error or on err.cause (depending on Drizzle's wrapper).
    const errObj = (err && typeof err === "object") ? err as Record<string, unknown> : {};
    const cause = (errObj.cause && typeof errObj.cause === "object") ? errObj.cause as Record<string, unknown> : {};
    appLogger.error("[createPackage] DB insert failed", {
      code: errObj.code ?? cause.code,
      errno: errObj.errno ?? cause.errno,
      sqlMessage: errObj.sqlMessage ?? cause.sqlMessage,
      sqlState: errObj.sqlState ?? cause.sqlState,
      message: typeof errObj.message === "string" ? errObj.message.slice(0, 1500) : "",
      keysProvided: Object.keys(cleanData),
    });
    throw err;
  }
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

export async function getPackageByTrackingNumber(trackingNumber: string): Promise<Package | undefined> {
  if (!trackingNumber?.trim()) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packages).where(eq(packages.trackingNumber, trackingNumber.trim())).limit(1);
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
    const searchTerm = `%${search.trim()}%`;

    // Find customer IDs matching the search term
    const matchingCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(or(
        like(customers.fullName, searchTerm),
        like(customers.customerCode, searchTerm),
        like(customers.mobileNumber, searchTerm),
      ));
    const matchingCustomerIds = matchingCustomers.map(c => c.id);

    const orConditions: any[] = [
      like(packages.trackingNumber, searchTerm),
      like(packages.packageCode, searchTerm),
      like(packages.description, searchTerm),
    ];
    if (matchingCustomerIds.length > 0) {
      orConditions.push(inArray(packages.customerId, matchingCustomerIds));
    }
    conditions.push(or(...orConditions));
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

/**
 * Resolve every full-package order linked to a package via:
 *   1. The new packageOrderLinks join table (canonical from Phase 4 onward)
 *   2. Shared-tracking siblings discovered via fullPackageOrderTrackings
 *      and the legacy packages.fullPackageOrderId FK.
 *
 * Used by updatePackage / updatePackageFields to fan batchId and status
 * changes across every linked order, not just the first one. Returns a
 * deduped list of full FullPackageOrder rows.
 */
async function resolveLinkedOrdersForPackage(pkg: Package | undefined) {
  if (!pkg) return [] as Awaited<ReturnType<typeof getFullPackageOrderByTrackingNumber>>[];
  const ids = new Set<number>();
  const links = await getPackageOrderLinks(pkg.id);
  for (const l of links) ids.add(l.fullPackageOrderId);
  if (pkg.trackingNumber) {
    const shared = await getAllOrdersByTrackingNumber(pkg.trackingNumber);
    for (const o of shared) ids.add(o.id);
    if (ids.size === 0) {
      const legacy = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
      if (legacy) ids.add(legacy.id);
    }
  }
  if (pkg.fullPackageOrderId) ids.add(pkg.fullPackageOrderId);
  if (ids.size === 0) return [];
  const out: Awaited<ReturnType<typeof getFullPackageOrderByTrackingNumber>>[] = [];
  for (const oid of Array.from(ids)) {
    const o = await getFullPackageOrderById(oid);
    if (o) out.push(o);
  }
  return out;
}

export async function updatePackage(id: number, data: Partial<InsertPackage>) {
  const db = await getDb();
  if (!db) return;

  // Get package before update to check tracking number / linkage
  const pkg = await getPackageById(id);

  await db.update(packages).set(data).where(eq(packages.id, id));

  // Resolve every order this package is linked to (multi-link aware).
  const linkedOrders = (data.batchId !== undefined || data.status)
    ? await resolveLinkedOrdersForPackage(pkg)
    : [];

  // Sync batchId to ALL linked orders when package is added to / removed
  // from a batch. Pre-Phase-5 this only synced the first match, which left
  // shared-tracking siblings stranded outside the batch.
  if (data.batchId !== undefined && linkedOrders.length > 0) {
    try {
      for (const o of linkedOrders) {
        await updateFullPackageOrder(o!.id, { batchId: data.batchId });
      }
      appLogger.info("[FullPackage] Synced batchId from package to all linked orders", {
        batchId: data.batchId,
        packageCode: pkg?.packageCode,
        orderCount: linkedOrders.length,
        orderIds: linkedOrders.map((o) => o!.id),
      });
    } catch (e) {
      appLogger.error('[FullPackage] Failed to sync batchId to linked orders', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Sync status to every linked order. Notification + shipping-cost write
  // also fan out, but careful: setting shippingCostUsd from THIS package's
  // calculatedCostUsd is only correct when the package belongs to a single
  // order (not shared). For shared trackings, the proper per-order share
  // is computed by splitShippingCost during batch delivery — we skip the
  // shippingCostUsd write in that case and let delivery handle it.
  if (data.status && linkedOrders.length > 0) {
    try {
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
      if (!newStatus) return;

      const isSharedAcrossOrders = linkedOrders.length > 1;
      const shippingCost = data.status === 'delivered'
        ? parseFloat(data.calculatedCostUsd || pkg?.calculatedCostUsd || '0')
        : 0;

      for (const order of linkedOrders) {
        if (!order) continue;
        if (newStatus === order.status) continue;

        const updateData: Record<string, unknown> = { status: newStatus };

        // Only assign shipping cost on single-order packages here. For
        // shared trackings, leave it to splitShippingCost / delivery flow.
        if (data.status === 'delivered' && shippingCost > 0 && !isSharedAcrossOrders) {
          updateData.shippingCostUsd = shippingCost.toFixed(2);
          appLogger.info("[FullPackage] Updating order with shipping cost", { orderId: order.id, shippingCost });

          // Notify customer about shipping cost
          try {
            await createCustomerNotification({
              customerId: order.customerId,
              type: 'package',
              title: 'Package Delivered',
              titleKu: 'پاکەت گەیشت',
              titleAr: 'تم تسليم الطرد',
              message: `Your order ${order.orderCode} (${order.productName}) has been delivered. Shipping cost: $${shippingCost}`,
              messageKu: `سفارشەکەت ${order.orderCode} (${order.productName}) گەیشت. کۆستی هێنانەوە: $${shippingCost}`,
              messageAr: `تم تسليم طلبك ${order.orderCode} (${order.productName}). تكلفة الشحن: $${shippingCost}`,
              relatedType: 'full_package',
              relatedId: order.id,
            });
            appLogger.info("[Notification] Sent shipping cost notification to customer", { customerId: order.customerId });
          } catch (e) {
            appLogger.error('[Notification] Failed to send shipping cost notification', { error: e instanceof Error ? e.message : String(e) });
          }
        }

        await updateFullPackageOrder(order.id, updateData);
        appLogger.info("[FullPackage] Synced status from package to order", {
          packageCode: pkg?.packageCode, orderId: order.id, newStatus,
        });
      }
    } catch (e) {
      appLogger.error('[FullPackage] Failed to sync status to linked orders', { error: e instanceof Error ? e.message : String(e) });
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

// ============ PACKAGE ↔ ORDER LINKS ============
// Multi-link layer: a single package can carry items from multiple full-package
// orders (shared tracking), and a single order can be split across multiple
// packages (multi-tracking). The legacy packages.fullPackageOrderId column
// remains as the "primary" link; this layer captures every other linkage.

/** All order links for a given package, ordered by primary first then cartonIndex. */
export async function getPackageOrderLinks(packageId: number): Promise<PackageOrderLink[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageOrderLinks)
    .where(eq(packageOrderLinks.packageId, packageId))
    .orderBy(desc(packageOrderLinks.isPrimary), asc(packageOrderLinks.cartonIndex), asc(packageOrderLinks.id));
}

/** All packages that link back to a given order (sorted by cartonIndex). */
export async function getPackagesByOrderId(orderId: number): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  const linkRows = await db.select({ packageId: packageOrderLinks.packageId, cartonIndex: packageOrderLinks.cartonIndex })
    .from(packageOrderLinks)
    .where(eq(packageOrderLinks.fullPackageOrderId, orderId))
    .orderBy(asc(packageOrderLinks.cartonIndex));
  if (linkRows.length === 0) return [];
  const ids = linkRows.map(r => r.packageId);
  const pkgs = await db.select().from(packages).where(inArray(packages.id, ids));
  // Preserve cartonIndex order from linkRows
  const byId = new Map(pkgs.map(p => [p.id, p]));
  return linkRows.map(r => byId.get(r.packageId)).filter((p): p is Package => Boolean(p));
}

/** Bulk lookup: which of these tracking numbers already have a registered package? */
export async function getPackagesByTrackingNumbers(trackingNumbers: string[]): Promise<Package[]> {
  const db = await getDb();
  if (!db || trackingNumbers.length === 0) return [];
  const trimmed = Array.from(new Set(trackingNumbers.map(t => t.trim()).filter(Boolean)));
  if (trimmed.length === 0) return [];
  return db.select().from(packages).where(inArray(packages.trackingNumber, trimmed));
}

/**
 * Insert a batch of package↔order links atomically.
 * - All inserts use INSERT IGNORE semantics via individual try/catch on the
 *   uniq_pol_pkg_order key, so re-running this with the same input is a no-op.
 * - Caller is responsible for the single-customer business rule (validated
 *   in packages.register / addOrderTrackings, NOT here).
 */
export async function createPackageOrderLinks(
  packageId: number,
  links: Array<{ fullPackageOrderId: number; cartonIndex?: number; isPrimary?: boolean }>
): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db || links.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0;
  let skipped = 0;
  for (const link of links) {
    try {
      await db.insert(packageOrderLinks).values({
        packageId,
        fullPackageOrderId: link.fullPackageOrderId,
        cartonIndex: link.cartonIndex ?? 1,
        isPrimary: link.isPrimary ?? false,
      });
      inserted++;
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
      const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : "";
      if (code === "ER_DUP_ENTRY" || /duplicate|unique/i.test(msg)) {
        skipped++;
      } else {
        throw err;
      }
    }
  }
  return { inserted, skipped };
}

/** Remove a single link (used when staff fixes a wrong association). */
export async function deletePackageOrderLink(packageId: number, fullPackageOrderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(packageOrderLinks)
    .where(and(
      eq(packageOrderLinks.packageId, packageId),
      eq(packageOrderLinks.fullPackageOrderId, fullPackageOrderId),
    ));
  return true;
}

/**
 * Compute carton-level reception state for an order.
 *
 * Returns counts and the per-tracking detail used by status promotion and
 * by the pre-delivery audit report. "Fully received" = every tracking
 * number this order owns (multi-tracking table + legacy single-tracking
 * field) has at least one corresponding package row.
 */
export async function getOrderCartonStatus(orderId: number): Promise<{
  total: number;
  registered: number;
  pending: string[];   // tracking numbers waiting for a package
  registeredTrackings: string[]; // tracking numbers with a package row
}> {
  const db = await getDb();
  if (!db) return { total: 0, registered: 0, pending: [], registeredTrackings: [] };

  // Collect every tracking owned by this order (multi-tracking table + legacy field).
  const order = await getFullPackageOrderById(orderId);
  if (!order) return { total: 0, registered: 0, pending: [], registeredTrackings: [] };

  const trackingsRows = await db.select().from(fullPackageOrderTrackings)
    .where(eq(fullPackageOrderTrackings.fullPackageOrderId, orderId));
  const all = new Set<string>();
  for (const r of trackingsRows) {
    if (r.trackingNumber) all.add(r.trackingNumber.trim());
  }
  if (order.trackingNumber) all.add(order.trackingNumber.trim());
  const allList = Array.from(all).filter(Boolean);
  if (allList.length === 0) {
    return { total: 0, registered: 0, pending: [], registeredTrackings: [] };
  }

  // Which of those already have a registered package?
  const existing = await db.select({ tn: packages.trackingNumber })
    .from(packages)
    .where(inArray(packages.trackingNumber, allList));
  const registered = new Set<string>();
  for (const r of existing) {
    if (r.tn) registered.add(r.tn.trim());
  }

  return {
    total: allList.length,
    registered: registered.size,
    pending: allList.filter((t) => !registered.has(t)),
    registeredTrackings: Array.from(registered),
  };
}

/**
 * If every carton this order expects has now been registered as a package,
 * advance the order's status to `in_china_warehouse` — but only when the
 * order is currently in an early state (`ordered` / `tracking_added` /
 * `approved` / `pending`). Other states (delivered, cancelled, in_batch,
 * etc.) are explicitly left alone so this never overwrites a later state.
 *
 * Idempotent: returns `{ promoted: false }` if nothing to do.
 *
 * Use case: called after every package register so multi-tracking orders
 * advance automatically as their last carton arrives, with no manual step.
 */
export async function promoteOrderStatusIfFullyReceived(orderId: number): Promise<{
  promoted: boolean;
  oldStatus: string | null;
  newStatus: string | null;
  cartonsRegistered: number;
  cartonsTotal: number;
}> {
  const order = await getFullPackageOrderById(orderId);
  if (!order) return { promoted: false, oldStatus: null, newStatus: null, cartonsRegistered: 0, cartonsTotal: 0 };

  const PROMOTABLE_FROM = new Set(['pending', 'approved', 'ordered', 'tracking_added']);
  if (!PROMOTABLE_FROM.has(order.status)) {
    // Don't downgrade or overwrite later states.
    return { promoted: false, oldStatus: order.status, newStatus: null, cartonsRegistered: 0, cartonsTotal: 0 };
  }

  const cartons = await getOrderCartonStatus(orderId);
  if (cartons.total === 0 || cartons.registered < cartons.total) {
    return {
      promoted: false,
      oldStatus: order.status,
      newStatus: null,
      cartonsRegistered: cartons.registered,
      cartonsTotal: cartons.total,
    };
  }

  await updateFullPackageOrder(orderId, { status: 'in_china_warehouse' });
  appLogger.info("[FullPackage] Promoted to in_china_warehouse — all cartons received", {
    orderId,
    orderCode: order.orderCode,
    cartons: `${cartons.registered}/${cartons.total}`,
    from: order.status,
  });
  return {
    promoted: true,
    oldStatus: order.status,
    newStatus: 'in_china_warehouse',
    cartonsRegistered: cartons.registered,
    cartonsTotal: cartons.total,
  };
}

/**
 * One-shot, idempotent backfill: for every package that already has
 * packages.fullPackageOrderId set, ensure a corresponding row exists in
 * packageOrderLinks marked isPrimary=TRUE. Safe to run on every startup —
 * uniq_pol_pkg_order silently rejects duplicates and we count them.
 *
 * What this DOES NOT do (deliberate):
 *   - Does not chase shared-tracking siblings for legacy packages. That kind
 *     of fan-out could re-touch already-delivered orders and disturb finance
 *     state. The new register flow (Phase 4) creates those links going
 *     forward; legacy data is left alone unless an operator explicitly fixes
 *     it from the UI later.
 */
export async function backfillPackageOrderLinks(): Promise<{
  totalCandidates: number;
  inserted: number;
  alreadyLinked: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { totalCandidates: 0, inserted: 0, alreadyLinked: 0, errors: 0 };

  const candidates = await db.select({ id: packages.id, fullPackageOrderId: packages.fullPackageOrderId })
    .from(packages)
    .where(isNotNull(packages.fullPackageOrderId));

  let inserted = 0;
  let alreadyLinked = 0;
  let errors = 0;

  for (const c of candidates) {
    if (!c.fullPackageOrderId) continue;
    try {
      await db.insert(packageOrderLinks).values({
        packageId: c.id,
        fullPackageOrderId: c.fullPackageOrderId,
        cartonIndex: 1,
        isPrimary: true,
      });
      inserted++;
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : "";
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
      if (code === "ER_DUP_ENTRY" || /duplicate|unique/i.test(msg)) {
        alreadyLinked++;
      } else {
        errors++;
        appLogger.warn("[Backfill] packageOrderLinks insert failed", {
          packageId: c.id, orderId: c.fullPackageOrderId, error: msg,
        });
      }
    }
  }

  return { totalCandidates: candidates.length, inserted, alreadyLinked, errors };
}

