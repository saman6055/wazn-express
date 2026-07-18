import { getDb } from './connection';
import { appLogger } from '../utils/logger';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { getCustomerById } from './customers.db';
import { applyCharge } from './finance.db';
import { getCustomerPriceInBatch } from './batches.db';
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
  fullPackageOrderTrackings, InsertFullPackageOrderTracking, FullPackageOrderTracking,
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

// ============ SOFT-DELETE HELPER (Plan v3, Phase 1) ============
// Shared predicate used everywhere a user-facing query must hide rows that
// have been soft-deleted via Phase 3's delete flow. Centralizing it in one
// constant guarantees that if we ever need to change the policy (e.g. add
// an includeDeleted flag), we only touch one line.
const notDeleted = isNull(fullPackageOrders.deletedAt);

// ============ FULL PACKAGE ORDER OPERATIONS ============

export async function createFullPackageOrder(data: InsertFullPackageOrder): Promise<FullPackageOrder> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // UNIFIED FINANCIAL MODEL:
  // Full Package & Purchase Request: Customer pays sellingPriceUsd (final price) only
  // Shipping cost is OUR cost, deducted from profit, NOT charged to customer
  // profit = (sellingPrice - purchasePrice) * quantity - shippingCost
  // Commission: Customer pays itemPrice + commissionFee, shipping is our cost
  // profit = commissionFee - shippingCost

  const orderType = data.orderType || 'full_package';
  const quantity = data.quantity || 1;
  const shippingCost = parseFloat(data.shippingCostUsd as string || "0") || 0;

  let profit = 0;

  if (orderType === 'full_package' || orderType === 'purchase_request') {
    // Full Package & Purchase Request use SAME formula
    const purchasePrice = parseFloat(data.purchasePriceUsd as string) || 0;
    const sellingPrice = parseFloat(data.sellingPriceUsd as string) || 0;
    profit = ((sellingPrice - purchasePrice) * quantity) - shippingCost;
  } else if (orderType === 'commission') {
    // Commission: profit = commissionFee - shippingCost
    const commissionFee = parseFloat(data.commissionFeeUsd as string || "0") || 0;
    profit = commissionFee - shippingCost;
  }

  const result = await db.insert(fullPackageOrders).values({
    ...data,
    profitUsd: profit.toFixed(2),
  });
  const insertedId = Number(result[0].insertId);
  const inserted = await db.select().from(fullPackageOrders).where(eq(fullPackageOrders.id, insertedId));
  const order = inserted[0];

  // Mirror trackingNumbers[] (the JSON column) into the
  // fullPackageOrderTrackings join table so QuickRegister / BulkRegister and
  // every `getAllOrdersByTrackingNumber`-based lookup can find the order by
  // ANY of its trackings, not only the first one written to the legacy
  // single-tracking column. Silently ignored if the array is empty / absent.
  const list = (data.trackingNumbers as string[] | undefined) ?? [];
  if (Array.isArray(list) && list.length > 0) {
    try {
      await syncOrderTrackingsTable(insertedId, list, data.trackingNumber as string | undefined);
    } catch (err) {
      appLogger.warn("[FullPackage] Failed to mirror trackingNumbers JSON into multi-tracking table on create", {
        orderId: insertedId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return order;
}

/**
 * Mirror an order's `trackingNumbers` array (JSON column on the order row)
 * into the `fullPackageOrderTrackings` table. Idempotent — duplicates per
 * (orderId, trackingNumber) are silently skipped via the per-order
 * existence check inside the loop. The legacy single-tracking column
 * (`order.trackingNumber`) is included as carton 1 if present.
 *
 * Called from createFullPackageOrder / updateFullPackageOrder whenever
 * trackingNumbers changes, and once at startup as a backfill for orders
 * that were written before this sync existed.
 */
async function syncOrderTrackingsTable(
  fullPackageOrderId: number,
  trackingNumbers: string[],
  legacySingle?: string | null,
): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db) return { inserted: 0, skipped: 0 };
  // Build one ordered list with the legacy field as carton 1 (matching how
  // create flows have always populated it) and dedupe.
  const ordered: string[] = [];
  if (legacySingle && legacySingle.trim()) ordered.push(legacySingle.trim());
  for (const tn of trackingNumbers) {
    const t = (tn ?? "").trim();
    if (t && !ordered.includes(t)) ordered.push(t);
  }
  if (ordered.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < ordered.length; i++) {
    const tn = ordered[i];
    const dup = await db.select({ id: fullPackageOrderTrackings.id })
      .from(fullPackageOrderTrackings)
      .where(and(
        eq(fullPackageOrderTrackings.fullPackageOrderId, fullPackageOrderId),
        eq(fullPackageOrderTrackings.trackingNumber, tn),
      )).limit(1);
    if (dup.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(fullPackageOrderTrackings).values({
      fullPackageOrderId,
      trackingNumber: tn,
      cartonIndex: i + 1,
    });
    inserted++;
  }
  return { inserted, skipped };
}

/**
 * One-shot, idempotent backfill: walk every order, if its trackingNumbers
 * JSON is populated but the multi-tracking table has fewer rows for that
 * order than the JSON has entries, mirror the missing ones in. Safe to
 * run on every startup — uniqueness is enforced by the per-order existence
 * check inside syncOrderTrackingsTable.
 *
 * Fixes the historical bug where `create` / `update` wrote trackingNumbers
 * only to the JSON column on the order, leaving QuickRegister scans of
 * tracking #2, #3, ... with no way to resolve the order.
 */
export async function backfillTrackingsFromJson(): Promise<{
  ordersScanned: number;
  ordersTouched: number;
  trackingsInserted: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { ordersScanned: 0, ordersTouched: 0, trackingsInserted: 0, errors: 0 };

  // Fetch only orders whose trackingNumbers JSON has at least one element.
  // notDeleted is intentionally NOT applied — soft-deleted orders should
  // still have correct linkage in case they're restored later.
  const candidates = await db.select({
    id: fullPackageOrders.id,
    trackingNumber: fullPackageOrders.trackingNumber,
    trackingNumbers: fullPackageOrders.trackingNumbers,
  }).from(fullPackageOrders);

  let ordersTouched = 0;
  let trackingsInserted = 0;
  let errors = 0;
  for (const c of candidates) {
    const list = (c.trackingNumbers as string[] | null) ?? [];
    if ((!list || list.length === 0) && !c.trackingNumber) continue;
    try {
      const r = await syncOrderTrackingsTable(c.id, list ?? [], c.trackingNumber ?? undefined);
      if (r.inserted > 0) {
        ordersTouched++;
        trackingsInserted += r.inserted;
      }
    } catch (err) {
      errors++;
      appLogger.warn("[Backfill] trackings-json sync failed for order", {
        orderId: c.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { ordersScanned: candidates.length, ordersTouched, trackingsInserted, errors };
}

export async function getFullPackageOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Join with customers, suppliers, and batches to get full details
  const result = await db.select({
    order: fullPackageOrders,
    customer: customers,
    supplier: suppliers,
    batch: batches,
  })
  .from(fullPackageOrders)
  .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
  .leftJoin(suppliers, eq(fullPackageOrders.supplierId, suppliers.id))
  .leftJoin(batches, eq(fullPackageOrders.batchId, batches.id))
  .where(and(eq(fullPackageOrders.id, id), notDeleted))
  .limit(1);
  
  if (!result[0]) return undefined;
  
  return {
    ...result[0].order,
    customer: result[0].customer,
    supplier: result[0].supplier,
    batch: result[0].batch,
  };
}

export async function getAllFullPackageOrders(filters?: {
  customerId?: number;
  status?: string;
  hasBatch?: boolean;
  orderType?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  // Plan v3: every list query hides soft-deleted orders by default.
  // `any[]` matches the original implicit typing (the search branch pushes
  // `or(...)` which drizzle types as SQL | undefined).
  const conditions: any[] = [notDeleted];
  if (filters?.customerId) {
    conditions.push(eq(fullPackageOrders.customerId, filters.customerId));
  }
  if (filters?.status) {
    conditions.push(eq(fullPackageOrders.status, filters.status as any));
  }
  if (filters?.orderType) {
    conditions.push(eq(fullPackageOrders.orderType, filters.orderType as any));
  }
  if (filters?.hasBatch === true) {
    conditions.push(sql`${fullPackageOrders.batchId} IS NOT NULL`);
  }
  if (filters?.hasBatch === false) {
    conditions.push(isNull(fullPackageOrders.batchId));
  }
  if (filters?.search) {
    const rawSearch = filters.search.trim();
    const searchTerm = `%${rawSearch}%`;

    // Find customer IDs matching the search term (by fullName, customerCode, or mobileNumber)
    const matchingCustomers = await db.select({ id: customers.id })
      .from(customers)
      .where(or(
        like(customers.fullName, searchTerm),
        like(customers.customerCode, searchTerm),
        like(customers.mobileNumber, searchTerm),
      ));
    const matchingCustomerIds = matchingCustomers.map(c => c.id);

    // Find order IDs that have the tracking number in the multi-tracking table
    const matchingTrackingRows = await db.select({ fullPackageOrderId: fullPackageOrderTrackings.fullPackageOrderId })
      .from(fullPackageOrderTrackings)
      .where(like(fullPackageOrderTrackings.trackingNumber, searchTerm));
    const matchingOrderIdsFromTrackings = matchingTrackingRows.map(r => r.fullPackageOrderId);

    const orConditions: any[] = [
      like(fullPackageOrders.productName, searchTerm),
      like(fullPackageOrders.orderCode, searchTerm),
      like(fullPackageOrders.trackingNumber, searchTerm),
      like(fullPackageOrders.orderNumber, searchTerm),
    ];
    if (matchingCustomerIds.length > 0) {
      orConditions.push(inArray(fullPackageOrders.customerId, matchingCustomerIds));
    }
    if (matchingOrderIdsFromTrackings.length > 0) {
      orConditions.push(inArray(fullPackageOrders.id, matchingOrderIdsFromTrackings));
    }
    conditions.push(or(...orConditions));
  }
  
  // Query orders
  let ordersResult;
  if (conditions.length > 0) {
    ordersResult = await db.select().from(fullPackageOrders).where(and(...conditions)).orderBy(desc(fullPackageOrders.createdAt));
  } else {
    ordersResult = await db.select().from(fullPackageOrders).orderBy(desc(fullPackageOrders.createdAt));
  }
  
  // Fetch batch info for orders that have batchId
  const batchIds = ordersResult.filter(o => o.batchId).map(o => o.batchId as number);
  let batchMap: Record<number, any> = {};
  if (batchIds.length > 0) {
    const batchesResult = await db.select().from(batches).where(inArray(batches.id, batchIds));
    batchMap = Object.fromEntries(batchesResult.map(b => [b.id, b]));
  }
  
  // Fetch customer info for orders
  const customerIds = ordersResult.filter(o => o.customerId).map(o => o.customerId as number);
  let customerMap: Record<number, any> = {};
  if (customerIds.length > 0) {
    const customersResult = await db.select().from(customers).where(inArray(customers.id, customerIds));
    customerMap = Object.fromEntries(customersResult.map(c => [c.id, c]));
  }
  
  // Combine orders with batch and customer info
  return ordersResult.map(order => ({
    ...order,
    batch: order.batchId ? batchMap[order.batchId] : null,
    customer: order.customerId ? customerMap[order.customerId] : null,
  }));
}

export async function getFullPackageOrderByTrackingNumber(trackingNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const t = trackingNumber?.trim();
  if (!t) return undefined;

  // First check new multi-tracking table
  const fromTrackings = await db.select({ fullPackageOrderId: fullPackageOrderTrackings.fullPackageOrderId })
    .from(fullPackageOrderTrackings)
    .where(eq(fullPackageOrderTrackings.trackingNumber, t))
    .limit(1);
  if (fromTrackings.length > 0) {
    const order = await getFullPackageOrderById(fromTrackings[0].fullPackageOrderId);
    return order ?? undefined;
  }

  // Fallback: legacy single tracking on order
  const result = await db.select().from(fullPackageOrders)
    .where(and(eq(fullPackageOrders.trackingNumber, t), notDeleted))
    .limit(1);
  return result[0];
}

/**
 * Find a non-deleted order that already uses the given (supplier) order number.
 * Used to enforce order-number uniqueness on create/edit. Pass `excludeId` to
 * ignore the order being edited. Returns undefined when the number is free or
 * blank (blank order numbers are never treated as duplicates).
 */
export async function getFullPackageOrderByOrderNumber(
  orderNumber: string,
  excludeId?: number,
): Promise<FullPackageOrder | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const n = orderNumber?.trim();
  if (!n) return undefined;

  const conditions: any[] = [eq(fullPackageOrders.orderNumber, n), notDeleted];
  if (excludeId !== undefined) conditions.push(ne(fullPackageOrders.id, excludeId));

  const result = await db.select().from(fullPackageOrders)
    .where(and(...conditions))
    .limit(1);
  return result[0];
}

/**
 * Get ALL orders linked to a tracking number (for shared tracking / same carton).
 * Unlike getFullPackageOrderByTrackingNumber which returns only the first match,
 * this returns every order sharing the tracking number.
 */
export async function getAllOrdersByTrackingNumber(trackingNumber: string): Promise<FullPackageOrder[]> {
  const db = await getDb();
  if (!db) return [];
  const t = trackingNumber?.trim();
  if (!t) return [];

  const orderIdSet: Record<number, true> = {};

  // Check multi-tracking table
  const fromTrackings = await db.select({ fullPackageOrderId: fullPackageOrderTrackings.fullPackageOrderId })
    .from(fullPackageOrderTrackings)
    .where(eq(fullPackageOrderTrackings.trackingNumber, t));
  for (const row of fromTrackings) {
    orderIdSet[row.fullPackageOrderId] = true;
  }

  // Fallback: legacy single tracking on order
  const fromLegacy = await db.select({ id: fullPackageOrders.id })
    .from(fullPackageOrders)
    .where(and(eq(fullPackageOrders.trackingNumber, t), notDeleted));
  for (const row of fromLegacy) {
    orderIdSet[row.id] = true;
  }

  const orderIds = Object.keys(orderIdSet).map(Number);
  if (orderIds.length === 0) return [];

  const orders: FullPackageOrder[] = [];
  for (const oid of orderIds) {
    const order = await getFullPackageOrderById(oid);
    if (order) orders.push(order);
  }
  return orders;
}

export async function getOrdersByBatchId(batchId: number): Promise<FullPackageOrder[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select()
    .from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.batchId, batchId),
      isNotNull(fullPackageOrders.trackingNumber),
      notDeleted,
    ));
  const orders: FullPackageOrder[] = [];
  for (const row of results) {
    const order = await getFullPackageOrderById(row.id);
    if (order) orders.push(order);
  }
  return orders;
}

// ---------- Multi-tracking per order ----------

export async function getOrderTrackings(fullPackageOrderId: number): Promise<FullPackageOrderTracking[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fullPackageOrderTrackings)
    .where(eq(fullPackageOrderTrackings.fullPackageOrderId, fullPackageOrderId))
    .orderBy(asc(fullPackageOrderTrackings.cartonIndex), asc(fullPackageOrderTrackings.id));
}

export async function orderHasAnyTracking(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const order = await getFullPackageOrderById(orderId);
  if (!order) return false;
  if (order.trackingNumber && order.trackingNumber.trim() !== "") return true;
  const rows = await db.select({ id: fullPackageOrderTrackings.id })
    .from(fullPackageOrderTrackings)
    .where(eq(fullPackageOrderTrackings.fullPackageOrderId, orderId))
    .limit(1);
  return rows.length > 0;
}

export async function addOrderTrackings(
  fullPackageOrderId: number,
  trackingNumbers: string[],
  options?: { setOrderStatus?: boolean }
): Promise<{ added: number; duplicates: string[] }> {
  const db = await getDb();
  if (!db) return { added: 0, duplicates: [] };
  const order = await getFullPackageOrderById(fullPackageOrderId);
  if (!order) return { added: 0, duplicates: trackingNumbers };

  const trimmed = trackingNumbers.map((s) => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(trimmed));
  let added = 0;
  const duplicates: string[] = [];

  for (let i = 0; i < unique.length; i++) {
    const tr = unique[i];
    // Only skip if this SAME ORDER already has this tracking (prevent self-duplicate)
    // Allow shared tracking across DIFFERENT orders (same carton scenario)
    const existingForThisOrder = await db.select().from(fullPackageOrderTrackings)
      .where(and(
        eq(fullPackageOrderTrackings.trackingNumber, tr),
        eq(fullPackageOrderTrackings.fullPackageOrderId, fullPackageOrderId)
      )).limit(1);
    if (existingForThisOrder.length > 0) {
      duplicates.push(tr);
      continue;
    }
    await db.insert(fullPackageOrderTrackings).values({
      fullPackageOrderId,
      trackingNumber: tr,
      cartonIndex: i + 1,
    });
    added++;
  }

  if (added > 0 && options?.setOrderStatus !== false) {
    const updateData: Record<string, unknown> = { trackingAddedDate: new Date() };
    if (!order.trackingNumber || order.trackingNumber.trim() === "") {
      updateData.trackingNumber = unique[0] ?? null; // keep first in legacy field for compat
    }
    if (order.status === "ordered") {
      updateData.status = "tracking_added";
    }
    await db.update(fullPackageOrders).set(updateData as any).where(eq(fullPackageOrders.id, fullPackageOrderId));
  }

  return { added, duplicates };
}

export async function removeOrderTracking(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select().from(fullPackageOrderTrackings).where(eq(fullPackageOrderTrackings.id, id)).limit(1);
  if (!row) return false;
  await db.delete(fullPackageOrderTrackings).where(eq(fullPackageOrderTrackings.id, id));
  return true;
}

/** Order IDs that have at least one row in fullPackageOrderTrackings */
async function getOrderIdsWithMultiTracking(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ id: fullPackageOrderTrackings.fullPackageOrderId }).from(fullPackageOrderTrackings);
  return rows.map((r) => r.id);
}

