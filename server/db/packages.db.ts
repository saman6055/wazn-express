import { getDb } from './connection';
import { appLogger } from '../utils/logger';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import {
  getFullPackageOrderByTrackingNumber,
  getAllOrdersByTrackingNumber,
  getFullPackageOrderById,
  updateFullPackageOrder,
  getOrderTrackings,
} from './fullPackage.db';
import fs from 'fs';
import {
  classifyBacklinkCandidate,
  isTerminalOrderStatus,
  type BacklinkConflictReason,
} from '../lib/orderBacklink';
import { prunePhotoList } from '../lib/photoUrls';
import { isDuplicateKeyError, dbErrorReason } from '../lib/dbErrors';
import {
  assessVolumetric,
  DEFAULT_VOLUMETRIC_THRESHOLDS,
  VOLUMETRIC_SETTING_KEYS,
  type VolumetricThresholds,
  type VolumetricAssessment,
} from '@shared/volumetricAlert';
import { getSetting } from './settings.db';
import { createActivityAlert } from './admin.db';
import { getUploadsDir } from '../services/localUpload';
import { createCustomerNotification } from './portal.db';
import { findActiveDeclaredByTracking, markDeclaredMatched } from './declaredPackages.db';
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
  customerDeclaredPackages,
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

  // Portal pre-declaration: if the package is still unowned, adopt the
  // customer who pre-declared this tracking from the portal — so a package
  // they told us about in advance never lands as "unclaimed".
  if (data.trackingNumber && !data.customerId) {
    try {
      const declared = await findActiveDeclaredByTracking(data.trackingNumber);
      if (declared?.declared?.customerId) {
        data.customerId = declared.declared.customerId;
        data.isUnclaimed = false;
      }
    } catch { /* best-effort — never block registration */ }
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
    // Best-effort: mark any matching portal pre-declaration as fulfilled so
    // the customer's portal list flips to "arrived".
    if (cleanData.trackingNumber) {
      try { await markDeclaredMatched(cleanData.trackingNumber as string, insertId); } catch { /* non-fatal */ }
    }
    // Notify the owner their package is now registered (best-effort).
    if (inserted[0].customerId && !inserted[0].isUnclaimed) {
      try {
        const p = inserted[0];
        const c = p.trackingNumber || p.packageCode || `#${p.id}`;
        await createCustomerNotification({
          customerId: p.customerId!, type: "package", relatedType: "package", relatedId: p.id,
          actionUrl: `/portal/search?q=${encodeURIComponent(c)}`,
          title: "Package registered", titleKu: "پاکەت تۆمار کرا", titleAr: "تم تسجيل الطرد",
          message: `Your package ${c} has been registered.`,
          messageKu: `پاکەتەکەت ${c} تۆمار کرا.`,
          messageAr: `تم تسجيل طردك ${c}.`,
        });
      } catch { /* non-fatal */ }
    }
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
    // Who registered it and exactly when — the registrations view answers
    // "who entered this and at what time", which createdAt alone can't.
    registeredAt: packages.registeredAt,
    registeredById: packages.registeredById,
    registeredByName: users.name,
    // Full package order type for display
    orderType: fullPackageOrders.orderType,
  })
    .from(packages)
    .leftJoin(fullPackageOrders, eq(packages.fullPackageOrderId, fullPackageOrders.id))
    .leftJoin(users, eq(packages.registeredById, users.id))
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

  // ── Customer notifications for important package lifecycle events ──
  // Best-effort, only for owned (non-unclaimed) packages, fired on ACTUAL
  // changes, so each customer's notification centre gets a clean per-code
  // feed: batch add/remove + every meaningful movement. Never blocks the
  // update. `in_batch` status is intentionally left to the batch-add branch
  // so a single scan doesn't double-notify.
  if (pkg && pkg.customerId && !pkg.isUnclaimed) {
    const code = pkg.trackingNumber || pkg.packageCode || `#${pkg.id}`;
    const trackUrl = `/portal/search?q=${encodeURIComponent(code)}`;
    try {
      if (data.batchId !== undefined && (data.batchId ?? null) !== (pkg.batchId ?? null)) {
        if (data.batchId) {
          const [b] = await db.select({ code: batches.batchCode }).from(batches).where(eq(batches.id, data.batchId)).limit(1);
          const bc = b?.code || "";
          await createCustomerNotification({
            customerId: pkg.customerId, type: "package", relatedType: "package", relatedId: pkg.id, actionUrl: "/portal/shipments",
            title: `Added to shipment ${bc}`.trim(), titleKu: `خرایە ناو بارەکەی ${bc}`.trim(), titleAr: `أُضيف إلى الشحنة ${bc}`.trim(),
            message: `Your package ${code} was added to shipment ${bc}.`,
            messageKu: `پاکەتەکەت ${code} خرایە ناو بارەکەی ${bc}.`,
            messageAr: `تمت إضافة طردك ${code} إلى الشحنة ${bc}.`,
          });
        } else {
          await createCustomerNotification({
            customerId: pkg.customerId, type: "warning", relatedType: "package", relatedId: pkg.id, actionUrl: trackUrl,
            title: "Removed from shipment", titleKu: "لە بارەکە لابرا", titleAr: "أُزيل من الشحنة",
            message: `Your package ${code} was removed from its shipment.`,
            messageKu: `پاکەتەکەت ${code} لە بارەکە لابرا.`,
            messageAr: `تمت إزالة طردك ${code} من الشحنة.`,
          });
        }
      }

      if (data.status && data.status !== pkg.status) {
        // Chinese was absent here, so a customer who chose 中文 got these in
        // English — and `cancelled` was absent altogether, which is the one
        // movement a customer most needs to be told about.
        const L: Record<string, { en: string; ku: string; ar: string; zh: string; ok?: boolean }> = {
          received_china:     { en: "Arrived at China warehouse",  ku: "گەیشتە کۆگای چین",     ar: "وصل إلى مستودع الصين",     zh: "已到达中国仓库" },
          in_transit:         { en: "In transit",                  ku: "لە ڕێگادایە",          ar: "قيد الشحن",                zh: "运输中" },
          customs_processing: { en: "In customs",                  ku: "لە گومرگە",            ar: "في الجمارك",               zh: "清关中" },
          received_local:     { en: "Arrived at local warehouse",  ku: "گەیشتە کۆگای ناوخۆ",    ar: "وصل إلى المستودع المحلي", zh: "已到达本地仓库" },
          ready_for_delivery: { en: "Ready for delivery",          ku: "ئامادەیە بۆ گەیاندن",   ar: "جاهز للتسليم",            zh: "待派送" },
          out_for_delivery:   { en: "Out for delivery",            ku: "لە ڕێی گەیاندنە",       ar: "خرج للتسليم",             zh: "派送中" },
          delivered:          { en: "Delivered",                   ku: "گەیێنرا",              ar: "تم التسليم",               zh: "已送达", ok: true },
          returned:           { en: "Returned",                    ku: "گەڕێندرایەوە",         ar: "تم الإرجاع",               zh: "已退回" },
          cancelled:          { en: "Cancelled",                   ku: "هەڵوەشێنرایەوە",       ar: "تم الإلغاء",               zh: "已取消" },
        };
        const m = L[data.status as string];
        if (m) {
          await createCustomerNotification({
            customerId: pkg.customerId, type: m.ok ? "success" : "package", relatedType: "package", relatedId: pkg.id, actionUrl: trackUrl,
            title: m.en, titleKu: m.ku, titleAr: m.ar, titleZh: m.zh,
            message: `Package ${code}: ${m.en}.`,
            messageKu: `پاکەتی ${code}: ${m.ku}.`,
            messageAr: `الطرد ${code}: ${m.ar}.`,
            messageZh: `包裹 ${code}：${m.zh}。`,
          });
        }
      }
    } catch (e) {
      appLogger.error("[Notifications] package-event notify failed", { error: e instanceof Error ? e.message : String(e), packageId: id });
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

  // Gap-safe code generator.
  //
  // Previous impl used `COUNT(*) WHERE packageCode LIKE 'prefix%'` + 1.
  // That is wrong whenever any row in the sequence has been deleted:
  // with N rows remaining, COUNT+1 = N+1, but suffix N+1 was already
  // assigned to an earlier (still-existing) row, so the INSERT crashes
  // with ER_DUP_ENTRY on packageCode. The retry loop in
  // packages.router.ts re-calls this function on duplicate errors, but
  // COUNT-based logic deterministically returns the SAME duplicate code
  // every retry, so the loop spins until it gives up — surfacing the
  // duplicate as a hard error to the user. (Production symptom: every
  // claimed-package register failed with "Duplicate entry 'EB000016'
  // for key 'packages.packageCode'" while unclaimed packages worked
  // because getNextUnclaimedPackageCode uses MAX-based logic.)
  //
  // Fix: pick the next number from MAX(numeric_suffix) + 1. Gap-safe
  // and idempotent across deletes. MySQL CAST('000016' AS UNSIGNED)
  // returns 16; CAST on a non-numeric suffix returns 0, so unrelated
  // formats are silently ignored. COALESCE handles the empty-table
  // case (no rows yet → start at 1).
  const prefixLen = prefix.length + 1; // SUBSTRING is 1-indexed in MySQL
  const result = await db
    .select({
      maxSuffix: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${packages.packageCode}, ${prefixLen}) AS UNSIGNED)), 0)`,
    })
    .from(packages)
    .where(like(packages.packageCode, `${prefix}%`));

  const nextNum = Number(result[0]?.maxSuffix || 0) + 1;
  return `${prefix}${nextNum.toString().padStart(6, '0')}`;
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
      // A link that already exists is the expected outcome of re-running this,
      // not a failure — but only if the duplicate is recognised through
      // Drizzle's wrapper.
      if (isDuplicateKeyError(err)) {
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

/** Why a package that matches an order's tracking was NOT linked to it. */
export type OrderBacklinkConflict = {
  trackingNumber: string;
  packageId: number;
  packageCode: string;
  reason: BacklinkConflictReason;
  packageCustomerId: number | null;
  orderCustomerId: number;
};

/**
 * Attach packages that were registered BEFORE their order existed.
 *
 * The normal sequence is order first, parcel second: `packages.register`
 * resolves the tracking to an order and writes the link then and there. The
 * reverse sequence happens too — goods bought at cost that nobody entered
 * yet, which reach the China warehouse with only a customer code on the box.
 * Staff quick-register the parcel, and only later is the purchase order
 * created. Nothing used to revisit that parcel, so it stayed unlinked, and
 * an unlinked package IS the definition of a self order (see
 * getSelfOrderReport). The same physical box then counted once as shipping-
 * only revenue and once as order profit, and the order sat at
 * `tracking_added` forever because status promotion only ever ran from the
 * register path.
 *
 * This closes that gap from the other side: whenever an order gains a
 * tracking, any already-registered package carrying it gets linked, and the
 * order's status catches up.
 *
 * Deliberately conservative — a package is linked ONLY when it plainly
 * belongs to the same customer and no money has settled on it yet. Anything
 * else is returned as a conflict for staff to resolve by hand rather than
 * being guessed at. Idempotent: re-running links nothing twice.
 */
export async function backlinkRegisteredPackagesForOrder(orderId: number): Promise<{
  linked: Array<{ packageId: number; packageCode: string; trackingNumber: string; isPrimary: boolean }>;
  conflicts: OrderBacklinkConflict[];
  promoted: boolean;
}> {
  const empty = { linked: [], conflicts: [], promoted: false };

  const order = await getFullPackageOrderById(orderId);
  if (!order || !order.customerId) return empty;

  // Never reopen an order that is already finished or abandoned.
  if (isTerminalOrderStatus(order.status)) return empty;

  const cartons = await getOrderCartonStatus(orderId);
  if (cartons.registeredTrackings.length === 0) return empty;

  // cartonIndex per tracking, so a multi-carton order keeps its carton order
  // instead of collapsing every late link onto carton 1.
  const trackingRows = await getOrderTrackings(orderId);
  const cartonIndexOf = new Map<string, number>();
  for (const row of trackingRows) {
    if (row.trackingNumber) cartonIndexOf.set(row.trackingNumber.trim(), row.cartonIndex ?? 1);
  }

  const pkgs = await getPackagesByTrackingNumbers(cartons.registeredTrackings);

  const linked: Array<{ packageId: number; packageCode: string; trackingNumber: string; isPrimary: boolean }> = [];
  const conflicts: OrderBacklinkConflict[] = [];

  for (const pkg of pkgs) {
    const tn = (pkg.trackingNumber ?? '').trim();
    if (!tn) continue;
    try {
      const existingLinks = await getPackageOrderLinks(pkg.id);

      const decision = classifyBacklinkCandidate({
        pkg: {
          customerId: pkg.customerId,
          isCharged: pkg.isCharged,
          status: pkg.status,
          fullPackageOrderId: pkg.fullPackageOrderId,
        },
        orderId,
        orderCustomerId: order.customerId,
        existingLinks,
      });

      if (decision.action === 'skip') continue;

      if (decision.action === 'conflict') {
        conflicts.push({
          trackingNumber: tn, packageId: pkg.id, packageCode: pkg.packageCode,
          reason: decision.reason,
          packageCustomerId: pkg.customerId, orderCustomerId: order.customerId,
        });
        continue;
      }

      await createPackageOrderLinks(pkg.id, [{
        fullPackageOrderId: orderId,
        cartonIndex: cartonIndexOf.get(tn) ?? 1,
        isPrimary: decision.isPrimary,
      }]);

      // Mirror the primary link into the legacy FK, exactly as the register
      // path does, so code that reads only that column agrees with the join
      // table instead of still seeing an unlinked (self-order) package.
      if (decision.isPrimary) {
        await updatePackage(pkg.id, { fullPackageOrderId: orderId });
      }

      linked.push({ packageId: pkg.id, packageCode: pkg.packageCode, trackingNumber: tn, isPrimary: decision.isPrimary });
    } catch (err) {
      // One bad package must not stop the others, and must never fail the
      // tracking-entry the operator actually asked for.
      appLogger.warn('[Backlink] Failed to link package to order', {
        orderId, packageId: pkg.id, trackingNumber: tn,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let promoted = false;
  if (linked.length > 0) {
    appLogger.info('[Backlink] Linked pre-registered packages to order', {
      orderId, orderCode: order.orderCode,
      linked: linked.map((l) => l.packageCode), conflicts: conflicts.length,
    });
    try {
      // The parcels were already in the warehouse; the order just never knew.
      const result = await promoteOrderStatusIfFullyReceived(orderId);
      promoted = result.promoted;
    } catch (err) {
      appLogger.warn('[Backlink] Status promotion after linking failed', {
        orderId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (conflicts.length > 0) {
    appLogger.warn('[Backlink] Packages matched by tracking but were NOT linked', {
      orderId, orderCode: order.orderCode, conflicts,
    });
  }

  return { linked, conflicts, promoted };
}

/**
 * The three numbers that decide when a volumetric surcharge is worth telling
 * a customer about, read from settings with the shared defaults as fallback.
 */
export async function getVolumetricThresholds(): Promise<VolumetricThresholds> {
  const read = async (key: string, fallback: number): Promise<number> => {
    try {
      const raw = await getSetting(key);
      const n = parseFloat(raw ?? '');
      return Number.isFinite(n) && n > 0 ? n : fallback;
    } catch {
      return fallback;
    }
  };
  const d = DEFAULT_VOLUMETRIC_THRESHOLDS;
  return {
    minExtraKg: await read(VOLUMETRIC_SETTING_KEYS.minExtraKg, d.minExtraKg),
    minRatio: await read(VOLUMETRIC_SETTING_KEYS.minRatio, d.minRatio),
    alwaysAboveExtraKg: await read(VOLUMETRIC_SETTING_KEYS.alwaysAboveExtraKg, d.alwaysAboveExtraKg),
  };
}

/**
 * Raise a volumetric surcharge everywhere a person might look.
 *
 * Three destinations on purpose. The customer's portal, so they read it in
 * their own account. The staff activity feed, so the office sees it in the
 * portal centre alongside everything else that needs attention. And a stamp on
 * the package row, so the registrations list can glow red until somebody signs
 * it off. The WhatsApp draft is not sent from here — an admin opens it, reads
 * it and presses send, because no message about somebody's bill should leave
 * without a person having looked at it.
 *
 * Every step is independently guarded: a failed notification must not cost us
 * the record that the surcharge happened.
 */
export async function raiseVolumetricAlert(params: {
  packageId: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  assessment: VolumetricAssessment;
  dims: { lengthCm?: string | null; widthCm?: string | null; heightCm?: string | null };
  actorId: number;
  actorName: string;
}): Promise<void> {
  const { packageId, packageCode, trackingNumber, customerId, assessment: a } = params;
  const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

  // Stamp first: this is the record, and it must survive a failed send.
  try {
    await updatePackage(packageId, { volumetricNotifiedAt: new Date() });
  } catch (err) {
    appLogger.warn('[Volumetric] Could not stamp the package', {
      packageId, error: err instanceof Error ? err.message : String(err),
    });
  }

  if (customerId) {
    try {
      await createCustomerNotification({
        customerId,
        type: 'warning',
        title: 'Volumetric weight on your parcel',
        titleKu: 'کێشی قەبارەیی لەسەر بارەکەت',
        titleAr: 'الوزن الحجمي على طردك',
        message:
          `Parcel ${trackingNumber ?? packageCode}: actual ${kg(a.actualKg)} kg, volumetric ${kg(a.volumetricKg)} kg. ` +
          `Airlines bill the greater of the two because the parcel takes up space on the aircraft. ` +
          `This surcharge is the airline's, not ours. Please contact us within 24 hours if you have any question.`,
        messageKu:
          `بارەکەت ${trackingNumber ?? packageCode}: کێشی ڕاستەقینە ${kg(a.actualKg)} کیلۆ، کێشی قەبارەیی ${kg(a.volumetricKg)} کیلۆ. ` +
          `هێڵە ئاسمانییەکان گەورەترینیان حساب دەکەن، چونکە بارەکە لە فڕۆکەدا شوێن دەگرێت. ` +
          `ئەم زیادەیە هی هێڵی ئاسمانییە نەک هی ئێمە. ئەگەر پرسیارت هەبوو، لە ماوەی ٢٤ کاتژمێردا پەیوەندیمان پێوە بکە.`,
        messageAr:
          `طردك ${trackingNumber ?? packageCode}: الوزن الفعلي ${kg(a.actualKg)} كغ، الوزن الحجمي ${kg(a.volumetricKg)} كغ. ` +
          `شركات الطيران تحتسب الأكبر منهما لأن الطرد يشغل حيزاً في الطائرة. ` +
          `هذه الزيادة من شركة الطيران وليست منّا. تواصل معنا خلال ٢٤ ساعة لأي استفسار.`,
      }, { push: true });
    } catch (err) {
      appLogger.warn('[Volumetric] Customer notification failed', {
        packageId, customerId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    await createActivityAlert({
      action: 'volumetric_surcharge',
      category: 'package',
      entityType: 'package',
      entityId: packageId,
      entityCode: packageCode,
      triggeredById: params.actorId,
      triggeredByName: params.actorName,
      severity: 'warning',
      customTitle: `کێشی قەبارەیی لەسەر ${packageCode}`,
      customMessage:
        `${packageCode} (${trackingNumber ?? '—'}): کێشی ڕاستەقینە ${kg(a.actualKg)} کیلۆ، ` +
        `کێشی قەبارەیی ${kg(a.volumetricKg)} کیلۆ، حساب لەسەر ${kg(a.chargeableKg)} کیلۆ ` +
        `(${kg(a.extraKg)} کیلۆ زیادە). پێویستە لەگەڵ ناوەند و کڕیار چێک بکرێتەوە.`,
    });
  } catch (err) {
    appLogger.warn('[Volumetric] Activity alert failed', {
      packageId, error: err instanceof Error ? err.message : String(err),
    });
  }

  appLogger.info('[Volumetric] Surcharge raised', {
    packageId, packageCode, actualKg: a.actualKg, volumetricKg: a.volumetricKg, extraKg: a.extraKg,
  });
}

export type VolumetricParcel = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  customerMobile: string | null;
  shippingType: string;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  registeredAt: Date | string | null;
  batchId: number | null;
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  extraKg: number;
  ratio: number;
  divisor: number;
  alert: boolean;
  acknowledgedAt: Date | string | null;
};

