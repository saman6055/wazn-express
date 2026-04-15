import { getDb } from './connection';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { getCustomerById } from './customers.db';
import { applyCharge } from './finance.db';
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
  const inserted = await db.select().from(fullPackageOrders).where(eq(fullPackageOrders.id, Number(result[0].insertId)));
  return inserted[0];
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
  .where(eq(fullPackageOrders.id, id))
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
  
  const conditions = [];
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
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(fullPackageOrders.productName, searchTerm),
        like(fullPackageOrders.orderCode, searchTerm),
        like(fullPackageOrders.trackingNumber, searchTerm)
      )
    );
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
    .where(eq(fullPackageOrders.trackingNumber, t))
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
    .where(eq(fullPackageOrders.trackingNumber, t));
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
      isNotNull(fullPackageOrders.trackingNumber)
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

        await applyCharge(
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
      }
    }
  }
  
  await db.update(fullPackageOrders).set(data).where(eq(fullPackageOrders.id, id));
  return getFullPackageOrderById(id);
}

export async function deleteFullPackageOrder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(fullPackageOrders).where(eq(fullPackageOrders.id, id));
}

// Get full package orders by customer (for customer portal)
export async function getFullPackageOrdersByCustomer(customerId: number, filters?: {
  orderType?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(fullPackageOrders.customerId, customerId)];
  
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
      eq(fullPackageOrders.trackingReminderSent, false)
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
      )
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
      )
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
      )
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
      )
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

  // Check in fullPackageOrders (single tracking field)
  let order = await db.select({
    order: fullPackageOrders,
    customer: customers
  })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
    .where(eq(fullPackageOrders.trackingNumber, trackingNumber))
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
        customer: customers
      })
        .from(fullPackageOrders)
        .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
        .where(eq(fullPackageOrders.id, trackingRow[0].fullPackageOrderId))
        .limit(1);
    }
  }

  if (order.length > 0) {
    return {
      found: true,
      source: order[0].order.orderType as "full_package" | "purchase_request" | "commission",
      order: order[0].order,
      customer: order[0].customer,
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