export async function updateFullPackageOrder(id: number, data: Partial<InsertFullPackageOrder>, userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Always get existing order first
  const existing = await getFullPackageOrderById(id);
  if (!existing) return undefined;
  
  // Check if status is changing to delivered and charge customer
  const isBeingDelivered = data.status === 'delivered' && existing.status !== 'delivered';
  const shouldCharge = isBeingDelivered && !existing.isCharged && existing.customerId;
  
  // UNIFIED FINANCIAL MODEL:
  // Full Package & Purchase Request: Customer pays sellingPriceUsd (final price) ONLY
  // Shipping cost is OUR cost, deducted from profit, NOT charged to customer
  // Commission: Customer pays itemPrice + commissionFee, shipping is our cost
  
  // Derive the shipping cost from the batch whenever an order is (re)assigned
  // to a batch. Every batch-assignment path (order edit, updateStatus, the
  // package→order sync in packages.db) funnels through here, so this is the
  // single place the batch rate reliably lands on the order.
  //
  //  • rate    = getCustomerPriceInBatch — the customer's own price in the
  //              batch first, else the batch's default per-kg/per-cbm rate.
  //  • unit    = cbm for sea, kg otherwise.
  //  • weight  = chargeable weight = max(actual, volumetric) for air, where
  //              volumetric = L×W×H ÷ 6000 (same formula as Quick Register /
  //              the batch + delivery math); volumeCbm for sea.
  //
  // Skipped when the caller set shippingCostUsd explicitly (delivery / split
  // flows keep control) or the order is already delivered. Removing the batch
  // (batchId = null) zeroes the shipping cost.
  if (
    data.batchId !== undefined &&
    data.shippingCostUsd === undefined &&
    existing.status !== 'delivered'
  ) {
    if (data.batchId === null) {
      data.shippingCostUsd = '0';
    } else {
      const customerId = data.customerId ?? existing.customerId;
      if (customerId) {
        const shippingType = (data.shippingType ?? existing.shippingType) ?? null;
        const unit: 'kg' | 'cbm' = shippingType === 'sea' ? 'cbm' : 'kg';
        const rate = await getCustomerPriceInBatch(data.batchId, customerId, unit);
        if (rate && rate > 0) {
          let chargeable = 0;
          if (unit === 'cbm') {
            chargeable = Number(data.volumeCbm ?? existing.volumeCbm ?? 0) || 0;
          } else {
            const actual = Number(data.weightKg ?? existing.weightKg ?? 0) || 0;
            const L = Number(data.dimensionLength ?? existing.dimensionLength ?? 0) || 0;
            const W = Number(data.dimensionWidth ?? existing.dimensionWidth ?? 0) || 0;
            const H = Number(data.dimensionHeight ?? existing.dimensionHeight ?? 0) || 0;
            const volumetric = (L * W * H) / 6000;
            chargeable = Math.max(actual, volumetric);
          }
          if (chargeable > 0) {
            data.shippingCostUsd = (rate * chargeable).toFixed(2);
            appLogger.info('[FullPackage] Derived shipping cost from batch on assignment', {
              orderId: id, batchId: data.batchId, unit, rate, chargeable, shippingCostUsd: data.shippingCostUsd,
            });
          }
        }
      }
    }
  }

  // Recalculate profit if pricing fields changed
  if (data.purchasePriceUsd !== undefined || data.sellingPriceUsd !== undefined || data.itemPriceUsd !== undefined || data.commissionFeeUsd !== undefined || data.quantity !== undefined || data.shippingCostUsd !== undefined || data.orderType !== undefined) {
    const orderType = data.orderType ?? existing.orderType;
    const shippingCost = parseFloat(data.shippingCostUsd as string ?? existing.shippingCostUsd ?? "0") || 0;
    const quantity = data.quantity ?? existing.quantity ?? 1;
    
    let profit = 0;
    
    if (orderType === 'full_package' || orderType === 'purchase_request') {
      // Full Package & Purchase Request use SAME formula:
      // profit = (sellingPrice - purchasePrice) * quantity - shippingCost
      // Customer pays sellingPriceUsd only, shipping is our cost
      const purchasePrice = parseFloat(data.purchasePriceUsd as string ?? existing.purchasePriceUsd ?? "0") || 0;
      const sellingPrice = parseFloat(data.sellingPriceUsd as string ?? existing.sellingPriceUsd ?? "0") || 0;
      profit = ((sellingPrice - purchasePrice) * quantity) - shippingCost;
    } else if (orderType === 'commission') {
      // Commission: profit = commissionFee - shippingCost
      const commissionFee = parseFloat(data.commissionFeeUsd as string ?? existing.commissionFeeUsd ?? "0") || 0;
      profit = commissionFee - shippingCost;
    }
    
    data.profitUsd = profit.toFixed(2);
  }
  
  // Apply charge if being delivered
  // IMPORTANT: Only charge sellingPriceUsd (final price) to customer
  // Shipping cost is NOT charged separately - it's deducted from our profit
  if (shouldCharge && userId) {
    const customer = await getCustomerById(existing.customerId!);
    if (customer) {
      const orderType = data.orderType ?? existing.orderType;
      let chargeAmount = 0;
      
      if (orderType === 'full_package' || orderType === 'purchase_request') {
        // Customer pays the final selling price × quantity
        // sellingPriceUsd is stored as PER-UNIT price
        const sellingPricePerUnit = parseFloat(data.sellingPriceUsd as string ?? existing.sellingPriceUsd ?? '0');
        const qty = data.quantity ?? existing.quantity ?? 1;
        chargeAmount = sellingPricePerUnit * qty;
      } else if (orderType === 'commission') {
        // Commission: Customer pays (itemPrice × quantity) + commissionFee (prepaid)
        // itemPriceUsd is PER-UNIT
        const itemPricePerUnit = parseFloat(data.itemPriceUsd as string ?? existing.itemPriceUsd ?? '0');
        const commissionFee = parseFloat(data.commissionFeeUsd as string ?? existing.commissionFeeUsd ?? '0');
        const qty = data.quantity ?? existing.quantity ?? 1;
        chargeAmount = (itemPricePerUnit * qty) + commissionFee;
      }
      
      if (chargeAmount > 0) {
        const chargeType = orderType === 'full_package' ? 'FULL_PACKAGE' :
                          orderType === 'purchase_request' ? 'PURCHASE_REQUEST' :
                          orderType === 'commission' ? 'COMMISSION' : 'SERVICE';
        
        const qty = data.quantity ?? existing.quantity ?? 1;
        const perUnitPrice = chargeAmount / qty;

        const deliveryChargeResult = await applyCharge(
          existing.customerId!,
          customer.customerCode,
          chargeType as any,
          existing.id,
          chargeAmount,
          `${orderType === 'full_package' ? 'Full Package' :
             orderType === 'purchase_request' ? 'Purchase Request' :
             'Commission'} Order ${existing.orderCode} delivered - Final Price: $${chargeAmount.toFixed(2)}`,
          userId,
          [{
            description: `${existing.productName || 'Product'} (${existing.orderCode})`,
            quantity: qty,
            unitPrice: perUnitPrice,
            total: chargeAmount,
          }]
        );

        data.isCharged = true;
        data.chargedToAccountAt = new Date();
        // Plan v3: persist the DEBIT transaction id so future edit/delete
        // can reverse/adjust the EXACT original charge. Only set if not
        // already set (protects against accidental overwrite).
        if (!existing.chargeTransactionId) {
          data.chargeTransactionId = deliveryChargeResult.transaction.id;
        }
      }
    }
  }

  // Plan v3: bump the OCC version on every write so stale client updates
  // are rejected with CONFLICT at the router layer. Never written by caller
  // directly — we override any incoming value.
  (data as any).version = (existing.version ?? 1) + 1;

  await db.update(fullPackageOrders).set(data).where(eq(fullPackageOrders.id, id));

  // Whenever the trackingNumbers JSON or the legacy single trackingNumber
  // changes, mirror the resulting list into fullPackageOrderTrackings so
  // every tracking is searchable via the multi-tracking lookup paths.
  // Skip when the caller didn't touch tracking fields, to avoid extra
  // writes on price-only / status-only updates.
  if (data.trackingNumbers !== undefined || data.trackingNumber !== undefined) {
    try {
      const refreshed = await db.select({
        trackingNumber: fullPackageOrders.trackingNumber,
        trackingNumbers: fullPackageOrders.trackingNumbers,
      }).from(fullPackageOrders).where(eq(fullPackageOrders.id, id)).limit(1);
      const list = (refreshed[0]?.trackingNumbers as string[] | null) ?? [];
      const single = refreshed[0]?.trackingNumber ?? undefined;
      if (list.length > 0 || single) {
        await syncOrderTrackingsTable(id, list ?? [], single);
      }
    } catch (err) {
      appLogger.warn("[FullPackage] Failed to mirror trackingNumbers JSON into multi-tracking table on update", {
        orderId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return getFullPackageOrderById(id);
}

export async function deleteFullPackageOrder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(fullPackageOrders).where(eq(fullPackageOrders.id, id));
}

/**
 * Plan v3, Phase 3 — soft-delete an order.
 *
 * Never hard-deletes (that would lose audit history and break revenue/ledger
 * reconciliation). Sets deletedAt, deletedById, deletionReason, bumps version.
 * All read helpers already filter on `deletedAt IS NULL`, so deleted orders
 * disappear from listings but stay in the DB for forensics.
 */
export async function softDeleteFullPackageOrder(
  id: number,
  deletedById: number,
  reason: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getFullPackageOrderById(id);
  if (!existing) return;
  if (existing.deletedAt) return; // already deleted — idempotent
  await db.update(fullPackageOrders)
    .set({
      deletedAt: new Date(),
      deletedById,
      deletionReason: reason,
      status: 'cancelled', // reflect in any legacy UI that still queries by status
      version: (existing.version ?? 1) + 1,
    } as any)
    .where(eq(fullPackageOrders.id, id));
}

/**
 * Plan v3, Phase 3 — compute the customer-facing charge amount for an order.
 *
 * This is the single source of truth for "what should the customer owe on
 * this order?" and is used by the update mutation to decide if the ledger
 * needs an ADJUSTMENT via adjustCharge().
 *
 * Must match the logic in applyCharge-at-delivery (see updateFullPackageOrder
 * above) and the logic in create/approveQuote/createCommissionOrder in the
 * router. If you change the formula, change it EVERYWHERE or the ledger will
 * drift.
 *
 * Returns 0 for orders that aren't yet at a "chargeable" state (e.g.
 * pending_quote purchase_request without a selling price).
 */
export function computeOrderChargeAmount(order: {
  orderType: string;
  sellingPriceUsd?: string | null;
  itemPriceUsd?: string | null;
  commissionFeeUsd?: string | null;
  quantity?: number | null;
}): number {
  const qty = order.quantity ?? 1;
  if (order.orderType === 'full_package' || order.orderType === 'purchase_request') {
    const selling = parseFloat(String(order.sellingPriceUsd ?? '0')) || 0;
    return selling * qty;
  }
  if (order.orderType === 'commission') {
    const itemPrice = parseFloat(String(order.itemPriceUsd ?? '0')) || 0;
    const commission = parseFloat(String(order.commissionFeeUsd ?? '0')) || 0;
    return (itemPrice * qty) + commission;
  }
  return 0;
}

// Get full package orders by customer (for customer portal)
export async function getFullPackageOrdersByCustomer(customerId: number, filters?: {
  orderType?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(fullPackageOrders.customerId, customerId), notDeleted];

  if (filters?.orderType) {
    conditions.push(eq(fullPackageOrders.orderType, filters.orderType as any));
  }
  if (filters?.status) {
    conditions.push(eq(fullPackageOrders.status, filters.status as any));
  }

  return db.select().from(fullPackageOrders)
    .where(and(...conditions))
    .orderBy(desc(fullPackageOrders.createdAt));
}

// Get orders that need tracking reminder (ordered > 10 days ago, no tracking number)
export async function getOrdersNeedingTrackingReminder() {
  const db = await getDb();
  if (!db) return [];
  
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  
  return db.select().from(fullPackageOrders).where(
    and(
      eq(fullPackageOrders.status, "ordered"),
      isNull(fullPackageOrders.trackingNumber),
      lte(fullPackageOrders.orderDate, tenDaysAgo),
      eq(fullPackageOrders.trackingReminderSent, false),
      notDeleted,
    )
  ).orderBy(fullPackageOrders.orderDate);
}

// Mark reminder as sent
export async function markTrackingReminderSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(fullPackageOrders).set({ trackingReminderSent: true }).where(eq(fullPackageOrders.id, id));
}

// Get profit summary
export async function getFullPackageProfitSummary(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { totalProfit: 0, totalOrders: 0, totalRevenue: 0, totalCost: 0 };
  
  const conditions = [eq(fullPackageOrders.status, "delivered")];
  if (startDate) {
    conditions.push(gte(fullPackageOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(fullPackageOrders.createdAt, endDate));
  }
  
  const result = await db.select({
    totalProfit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(sellingPriceUsd * quantity), 0)`,
    totalCost: sql<number>`COALESCE(SUM(purchasePriceUsd * quantity + COALESCE(shippingCostUsd, 0)), 0)`,
  }).from(fullPackageOrders).where(and(...conditions));
  
  return result[0] || { totalProfit: 0, totalOrders: 0, totalRevenue: 0, totalCost: 0 };
}

// Get profit summary by order type
export async function getFullPackageProfitSummaryByType(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { byType: [], total: { totalProfit: 0, totalOrders: 0, totalRevenue: 0, totalCost: 0 } };
  
  const conditions = [eq(fullPackageOrders.status, "delivered")];
  if (startDate) {
    conditions.push(gte(fullPackageOrders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(fullPackageOrders.createdAt, endDate));
  }
  
  // Group by order type
  const byType = await db.select({
    orderType: fullPackageOrders.orderType,
    totalProfit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN orderType = 'full_package' THEN sellingPriceUsd * quantity WHEN orderType = 'commission' THEN commissionFeeUsd ELSE itemPriceUsd * quantity END), 0)`,
    totalCost: sql<number>`COALESCE(SUM(CASE WHEN orderType = 'full_package' THEN purchasePriceUsd * quantity ELSE itemPriceUsd * quantity END + COALESCE(shippingCostUsd, 0)), 0)`,
    avgProfit: sql<number>`COALESCE(AVG(profitUsd), 0)`,
  }).from(fullPackageOrders)
    .where(and(...conditions))
    .groupBy(fullPackageOrders.orderType);
  
  // Calculate total across all types
  const total = byType.reduce((acc, curr) => ({
    totalProfit: acc.totalProfit + parseFloat(curr.totalProfit?.toString() || '0'),
    totalOrders: acc.totalOrders + parseFloat(curr.totalOrders?.toString() || '0'),
    totalRevenue: acc.totalRevenue + parseFloat(curr.totalRevenue?.toString() || '0'),
    totalCost: acc.totalCost + parseFloat(curr.totalCost?.toString() || '0'),
  }), { totalProfit: 0, totalOrders: 0, totalRevenue: 0, totalCost: 0 });
  
  return { byType, total };
}


// ============ TRACKING ALERT SYSTEM ============

// Get orders pending tracking (ordered but no tracking number)
// Excludes orders that have any tracking: legacy field OR rows in fullPackageOrderTrackings
export async function getOrdersPendingTracking() {
  const db = await getDb();
  if (!db) return [];
  
  const excludedStatuses: ("cancelled" | "refunded" | "returned" | "delivered")[] = ["cancelled", "refunded", "returned", "delivered"];
  const withMultiTracking = await getOrderIdsWithMultiTracking();
  
  const candidates = await db.select().from(fullPackageOrders).where(
    and(
      notInArray(fullPackageOrders.status, excludedStatuses),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      ),
      notDeleted,
    )
  ).orderBy(fullPackageOrders.createdAt);

  return candidates.filter((o) => !withMultiTracking.includes(o.id));
}

// Get orders by alert level
export async function getOrdersByAlertLevel(alertLevel: "warning" | "urgent" | "critical") {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(fullPackageOrders).where(
    and(
      eq(fullPackageOrders.alertLevel, alertLevel),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      ),
      notDeleted,
    )
  ).orderBy(fullPackageOrders.orderDate);
}