/**
 * Every parcel currently billed on its size rather than its weight.
 *
 * The dashboard view: not a period, but a standing list of the cases somebody
 * still has to deal with. Sorted by how much extra the customer is paying,
 * because that is the order in which the conversations get difficult.
 *
 * Assessed on read rather than stored, so changing a threshold re-scores the
 * whole list instead of leaving old rows judged by an old rule.
 */
export async function getVolumetricParcels(options: {
  pendingOnly?: boolean;
  limit?: number;
} = {}): Promise<VolumetricParcel[]> {
  const db = await getDb();
  if (!db) return [];

  const thresholds = await getVolumetricThresholds();
  const divisorRaw = await getSetting('cbm_divisor');
  const divisor = parseInt(divisorRaw ?? '', 10) || undefined;

  const rows = await db.select({
    id: packages.id,
    packageCode: packages.packageCode,
    trackingNumber: packages.trackingNumber,
    customerId: packages.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
    customerMobile: customers.mobileNumber,
    shippingType: packages.shippingType,
    weightKg: packages.weightKg,
    lengthCm: packages.lengthCm,
    widthCm: packages.widthCm,
    heightCm: packages.heightCm,
    registeredAt: packages.registeredAt,
    batchId: packages.batchId,
    volumetricAckAt: packages.volumetricAckAt,
  })
    .from(packages)
    .leftJoin(customers, eq(packages.customerId, customers.id))
    .where(and(
      // Once handed over or written off there is nothing left to explain.
      notInArray(packages.status, ['delivered', 'returned', 'cancelled']),
      inArray(packages.shippingType, ['air_regular', 'air_irregular']),
    ))
    .orderBy(desc(packages.registeredAt))
    .limit(Math.min(options.limit ?? 500, 1000));

  const out: VolumetricParcel[] = [];
  for (const r of rows) {
    const a = assessVolumetric(
      {
        shippingType: String(r.shippingType),
        weightKg: r.weightKg,
        lengthCm: r.lengthCm,
        widthCm: r.widthCm,
        heightCm: r.heightCm,
      },
      { divisor, thresholds },
    );
    if (!a.alert) continue;
    if (options.pendingOnly && r.volumetricAckAt) continue;

    out.push({
      id: r.id,
      packageCode: r.packageCode,
      trackingNumber: r.trackingNumber,
      customerId: r.customerId,
      customerName: r.customerName ?? null,
      customerCode: r.customerCode ?? null,
      customerMobile: r.customerMobile ?? null,
      shippingType: String(r.shippingType),
      lengthCm: r.lengthCm,
      widthCm: r.widthCm,
      heightCm: r.heightCm,
      registeredAt: r.registeredAt,
      batchId: r.batchId,
      actualKg: a.actualKg,
      volumetricKg: a.volumetricKg,
      chargeableKg: a.chargeableKg,
      extraKg: a.extraKg,
      ratio: a.ratio,
      divisor: a.divisor,
      alert: a.alert,
      acknowledgedAt: r.volumetricAckAt ?? null,
    });
  }

  // Biggest gap first: that is the order the conversations get difficult in.
  return out.sort((x, y) => y.extraKg - x.extraKg);
}