// Update alert level for an order
export async function updateOrderAlertLevel(id: number, alertLevel: "none" | "warning" | "urgent" | "critical") {
  const db = await getDb();
  if (!db) return;
  
  await db.update(fullPackageOrders).set({
    alertLevel,
    lastAlertSentAt: new Date(),
    alertCount: sql`alertCount + 1`
  }).where(eq(fullPackageOrders.id, id));
}

// Get tracking alert statistics (only orders with no tracking at all)
export async function getTrackingAlertStats() {
  const db = await getDb();
  if (!db) return { warning: 0, urgent: 0, critical: 0, total: 0 };
  
  const excludedStatuses: ("cancelled" | "refunded" | "returned" | "delivered")[] = ["cancelled", "refunded", "returned", "delivered"];
  const withMultiTracking = await getOrderIdsWithMultiTracking();
  
  const candidates = await db.select().from(fullPackageOrders).where(
    and(
      notInArray(fullPackageOrders.status, excludedStatuses),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      ),
      notDeleted,
    )
  );
  const orders = candidates.filter((o) => !withMultiTracking.includes(o.id));
  
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let warning = 0, urgent = 0, critical = 0;
  
  for (const order of orders) {
    const dateToCheck = order.orderDate || order.createdAt;
    if (!dateToCheck) continue;
    const orderDate = new Date(dateToCheck);
    if (orderDate <= sevenDaysAgo) critical++;
    else if (orderDate <= fiveDaysAgo) urgent++;
    else if (orderDate <= threeDaysAgo) warning++;
  }
  
  return { warning, urgent, critical, total: orders.length };
}

// Process and update all alert levels (only orders with no tracking)
export async function processTrackingAlerts() {
  const db = await getDb();
  if (!db) return { updated: 0 };
  
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const withMultiTracking = await getOrderIdsWithMultiTracking();
  
  const candidates = await db.select().from(fullPackageOrders).where(
    and(
      eq(fullPackageOrders.status, "ordered"),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      ),
      notDeleted,
    )
  );
  const orders = candidates.filter((o) => !withMultiTracking.includes(o.id));
  
  let updated = 0;
  
  for (const order of orders) {
    if (!order.orderDate) continue;
    const orderDate = new Date(order.orderDate);
    
    let newAlertLevel: "none" | "warning" | "urgent" | "critical" = "none";
    
    if (orderDate <= sevenDaysAgo) {
      newAlertLevel = "critical";
    } else if (orderDate <= fiveDaysAgo) {
      newAlertLevel = "urgent";
    } else if (orderDate <= threeDaysAgo) {
      newAlertLevel = "warning";
    }
    
    if (newAlertLevel !== "none" && order.alertLevel !== newAlertLevel) {
      await db.update(fullPackageOrders).set({
        alertLevel: newAlertLevel,
        lastAlertSentAt: now
      }).where(eq(fullPackageOrders.id, order.id));
      updated++;
    }
  }
  
  return { updated };
}