/** Record that a person has checked a volumetric surcharge with the customer. */
export async function acknowledgeVolumetric(packageId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(packages)
    .set({ volumetricAckAt: new Date(), volumetricAckById: userId })
    .where(eq(packages.id, packageId));
  return true;
}

/** A tracking we are waiting on, and why we know about it. */
export type AwaitedParcel = {
  trackingNumber: string;
  /**
   * - order — we bought it for them, so we have the order behind it.
   * - customer — they told us in the portal that this tracking is coming.
   */
  origin: 'order' | 'customer';
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  /** When we first learned this tracking existed. Age is measured from here. */
  knownSince: Date | string | null;
  daysWaiting: number;
  /** Past this, the parcel is late enough that somebody should look. */
  isLate: boolean;
  productName: string | null;
  productImage: string | null;
  shippingType: string | null;
  order: { id: number; orderCode: string; orderType: string; status: string } | null;
};

/** A tracking is normal for a week; after that it wants a person. */
export const AWAITING_LATE_AFTER_DAYS = 7;

/**
 * Trackings we know about that have not reached the China warehouse.
 *
 * The mirror of the registrations list, and the piece the office was missing.
 * Tracking Alerts covers the step before this — orders with no tracking at all
 * — and the registrations page covers the step after, once a parcel is on the
 * shelf. In between sat a blind spot: goods dispatched, tracking known, and no
 * screen saying what to expect.
 *
 * Two sources, deliberately merged. Orders are what we bought for a customer.
 * Portal declarations are what the customer bought themselves and told us
 * about — and those are the ones that matter most here, because when one goes
 * quiet the customer is the only person who can chase the seller, and only if
 * we tell them.
 */
export async function getAwaitingArrival(options: { lateOnly?: boolean } = {}): Promise<AwaitedParcel[]> {
  const db = await getDb();
  if (!db) return [];

  const TERMINAL: ("delivered" | "cancelled" | "refunded" | "returned")[] = ["delivered", "cancelled", "refunded", "returned"];
  const now = Date.now();
  const daysSince = (d: Date | string | null): number => {
    if (!d) return 0;
    return Math.max(0, Math.floor((now - new Date(d).getTime()) / 86_400_000));
  };

  // Every tracking an active order owns, from both the multi-tracking table
  // and the legacy single column.
  const fromTable = await db.select({
    trackingNumber: fullPackageOrderTrackings.trackingNumber,
    addedAt: fullPackageOrderTrackings.createdAt,
    orderId: fullPackageOrders.id,
    orderCode: fullPackageOrders.orderCode,
    orderType: fullPackageOrders.orderType,
    orderStatus: fullPackageOrders.status,
    productName: fullPackageOrders.productName,
    productImage: fullPackageOrders.productImage,
    trackingAddedDate: fullPackageOrders.trackingAddedDate,
    customerId: fullPackageOrders.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
  })
    .from(fullPackageOrderTrackings)
    .innerJoin(fullPackageOrders, eq(fullPackageOrderTrackings.fullPackageOrderId, fullPackageOrders.id))
    .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
    .where(notInArray(fullPackageOrders.status, TERMINAL));

  const fromLegacy = await db.select({
    trackingNumber: fullPackageOrders.trackingNumber,
    orderId: fullPackageOrders.id,
    orderCode: fullPackageOrders.orderCode,
    orderType: fullPackageOrders.orderType,
    orderStatus: fullPackageOrders.status,
    productName: fullPackageOrders.productName,
    productImage: fullPackageOrders.productImage,
    trackingAddedDate: fullPackageOrders.trackingAddedDate,
    customerId: fullPackageOrders.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
  })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
    .where(and(
      notInArray(fullPackageOrders.status, TERMINAL),
      isNotNull(fullPackageOrders.trackingNumber),
      ne(fullPackageOrders.trackingNumber, ''),
    ));

  // What customers declared in the portal and we have not received yet.
  const declared = await db.select({
    trackingNumber: customerDeclaredPackages.trackingNumber,
    createdAt: customerDeclaredPackages.createdAt,
    productName: customerDeclaredPackages.productName,
    productImages: customerDeclaredPackages.productImages,
    customerId: customerDeclaredPackages.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
  })
    .from(customerDeclaredPackages)
    .leftJoin(customers, eq(customerDeclaredPackages.customerId, customers.id))
    .where(notInArray(customerDeclaredPackages.status, ["received", "cancelled"] as ("received" | "cancelled")[]));

  const candidates = new Map<string, AwaitedParcel>();

  const add = (p: AwaitedParcel) => {
    const existing = candidates.get(p.trackingNumber);
    // An order carries more for the office to act on than a declaration, so it
    // wins; otherwise keep whichever we learned about first, since that is the
    // honest start of the wait.
    if (!existing) { candidates.set(p.trackingNumber, p); return; }
    if (existing.origin === 'customer' && p.origin === 'order') {
      candidates.set(p.trackingNumber, { ...p, knownSince: existing.knownSince, daysWaiting: existing.daysWaiting, isLate: existing.isLate });
    }
  };

  const orderRows: Array<{ since: Date | null; row: typeof fromLegacy[number] }> = [
    ...fromTable.map((o) => ({ since: (o.addedAt ?? o.trackingAddedDate) as Date | null, row: o as unknown as typeof fromLegacy[number] })),
    ...fromLegacy.map((o) => ({ since: o.trackingAddedDate as Date | null, row: o })),
  ];

  for (const { since, row: o } of orderRows) {
    const tn = o.trackingNumber?.trim();
    if (!tn) continue;
    const days = daysSince(since);
    add({
      trackingNumber: tn,
      origin: 'order',
      customerId: o.customerId ?? null,
      customerName: o.customerName ?? null,
      customerCode: o.customerCode ?? null,
      knownSince: since,
      daysWaiting: days,
      isLate: days >= AWAITING_LATE_AFTER_DAYS,
      productName: o.productName ?? null,
      productImage: o.productImage ?? null,
      shippingType: null,
      order: { id: o.orderId, orderCode: o.orderCode, orderType: String(o.orderType), status: String(o.orderStatus) },
    });
  }

  for (const d of declared) {
    const tn = d.trackingNumber?.trim();
    if (!tn) continue;
    const days = daysSince(d.createdAt);
    add({
      trackingNumber: tn,
      origin: 'customer',
      customerId: d.customerId ?? null,
      customerName: d.customerName ?? null,
      customerCode: d.customerCode ?? null,
      knownSince: d.createdAt,
      daysWaiting: days,
      isLate: days >= AWAITING_LATE_AFTER_DAYS,
      productName: d.productName ?? null,
      productImage: ((d.productImages as string[] | null) ?? [])[0] ?? null,
      shippingType: null,
      order: null,
    });
  }

  if (candidates.size === 0) return [];

  // Drop everything that has already landed. One query, not one per tracking.
  const allTrackings = Array.from(candidates.keys());
  const arrived = new Set<string>();
  for (let i = 0; i < allTrackings.length; i += 500) {
    const slice = allTrackings.slice(i, i + 500);
    const rows = await db.select({ tn: packages.trackingNumber })
      .from(packages)
      .where(inArray(packages.trackingNumber, slice));
    for (const r of rows) { if (r.tn) arrived.add(r.tn.trim()); }
  }

  const result = Array.from(candidates.values()).filter((p) => !arrived.has(p.trackingNumber));
  const filtered = options.lateOnly ? result.filter((p) => p.isLate) : result;

  // Longest wait first: the top of this list is the work.
  return filtered.sort((a, b) => b.daysWaiting - a.daysWaiting);
}