// Get supplier performance (average days to provide tracking)
export async function getSupplierTrackingPerformance() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    supplierId: fullPackageOrders.supplierId,
    totalOrders: sql<number>`COUNT(*)`,
    ordersWithTracking: sql<number>`SUM(CASE WHEN trackingNumber IS NOT NULL AND trackingNumber != '' THEN 1 ELSE 0 END)`,
    ordersWithoutTracking: sql<number>`SUM(CASE WHEN trackingNumber IS NULL OR trackingNumber = '' THEN 1 ELSE 0 END)`,
    avgDaysToTracking: sql<number>`AVG(CASE WHEN trackingAddedDate IS NOT NULL AND orderDate IS NOT NULL THEN DATEDIFF(trackingAddedDate, orderDate) ELSE NULL END)`,
  }).from(fullPackageOrders)
    .where(isNotNull(fullPackageOrders.supplierId))
    .groupBy(fullPackageOrders.supplierId);
  
  return result;
}


// ============ SUPPLIERS OPERATIONS ============

export async function createSupplier(data: InsertSupplier): Promise<Supplier> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  const inserted = await db.select().from(suppliers).where(eq(suppliers.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getSupplierById(id: number): Promise<Supplier | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0];
}

export async function getAllSuppliers(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(desc(suppliers.createdAt));
  }
  return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
  return getSupplierById(id);
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
}