/** A parcel is expected to join a batch within this many days of arriving. */
export const STALE_IN_DEPOT_AFTER_DAYS = 15;

export type StaleDepotParcel = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  shippingType: string;
  weightKg: string | null;
  volumeCbm: string | null;
  registeredAt: Date | string | null;
  daysInDepot: number;
};

/**
 * Parcels sitting in the China warehouse that no batch has picked up.
 *
 * A registration that never joins a batch never ships. Nothing surfaced that,
 * so a forgotten box could sit for a month while the customer waited and the
 * office believed it was on its way.
 */
export async function getStaleDepotPackages(options: { olderThanDays?: number } = {}): Promise<StaleDepotParcel[]> {
  const db = await getDb();
  if (!db) return [];

  const days = options.olderThanDays ?? STALE_IN_DEPOT_AFTER_DAYS;
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const rows = await db.select({
    id: packages.id,
    packageCode: packages.packageCode,
    trackingNumber: packages.trackingNumber,
    customerId: packages.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
    shippingType: packages.shippingType,
    weightKg: packages.weightKg,
    volumeCbm: packages.volumeCbm,
    registeredAt: packages.registeredAt,
  })
    .from(packages)
    .leftJoin(customers, eq(packages.customerId, customers.id))
    .where(and(
      eq(packages.status, 'registered'),
      isNull(packages.batchId),
      lt(packages.registeredAt, cutoff),
    ))
    .orderBy(asc(packages.registeredAt));

  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    shippingType: String(r.shippingType),
    daysInDepot: r.registeredAt
      ? Math.max(0, Math.floor((now - new Date(r.registeredAt).getTime()) / 86_400_000))
      : 0,
  }));
}

/** One picture on a registration, and where it came from. */
export type RegistrationPhoto = {
  url: string;
  /**
   * - warehouse — taken at Quick Register when the parcel arrived.
   * - order — supplied when the purchase order was created (پاکێجی تەواو / کڕین بە تێچوو).
   * - customer — uploaded by the customer in the portal when declaring the tracking.
   */
  source: 'warehouse' | 'order' | 'customer';
};

export type RegistrationRow = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  isUnclaimed: boolean;
  weightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
  shippingType: 'air_regular' | 'air_irregular' | 'sea';
  description: string | null;
  categoryName: string | null;
  calculatedCostUsd: string | null;
  status: string;
  batchId: number | null;
  registeredAt: Date | string | null;
  registeredByName: string | null;
  photos: RegistrationPhoto[];
  /** Null means nobody bought this for them — a self order. */
  order: {
    id: number;
    orderCode: string;
    orderType: 'full_package' | 'commission' | 'purchase_request';
    productName: string | null;
    status: string;
  } | null;
  /** The customer told us this tracking was coming, before it arrived. */
  declaredByCustomer: boolean;
  /**
   * A self order from a customer who has live purchase orders with us.
   *
   * A parcel with no order behind it is a genuine self order — the customer
   * bought it and we only ship. But when that customer also has open
   * کڕین بە تێچوو or پاکێجی تەواو orders, one arriving unattached is worth a
   * look: far more often it is an order nobody entered yet than a customer who
   * happened to shop alone this once. The office should check rather than let
   * it settle into the wrong column, where it would be billed for shipping
   * only and counted as self-order profit.
   */
  needsReview: boolean;
  /** How many live orders that customer has, for the reviewer's context. */
  customerOpenOrders: number;
  /** Billed on size rather than weight, by a margin worth explaining. */
  volumetric: {
    actualKg: number;
    volumetricKg: number;
    chargeableKg: number;
    extraKg: number;
    ratio: number;
    divisor: number;
    alert: boolean;
  } | null;
  /** Set once somebody has checked the surcharge with the customer. */
  volumetricAckAt: Date | string | null;
  customerMobile: string | null;
};

/**
 * Everything Quick Register took in over a period, assembled from every place
 * that knows something about the parcel.
 *
 * Built as its own query rather than reusing the package list because that list
 * answers a different question. Two things it could not do:
 *
 *   - Find the order. It reads packages.fullPackageOrderId, which is only set
 *     when the order existed at registration time. A parcel registered first
 *     shows no order at all and reads as a self order, which is how a
 *     کڕین بە تێچوو ended up labelled سێلف ئۆردەر on screen. Here the tracking
 *     number is used as well, so the order is found either way.
 *   - Find the photos. A parcel can be pictured three times over: at the
 *     warehouse, on the purchase order, and by the customer declaring it in the
 *     portal. All three are collected here, each tagged with where it came
 *     from, so a parcel whose warehouse photo is missing still shows what it
 *     looks like.
 */
export async function getRegistrations(options: {
  from: Date;
  to: Date;
  search?: string;
  limit?: number;
}): Promise<RegistrationRow[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = Math.min(options.limit ?? 500, 2000);

  const conds = [
    eq(packages.status, 'registered'),
    gte(packages.registeredAt, options.from),
    lt(packages.registeredAt, options.to),
  ];

  const base = await db.select({
    id: packages.id,
    packageCode: packages.packageCode,
    trackingNumber: packages.trackingNumber,
    customerId: packages.customerId,
    fullPackageOrderId: packages.fullPackageOrderId,
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
    batchId: packages.batchId,
    registeredAt: packages.registeredAt,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
    categoryNameEn: productCategories.nameEn,
    categoryNameAr: productCategories.nameAr,
    categoryNameKu: productCategories.nameKu,
    registeredByName: users.name,
    volumetricAckAt: packages.volumetricAckAt,
    customerMobile: customers.mobileNumber,
  })
    .from(packages)
    .leftJoin(customers, eq(packages.customerId, customers.id))
    .leftJoin(productCategories, eq(packages.categoryId, productCategories.id))
    .leftJoin(users, eq(packages.registeredById, users.id))
    .where(and(...conds))
    .orderBy(desc(packages.registeredAt), desc(packages.id))
    .limit(limit);

  if (base.length === 0) return [];

  const trackings = Array.from(
    new Set(base.map((r) => r.trackingNumber?.trim()).filter((t): t is string => Boolean(t))),
  );

  // Orders reachable from these trackings — the multi-tracking table and the
  // legacy single column both, since either may be the only one filled in.
  type OrderInfo = {
    id: number; orderCode: string; orderType: string; productName: string | null;
    status: string; productImage: string | null; productImages: string[] | null;
  };
  const orderByTracking = new Map<string, OrderInfo>();
  const orderById = new Map<number, OrderInfo>();

  if (trackings.length > 0) {
    const viaTable = await db.select({
      trackingNumber: fullPackageOrderTrackings.trackingNumber,
      id: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      productName: fullPackageOrders.productName,
      status: fullPackageOrders.status,
      productImage: fullPackageOrders.productImage,
      productImages: fullPackageOrders.productImages,
    })
      .from(fullPackageOrderTrackings)
      .innerJoin(fullPackageOrders, eq(fullPackageOrderTrackings.fullPackageOrderId, fullPackageOrders.id))
      .where(inArray(fullPackageOrderTrackings.trackingNumber, trackings));

    const viaLegacy = await db.select({
      trackingNumber: fullPackageOrders.trackingNumber,
      id: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      productName: fullPackageOrders.productName,
      status: fullPackageOrders.status,
      productImage: fullPackageOrders.productImage,
      productImages: fullPackageOrders.productImages,
    })
      .from(fullPackageOrders)
      .where(inArray(fullPackageOrders.trackingNumber, trackings));

    for (const o of [...viaTable, ...viaLegacy]) {
      const info: OrderInfo = {
        id: o.id, orderCode: o.orderCode, orderType: String(o.orderType),
        productName: o.productName ?? null, status: String(o.status),
        productImage: o.productImage ?? null,
        productImages: (o.productImages as string[] | null) ?? null,
      };
      orderById.set(o.id, info);
      const tn = o.trackingNumber?.trim();
      // First writer wins: the multi-tracking table is the newer, more precise
      // source and is read first, so a stale legacy column cannot override it.
      if (tn && !orderByTracking.has(tn)) orderByTracking.set(tn, info);
    }
  }

  // Orders reachable only through the FK (tracking may have been cleared).
  const missingFkIds = Array.from(new Set(
    base.map((r) => r.fullPackageOrderId).filter((id): id is number => Boolean(id) && !orderById.has(id!)),
  ));
  if (missingFkIds.length > 0) {
    const extra = await db.select({
      id: fullPackageOrders.id,
      orderCode: fullPackageOrders.orderCode,
      orderType: fullPackageOrders.orderType,
      productName: fullPackageOrders.productName,
      status: fullPackageOrders.status,
      productImage: fullPackageOrders.productImage,
      productImages: fullPackageOrders.productImages,
    }).from(fullPackageOrders).where(inArray(fullPackageOrders.id, missingFkIds));
    for (const o of extra) {
      orderById.set(o.id, {
        id: o.id, orderCode: o.orderCode, orderType: String(o.orderType),
        productName: o.productName ?? null, status: String(o.status),
        productImage: o.productImage ?? null,
        productImages: (o.productImages as string[] | null) ?? null,
      });
    }
  }

  // What the customer sent us from the portal before the parcel arrived.
  const declaredByTracking = new Map<string, string[]>();
  if (trackings.length > 0) {
    const declared = await db.select({
      trackingNumber: customerDeclaredPackages.trackingNumber,
      productImages: customerDeclaredPackages.productImages,
    })
      .from(customerDeclaredPackages)
      .where(inArray(customerDeclaredPackages.trackingNumber, trackings));
    for (const d of declared) {
      const tn = d.trackingNumber?.trim();
      if (!tn) continue;
      const imgs = (d.productImages as string[] | null) ?? [];
      const prev = declaredByTracking.get(tn) ?? [];
      declaredByTracking.set(tn, prev.concat(imgs.filter(Boolean)));
    }
  }

  // For parcels that arrived with no order attached: does that customer have
  // live orders with us? One batched count, not a query per row.
  const openOrdersByCustomer = new Map<number, number>();
  const selfOrderCustomerIds = Array.from(new Set(
    base
      .filter((r) => {
        const tn = r.trackingNumber?.trim();
        const linked = (tn && orderByTracking.has(tn)) || (r.fullPackageOrderId && orderById.has(r.fullPackageOrderId));
        return !linked && r.customerId;
      })
      .map((r) => r.customerId!)
      .filter(Boolean),
  ));
  if (selfOrderCustomerIds.length > 0) {
    const counts = await db.select({
      customerId: fullPackageOrders.customerId,
      n: count(),
    })
      .from(fullPackageOrders)
      .where(and(
        inArray(fullPackageOrders.customerId, selfOrderCustomerIds),
        inArray(fullPackageOrders.orderType, ['full_package', 'commission']),
        notInArray(fullPackageOrders.status, ['delivered', 'cancelled', 'refunded', 'returned']),
      ))
      .groupBy(fullPackageOrders.customerId);
    for (const c of counts) {
      if (c.customerId) openOrdersByCustomer.set(c.customerId, Number(c.n) || 0);
    }
  }

  const term = options.search?.trim().toLowerCase();

  // Read once for the whole page rather than per row.
  const vThresholds = await getVolumetricThresholds();
  const vDivisorRaw = await getSetting('cbm_divisor');
  const vDivisor = parseInt(vDivisorRaw ?? '', 10) || undefined;

  const rows: RegistrationRow[] = [];
  for (const r of base) {
    const tn = r.trackingNumber?.trim() ?? null;
    const order = (tn ? orderByTracking.get(tn) : undefined)
      ?? (r.fullPackageOrderId ? orderById.get(r.fullPackageOrderId) : undefined)
      ?? null;

    // Warehouse pictures first — they show the parcel as it actually arrived,
    // which is what someone checking a registration wants to see.
    const photos: RegistrationPhoto[] = [];
    const seen = new Set<string>();
    const push = (url: unknown, source: RegistrationPhoto['source']) => {
      if (typeof url !== 'string') return;
      const u = url.trim();
      if (!u || seen.has(u)) return;
      seen.add(u);
      photos.push({ url: u, source });
    };

    let own: unknown = r.photos;
    if (typeof own === 'string') { try { own = JSON.parse(own); } catch { own = []; } }
    for (const p of Array.isArray(own) ? own : []) push(p, 'warehouse');

    if (order) {
      push(order.productImage, 'order');
      for (const p of order.productImages ?? []) push(p, 'order');
    }
    const declaredImgs = tn ? declaredByTracking.get(tn) : undefined;
    for (const p of declaredImgs ?? []) push(p, 'customer');

    const row: RegistrationRow = {
      id: r.id,
      packageCode: r.packageCode,
      trackingNumber: r.trackingNumber,
      customerId: r.customerId,
      customerName: r.customerName ?? null,
      customerCode: r.customerCode ?? null,
      isUnclaimed: r.isUnclaimed,
      weightKg: r.weightKg,
      lengthCm: r.lengthCm,
      widthCm: r.widthCm,
      heightCm: r.heightCm,
      volumeCbm: r.volumeCbm,
      shippingType: r.shippingType as RegistrationRow['shippingType'],
      description: r.description,
      categoryName: r.categoryNameKu || r.categoryNameEn || r.categoryNameAr || null,
      calculatedCostUsd: r.calculatedCostUsd,
      status: r.status,
      batchId: r.batchId,
      registeredAt: r.registeredAt,
      registeredByName: r.registeredByName ?? null,
      photos,
      order: order
        ? {
            id: order.id,
            orderCode: order.orderCode,
            orderType: order.orderType as 'full_package' | 'commission' | 'purchase_request',
            productName: order.productName,
            status: order.status,
          }
        : null,
      declaredByCustomer: Boolean(declaredImgs && declaredImgs.length > 0),
      needsReview: !order && Boolean(r.customerId) && (openOrdersByCustomer.get(r.customerId!) ?? 0) > 0,
      customerOpenOrders: r.customerId ? (openOrdersByCustomer.get(r.customerId) ?? 0) : 0,
      volumetric: (() => {
        const a = assessVolumetric(
          {
            shippingType: String(r.shippingType),
            weightKg: r.weightKg,
            lengthCm: r.lengthCm,
            widthCm: r.widthCm,
            heightCm: r.heightCm,
          },
          { divisor: vDivisor, thresholds: vThresholds },
        );
        // Sea is billed on volume outright; there is nothing to surface.
        if (!a.billedOnVolume) return null;
        return {
          actualKg: a.actualKg,
          volumetricKg: a.volumetricKg,
          chargeableKg: a.chargeableKg,
          extraKg: a.extraKg,
          ratio: a.ratio,
          divisor: a.divisor,
          alert: a.alert,
        };
      })(),
      volumetricAckAt: r.volumetricAckAt ?? null,
      customerMobile: r.customerMobile ?? null,
    };

    // Search runs here, after the order and customer are known, so typing an
    // order code or a customer name finds the parcel too.
    if (term) {
      const hay = [
        row.trackingNumber, row.packageCode, row.customerName, row.customerCode,
        row.description, row.categoryName, row.order?.orderCode, row.order?.productName,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(term)) continue;
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Clear photo URLs that point at files which no longer exist.
 *
 * Photos taken at the warehouse were written into the container and served
 * from a route production never mounted, so every redeploy rebuilt the
 * container and took the files with it while their URLs stayed on the package
 * rows. Those rows render as broken images; a package with no photo should say
 * so plainly instead.
 *
 * Only files in our own uploads directory are ever considered — see
 * photoUrls.ts. An absolute URL, an inline image, or anything unrecognised is
 * kept regardless, because a missing local file proves nothing about it.
 *
 * `dryRun` visits exactly the same rows and reports exactly the same numbers
 * as a real run; it simply does not write. Run it first.
 */
export async function cleanupDeadPhotoUrls(options: { dryRun?: boolean } = {}): Promise<{
  dryRun: boolean;
  scanned: number;
  affectedPackages: number;
  removedPhotos: number;
  emptiedPackages: number;
  samples: Array<{ packageCode: string; removed: string[] }>;
}> {
  const dryRun = options.dryRun !== false; // deleting is opt-in, never the default
  const empty = { dryRun, scanned: 0, affectedPackages: 0, removedPhotos: 0, emptiedPackages: 0, samples: [] };

  const db = await getDb();
  if (!db) return empty;

  const uploadsDir = getUploadsDir();
  // One directory read, not one stat per photo: the same file is referenced by
  // several rows, and this runs over the whole table.
  let present: Set<string>;
  try {
    present = new Set(fs.readdirSync(uploadsDir));
  } catch (err) {
    // No directory at all means nothing local survives. That is a legitimate
    // state (fresh container), but deleting every local URL on the strength of
    // a failed readdir is not a risk worth taking — bail out instead.
    appLogger.warn('[PhotoCleanup] Could not read the uploads directory; nothing was changed', {
      uploadsDir, error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }

  const rows = await db.select({
    id: packages.id,
    packageCode: packages.packageCode,
    photos: packages.photos,
  })
    .from(packages)
    .where(isNotNull(packages.photos));

  let affectedPackages = 0;
  let removedPhotos = 0;
  let emptiedPackages = 0;
  const samples: Array<{ packageCode: string; removed: string[] }> = [];

  for (const row of rows) {
    // The column is JSON, but a legacy row may hold the encoded string.
    let photos: unknown = row.photos;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { continue; }
    }

    const pruned = prunePhotoList(photos, (name) => present.has(name));
    if (!pruned) continue;

    affectedPackages++;
    removedPhotos += pruned.removed.length;
    if (pruned.kept.length === 0) emptiedPackages++;
    if (samples.length < 10) samples.push({ packageCode: row.packageCode, removed: pruned.removed });

    if (!dryRun) {
      await db.update(packages)
        .set({ photos: pruned.kept.length > 0 ? pruned.kept : null })
        .where(eq(packages.id, row.id));
    }
  }

  appLogger.info('[PhotoCleanup] Finished', {
    dryRun, scanned: rows.length, affectedPackages, removedPhotos, emptiedPackages,
  });

  return { dryRun, scanned: rows.length, affectedPackages, removedPhotos, emptiedPackages, samples };
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

  // Every startup after the first has nothing to do, but "nothing to do" still
  // meant one INSERT per linked package — hundreds of round trips before the
  // server would serve a request. Ask once whether the work is already done.
  if (candidates.length > 0) {
    const existing = await db.select({ packageId: packageOrderLinks.packageId })
      .from(packageOrderLinks)
      .where(inArray(packageOrderLinks.packageId, candidates.map((c) => c.id)));
    const linked = new Set(existing.map((e) => e.packageId));
    if (candidates.every((c) => linked.has(c.id))) {
      return { totalCandidates: candidates.length, inserted: 0, alreadyLinked: candidates.length, errors: 0 };
    }
  }

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
      // Drizzle wraps the mysql2 error, so the duplicate code lives on
      // `cause`. Reading it off the wrapper meant every row this backfill had
      // already written was logged as a failure on the next startup.
      if (isDuplicateKeyError(err)) {
        alreadyLinked++;
      } else {
        errors++;
        appLogger.warn("[Backfill] packageOrderLinks insert failed", {
          packageId: c.id, orderId: c.fullPackageOrderId, error: dbErrorReason(err),
        });
      }
    }
  }

  return { totalCandidates: candidates.length, inserted, alreadyLinked, errors };
}


/**
 * What the warehouse took in over a period, grouped by customer.
 *
 * Answers the questions an owner actually asks about a day's intake: how many
 * pieces, for whom, how many kilos by air, how many cubic metres by sea, what
 * kind of goods, and roughly what it is worth.
 *
 * The value prefers what registration actually stored. `packages.register`
 * prices each parcel against the rule for its own origin and destination and
 * writes it to calculatedCostUsd, and that same stored figure is what a
 * finalized batch bills the customer — so a summary that recomputed it would
 * quietly disagree with the invoice.
 *
 * The rule-based estimate is only a fallback, for rows registered without one:
 * unclaimed parcels get no cost on purpose, and a parcel weighed after
 * registration keeps whatever it was priced at then.
 */
export async function getRegistrationSummary(opts: {
  from: Date;
  to: Date;
}): Promise<{
  totals: {
    pieces: number;
    customers: number;
    airWeightKg: number;
    seaCbm: number;
    estimatedValueUsd: number;
    missingWeight: number;
    unclaimed: number;
  };
  byCustomer: {
    customerId: number | null;
    customerCode: string | null;
    customerName: string | null;
    pieces: number;
    weightKg: number;
    cbm: number;
    estimatedValueUsd: number;
    shippingTypes: string[];
    categories: string[];
  }[];
}> {
  const empty = {
    totals: { pieces: 0, customers: 0, airWeightKg: 0, seaCbm: 0, estimatedValueUsd: 0, missingWeight: 0, unclaimed: 0 },
    byCustomer: [],
  };

  const db = await getDb();
  if (!db) return empty;

  const rows = await db
    .select({
      pkg: packages,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      categoryKu: productCategories.nameKu,
      categoryEn: productCategories.nameEn,
    })
    .from(packages)
    .leftJoin(customers, eq(packages.customerId, customers.id))
    .leftJoin(productCategories, eq(packages.categoryId, productCategories.id))
    .where(and(gte(packages.registeredAt, opts.from), lte(packages.registeredAt, opts.to)));

  if (rows.length === 0) return empty;

  // One lookup for the whole period rather than per row.
  const rules = await db.select().from(pricingRules).where(eq(pricingRules.isActive, true));
  const priceOf = (shippingType: string, weightKg: number, cbm: number): number => {
    const rule = rules.find((r: PricingRule) => r.shippingType === shippingType);
    if (!rule) return 0;
    const perUnit = parseFloat(rule.pricePerUnit || "0");
    if (!perUnit) return 0;
    return rule.unit === "cbm" ? cbm * perUnit : weightKg * perUnit;
  };

  const grouped = new Map<string, {
    customerId: number | null; customerCode: string | null; customerName: string | null;
    pieces: number; weightKg: number; cbm: number; estimatedValueUsd: number;
    shippingTypes: Set<string>; categories: Set<string>;
  }>();

  const totals = { pieces: 0, customers: 0, airWeightKg: 0, seaCbm: 0, estimatedValueUsd: 0, missingWeight: 0, unclaimed: 0 };

  for (const row of rows) {
    const pkg = row.pkg;
    const weightKg = parseFloat(pkg.weightKg?.toString() || "0") || 0;
    const cbm = parseFloat(pkg.volumeCbm?.toString() || "0") || 0;
    // What registration priced it at, which is also what a finalized batch
    // bills. Only estimate when nothing was stored.
    const storedCost = parseFloat(pkg.calculatedCostUsd?.toString() || "0") || 0;
    const value = storedCost > 0 ? storedCost : priceOf(pkg.shippingType, weightKg, cbm);

    totals.pieces += 1;
    if (pkg.shippingType === "sea") totals.seaCbm += cbm;
    else totals.airWeightKg += weightKg;
    totals.estimatedValueUsd += value;
    if (weightKg <= 0 && cbm <= 0) totals.missingWeight += 1;
    if (pkg.isUnclaimed || !pkg.customerId) totals.unclaimed += 1;

    // Unclaimed parcels share a bucket: they belong to nobody yet, and one
    // row each would bury the real customers under them.
    const key = pkg.customerId ? String(pkg.customerId) : "unclaimed";
    const entry = grouped.get(key) ?? {
      customerId: pkg.customerId ?? null,
      customerCode: row.customerCode ?? null,
      customerName: row.customerName ?? null,
      pieces: 0, weightKg: 0, cbm: 0, estimatedValueUsd: 0,
      shippingTypes: new Set<string>(), categories: new Set<string>(),
    };
    entry.pieces += 1;
    entry.weightKg += weightKg;
    entry.cbm += cbm;
    entry.estimatedValueUsd += value;
    entry.shippingTypes.add(pkg.shippingType);
    const categoryName = row.categoryKu || row.categoryEn;
    if (categoryName) entry.categories.add(categoryName);
    grouped.set(key, entry);
  }

  totals.customers = Array.from(grouped.keys()).filter(k => k !== "unclaimed").length;

  const byCustomer = Array.from(grouped.values())
    .map(e => ({
      customerId: e.customerId,
      customerCode: e.customerCode,
      customerName: e.customerName,
      pieces: e.pieces,
      weightKg: Number(e.weightKg.toFixed(3)),
      cbm: Number(e.cbm.toFixed(4)),
      estimatedValueUsd: Number(e.estimatedValueUsd.toFixed(2)),
      shippingTypes: Array.from(e.shippingTypes),
      categories: Array.from(e.categories),
    }))
    // Busiest customer first — that is the one worth looking at.
    .sort((a, b) => b.pieces - a.pieces);

  return {
    totals: {
      ...totals,
      airWeightKg: Number(totals.airWeightKg.toFixed(3)),
      seaCbm: Number(totals.seaCbm.toFixed(4)),
      estimatedValueUsd: Number(totals.estimatedValueUsd.toFixed(2)),
    },
    byCustomer,
  };
}

/**
 * Add a photo taken at a scan to the parcel's own gallery.
 *
 * The scan already keeps its copy in `packageScans.photoUrl` — that is the
 * record of what that particular scan saw, and it should stay. But nothing
 * outside the scan log reads it, so a photo taken of every parcel arriving at
 * the China depot was being stored and shown to nobody: the portal card, the
 * parcel page, the delivery box and the rating card all read `packages.photos`
 * and it stayed empty.
 *
 * Appends rather than replaces, and skips a URL already in the list, so a
 * parcel scanned at three points along the road ends up with three pictures
 * and not three copies of the first.
 */
export async function addPackagePhoto(packageId: number, photoUrl: string): Promise<void> {
  if (!photoUrl) return;
  const db = await getDb();
  if (!db) return;

  const [row] = await db.select({ photos: packages.photos })
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1);
  if (!row) return;

  const existing = Array.isArray(row.photos) ? row.photos.filter((p): p is string => typeof p === "string") : [];
  if (existing.includes(photoUrl)) return;

  await db.update(packages)
    .set({ photos: [...existing, photoUrl] })
    .where(eq(packages.id, packageId));
}