export async function updateSupplierStats(supplierId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Calculate total orders and total spent for this supplier
  const stats = await db.select({
    totalOrders: sql<number>`COUNT(*)`,
    totalSpent: sql<number>`COALESCE(SUM(purchasePriceUsd * quantity), 0)`,
  }).from(fullPackageOrders).where(eq(fullPackageOrders.supplierId, supplierId));
  
  if (stats[0]) {
    await db.update(suppliers).set({
      totalOrders: stats[0].totalOrders,
      totalSpentUsd: String(stats[0].totalSpent),
    }).where(eq(suppliers.id, supplierId));
  }
}


// ============ FULL PACKAGE STATUS HISTORY OPERATIONS ============

export async function createFullPackageStatusHistory(data: InsertFullPackageStatusHistory): Promise<FullPackageStatusHistory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fullPackageStatusHistory).values(data);
  const inserted = await db.select().from(fullPackageStatusHistory).where(eq(fullPackageStatusHistory.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getFullPackageStatusHistoryByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fullPackageStatusHistory)
    .where(eq(fullPackageStatusHistory.orderId, orderId))
    .orderBy(desc(fullPackageStatusHistory.createdAt));
}


// ============ PURCHASE REQUESTS (Full Package Orders from Customer Portal) ============

// Generate unique request code


// Search tracking number in all order types (full_package, purchase_request, commission)
export async function searchTrackingInAllOrderTypes(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;

  // Check in fullPackageOrders (single tracking field).
  // leftJoin users purely to surface the name of the staff member who
  // created the order (display-only; no effect on any lookup logic).
  let order = await db.select({
    order: fullPackageOrders,
    customer: customers,
    creatorName: users.name
  })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
    .leftJoin(users, eq(fullPackageOrders.createdById, users.id))
    .where(and(eq(fullPackageOrders.trackingNumber, trackingNumber), notDeleted))
    .limit(1);

  // Also check fullPackageOrderTrackings (multiple trackings per order)
  if (order.length === 0) {
    const trackingRow = await db.select({ fullPackageOrderId: fullPackageOrderTrackings.fullPackageOrderId })
      .from(fullPackageOrderTrackings)
      .where(eq(fullPackageOrderTrackings.trackingNumber, trackingNumber))
      .limit(1);

    if (trackingRow.length > 0) {
      order = await db.select({
        order: fullPackageOrders,
        customer: customers,
        creatorName: users.name
      })
        .from(fullPackageOrders)
        .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
        .leftJoin(users, eq(fullPackageOrders.createdById, users.id))
        .where(and(eq(fullPackageOrders.id, trackingRow[0].fullPackageOrderId), notDeleted))
        .limit(1);
    }
  }

  if (order.length > 0) {
    return {
      found: true,
      source: order[0].order.orderType as "full_package" | "purchase_request" | "commission",
      order: order[0].order,
      customer: order[0].customer,
      createdByName: order[0].creatorName ?? null,
      package: null
    };
  }
  
  // Then check in packages table - use customers table
  const pkg = await db.select({
    package: packages,
    customer: customers
  })
    .from(packages)
    .leftJoin(customers, eq(packages.customerId, customers.id))
    .where(eq(packages.trackingNumber, trackingNumber))
    .limit(1);
  
  if (pkg.length > 0) {
    return {
      found: true,
      source: "package" as const,
      order: null,
      customer: pkg[0].customer,
      package: pkg[0].package
    };
  }
  
  return {
    found: false,
    source: null,
    order: null,
    customer: null,
    package: null
  };
}

/**
 * Customer-level registration progress across their commission + full_package
 * orders. DISPLAY-ONLY (Quick Register shows how many of a customer's orders
 * have fully arrived / been registered vs. how many are still expected). This
 * function only reads — it never mutates any order or status.
 *
 * "Registered" reuses the same definition as getOrderCartonStatus: an order
 * counts as registered when it owns at least one tracking and EVERY one of
 * those trackings already has a package row. Orders with no tracking yet count
 * as remaining. purchase_request / self-order is excluded (we don't know how
 * many pieces the customer bought), as are terminal orders
 * (delivered / cancelled / refunded / returned).
 */
export async function getCustomerOrderRegistrationProgress(customerId: number): Promise<{
  total: number;
  registered: number;
  remaining: number;
  allRegistered: boolean;
}> {
  const db = await getDb();
  if (!db) return { total: 0, registered: 0, remaining: 0, allRegistered: false };

  // Active commission + full_package orders owned by this customer.
  const orders = await db.select({
    id: fullPackageOrders.id,
    trackingNumber: fullPackageOrders.trackingNumber,
  })
    .from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.customerId, customerId),
      inArray(fullPackageOrders.orderType, ["commission", "full_package"]),
      notInArray(fullPackageOrders.status, ["delivered", "cancelled", "refunded", "returned"]),
      notDeleted,
    ));

  if (orders.length === 0) {
    return { total: 0, registered: 0, remaining: 0, allRegistered: false };
  }

  const orderIds = orders.map((o) => o.id);

  // Every tracking each order owns: multi-tracking table + legacy field.
  // Plain arrays/records (not Map/Set for-of) to avoid downlevelIteration.
  const orderTrackings: Record<number, string[]> = {};
  for (const o of orders) {
    orderTrackings[o.id] = o.trackingNumber ? [o.trackingNumber.trim()] : [];
  }
  const trackingRows = await db.select({
    orderId: fullPackageOrderTrackings.fullPackageOrderId,
    trackingNumber: fullPackageOrderTrackings.trackingNumber,
  })
    .from(fullPackageOrderTrackings)
    .where(inArray(fullPackageOrderTrackings.fullPackageOrderId, orderIds));
  for (const r of trackingRows) {
    if (!r.trackingNumber) continue;
    (orderTrackings[r.orderId] ||= []).push(r.trackingNumber.trim());
  }

  // Which of all those trackings already have a registered package.
  const allTrackings = new Set<string>();
  for (const id of orderIds) for (const t of orderTrackings[id] || []) allTrackings.add(t);
  const registeredTrackings = new Set<string>();
  if (allTrackings.size > 0) {
    const existing = await db.select({ tn: packages.trackingNumber })
      .from(packages)
      .where(inArray(packages.trackingNumber, Array.from(allTrackings)));
    for (const r of existing) if (r.tn) registeredTrackings.add(r.tn.trim());
  }

  // An order is registered when it has ≥1 tracking and all are registered.
  let registered = 0;
  for (const id of orderIds) {
    const list = orderTrackings[id] || [];
    if (list.length > 0 && list.every((t) => registeredTrackings.has(t))) {
      registered++;
    }
  }

  const total = orders.length;
  const remaining = total - registered;
  return { total, registered, remaining, allRegistered: total > 0 && remaining === 0 };
}
