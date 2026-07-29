import { getDb } from './connection';
import { appLogger } from '../utils/logger';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { getTotalDebtAmount } from './finance.db';
import { getDeliveryBoxProfitBreakdown } from './deliveryBoxes.db';
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

// ============ REPORTING HELPERS ============

export async function getRevenueByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  // Use unified ledgerTransactions table
  return db.select({
    date: sql<string>`DATE(${ledgerTransactions.createdAt})`,
    totalRevenue: sql<number>`SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END)`,
    totalPayments: sql<number>`SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'CREDIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END)`,
  }).from(ledgerTransactions)
    .where(and(gte(ledgerTransactions.createdAt, startDate), lte(ledgerTransactions.createdAt, endDate)))
    .groupBy(sql`DATE(${ledgerTransactions.createdAt})`)
    .orderBy(sql`DATE(${ledgerTransactions.createdAt})`);
}

export async function getPackageCountByStatus() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select({
      status: packages.status,
      count: sql<number>`COUNT(*)`,
    }).from(packages).groupBy(packages.status);
  } catch (err) {
    appLogger.error("getPackageCountByStatus failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function getCustomersWithBalance() {
  const db = await getDb();
  if (!db) return [];
  
  // Use unified customerAccounts table for balance
  return db.select({
    customer: customers,
    balance: customerAccounts.currentBalanceUsd,
  }).from(customers)
    .leftJoin(customerAccounts, eq(customers.id, customerAccounts.customerId));
}



// ============ FULL PACKAGE REPORTS ============

export async function getFullPackageProfitBySupplier(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(fullPackageOrders.status, "delivered")];
  if (startDate) conditions.push(gte(fullPackageOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(fullPackageOrders.createdAt, endDate));
  
  return db.select({
    supplierId: fullPackageOrders.supplierId,
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(sellingPriceUsd * quantity), 0)`,
    totalCost: sql<number>`COALESCE(SUM(purchasePriceUsd * quantity + COALESCE(shippingCostUsd, 0)), 0)`,
    totalProfit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
  }).from(fullPackageOrders)
    .where(and(...conditions))
    .groupBy(fullPackageOrders.supplierId);
}

export async function getFullPackageProfitByCustomer(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(fullPackageOrders.status, "delivered")];
  if (startDate) conditions.push(gte(fullPackageOrders.createdAt, startDate));
  if (endDate) conditions.push(lte(fullPackageOrders.createdAt, endDate));
  
  return db.select({
    customerId: fullPackageOrders.customerId,
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(sellingPriceUsd * quantity), 0)`,
    totalCost: sql<number>`COALESCE(SUM(purchasePriceUsd * quantity + COALESCE(shippingCostUsd, 0)), 0)`,
    totalProfit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
  }).from(fullPackageOrders)
    .where(and(...conditions))
    .groupBy(fullPackageOrders.customerId);
}

export async function getFullPackageReturnsReport(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(fullPackageOrders.isReturned, true)];
  if (startDate) conditions.push(gte(fullPackageOrders.returnDate, startDate));
  if (endDate) conditions.push(lte(fullPackageOrders.returnDate, endDate));
  
  return db.select().from(fullPackageOrders)
    .where(and(...conditions))
    .orderBy(desc(fullPackageOrders.returnDate));
}

export async function getFullPackageDeliveryTimeReport(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { avgDays: 0, minDays: 0, maxDays: 0, totalDelivered: 0 };
  
  const conditions = [
    eq(fullPackageOrders.status, "delivered"),
    sql`${fullPackageOrders.orderDate} IS NOT NULL`,
    sql`${fullPackageOrders.deliveredDate} IS NOT NULL`,
  ];
  if (startDate) conditions.push(gte(fullPackageOrders.deliveredDate, startDate));
  if (endDate) conditions.push(lte(fullPackageOrders.deliveredDate, endDate));
  
  const result = await db.select({
    avgDays: sql<number>`AVG(DATEDIFF(deliveredDate, orderDate))`,
    minDays: sql<number>`MIN(DATEDIFF(deliveredDate, orderDate))`,
    maxDays: sql<number>`MAX(DATEDIFF(deliveredDate, orderDate))`,
    totalDelivered: sql<number>`COUNT(*)`,
  }).from(fullPackageOrders).where(and(...conditions));
  
  return result[0] || { avgDays: 0, minDays: 0, maxDays: 0, totalDelivered: 0 };
}

export async function getFullPackageStats() {
  const db = await getDb();
  if (!db) return {
    total: 0, pending: 0, ordered: 0, inTransit: 0, delivered: 0, 
    cancelled: 0, returned: 0, todayOrders: 0, thisWeekOrders: 0,
    totalProfit: 0, avgProfit: 0, resale: 0, purchase: 0, totalRevenue: 0,
    approved: 0, fullPackage: 0, purchaseRequest: 0, commission: 0
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const stats = await db.select({
    total: sql<number>`COUNT(*)`,
    pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
    approved: sql<number>`SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)`,
    ordered: sql<number>`SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END)`,
    inTransit: sql<number>`SUM(CASE WHEN status IN ('tracking_added', 'in_china_warehouse', 'in_batch', 'in_transit') THEN 1 ELSE 0 END)`,
    delivered: sql<number>`SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)`,
    cancelled: sql<number>`SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)`,
    returned: sql<number>`SUM(CASE WHEN status = 'returned' OR isReturned = true THEN 1 ELSE 0 END)`,
    todayOrders: sql<number>`SUM(CASE WHEN DATE(createdAt) = CURDATE() THEN 1 ELSE 0 END)`,
    thisWeekOrders: sql<number>`SUM(CASE WHEN createdAt >= ${weekAgo} THEN 1 ELSE 0 END)`,
    totalProfit: sql<number>`COALESCE(SUM(CASE WHEN status = 'delivered' THEN profitUsd ELSE 0 END), 0)`,
    totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN status = 'delivered' THEN totalCostUsd ELSE 0 END), 0)`,
    // Legacy order types
    resale: sql<number>`SUM(CASE WHEN orderType = 'resale' THEN 1 ELSE 0 END)`,
    purchase: sql<number>`SUM(CASE WHEN orderType = 'purchase' THEN 1 ELSE 0 END)`,
    // New order types
    fullPackage: sql<number>`SUM(CASE WHEN orderType = 'full_package' OR orderType = 'resale' THEN 1 ELSE 0 END)`,
    purchaseRequest: sql<number>`SUM(CASE WHEN orderType = 'purchase_request' OR orderType = 'purchase' THEN 1 ELSE 0 END)`,
    commission: sql<number>`SUM(CASE WHEN orderType = 'commission' THEN 1 ELSE 0 END)`,
  }).from(fullPackageOrders);
  
  const avgProfit = stats[0]?.delivered > 0 ? stats[0].totalProfit / stats[0].delivered : 0;
  
  return { ...stats[0], avgProfit };
}



// ============ ADVANCED REPORTING QUERIES ============

// Get profit report by date range
export async function getProfitReport(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { packageRevenue: 0, fullPackageProfit: 0, totalPayments: 0 };
  
  // Package revenue (from ledger charges) - using unified ledgerTransactions
  const packageRevenue = await db.select({
    total: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END), 0)`,
  }).from(ledgerTransactions)
    .where(and(gte(ledgerTransactions.createdAt, startDate), lte(ledgerTransactions.createdAt, endDate)));
  
  // Full package profit
  const fullPackageProfit = await db.select({
    total: sql<number>`COALESCE(SUM(profitUsd), 0)`,
  }).from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.status, "delivered"),
      gte(fullPackageOrders.createdAt, startDate),
      lte(fullPackageOrders.createdAt, endDate)
    ));
  
  // Total payments received - using paymentRecords table
  const totalPayments = await db.select({
    total: sql<number>`COALESCE(SUM(amount), 0)`,
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ));
  
  return {
    packageRevenue: Number(packageRevenue[0]?.total || 0),
    fullPackageProfit: Number(fullPackageProfit[0]?.total || 0),
    totalPayments: Number(totalPayments[0]?.total || 0),
  };
}

// Get top customers by revenue - uses unified ledgerTransactions
export async function getTopCustomersByRevenue(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  // Join ledgerTransactions with customerAccounts to get customerId
  return db.select({
    customerId: customerAccounts.customerId,
    totalCharges: sql<number>`SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END)`,
    totalPayments: sql<number>`SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'CREDIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END)`,
    packageCount: sql<number>`COUNT(DISTINCT ${ledgerTransactions.referenceId})`,
  }).from(ledgerTransactions)
    .innerJoin(customerAccounts, eq(ledgerTransactions.accountId, customerAccounts.id))
    .groupBy(customerAccounts.customerId)
    .orderBy(desc(sql`SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END)`))
    .limit(limit);
}

// Get customers with outstanding debt - uses unified customerAccounts
export async function getCustomersWithDebt() {
  const db = await getDb();
  if (!db) return [];
  
  // Get customers with positive balance (they owe money) from customerAccounts
  // Positive balance = customer owes money (debt)
  // Negative balance = customer has credit
  return db.select({
    customerId: customerAccounts.customerId,
    latestBalance: customerAccounts.currentBalanceUsd,
  }).from(customerAccounts)
    .where(gt(customerAccounts.currentBalanceUsd, sql`0`));
}

// Get package statistics by status
export async function getPackageStatsByStatus() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    status: packages.status,
    count: sql<number>`COUNT(*)`,
    totalWeight: sql<number>`COALESCE(SUM(weightKg), 0)`,
  }).from(packages)
    .groupBy(packages.status);
}

// Get daily/weekly/monthly summary
export async function getTimePeriodSummary(period: 'day' | 'week' | 'month') {
  const db = await getDb();
  if (!db) return [];
  
  const dateFormat = period === 'day' ? '%Y-%m-%d' : period === 'week' ? '%Y-%u' : '%Y-%m';
  
  return db.select({
    period: sql<string>`DATE_FORMAT(createdAt, ${dateFormat})`,
    packagesRegistered: sql<number>`COUNT(*)`,
    totalWeight: sql<number>`COALESCE(SUM(weightKg), 0)`,
  }).from(packages)
    .groupBy(sql`DATE_FORMAT(createdAt, ${dateFormat})`)
    .orderBy(desc(sql`DATE_FORMAT(createdAt, ${dateFormat})`))
    .limit(30);
}

// Get batch performance report
export async function getBatchPerformanceReport() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    batchId: batches.id,
    batchCode: batches.batchCode,
    shippingType: batches.shippingType,
    status: batches.status,
    packageCount: sql<number>`(SELECT COUNT(*) FROM packages WHERE packages.batchId = batches.id)`,
    totalWeight: sql<number>`(SELECT COALESCE(SUM(weightKg), 0) FROM packages WHERE packages.batchId = batches.id)`,
    createdAt: batches.createdAt,
  }).from(batches)
    .orderBy(desc(batches.createdAt))
    .limit(50);
}



// ============ PROFESSIONAL DASHBOARD STATISTICS ============

export async function getDashboardFinancialStats(): Promise<{
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayChange: number;
  weekChange: number;
  monthChange: number;
  todayPackages: number;
  weekPackages: number;
  monthPackages: number;
  totalDebt: number;
}> {
  const emptyResult = {
    todayRevenue: 0, weekRevenue: 0, monthRevenue: 0,
    todayChange: 0, weekChange: 0, monthChange: 0,
    todayPackages: 0, weekPackages: 0, monthPackages: 0,
    totalDebt: 0
  };
  const db = await getDb();
  if (!db) return emptyResult;

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Revenue queries - each wrapped individually
    let todayRevenue = 0, yesterdayRevenue = 0, weekRevenue = 0, lastWeekRevenue = 0, monthRevenue = 0, lastMonthRevenue = 0;
    try {
      const todayPayments = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
      }).from(paymentRecords).where(gte(paymentRecords.createdAt, todayStart));
      todayRevenue = parseFloat(todayPayments[0]?.total || '0');
    } catch (e) { appLogger.error('Dashboard: todayRevenue query failed', { error: e instanceof Error ? e.message : String(e) }); }

    try {
      const yesterdayPayments = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
      }).from(paymentRecords).where(and(
        gte(paymentRecords.createdAt, yesterdayStart),
        lt(paymentRecords.createdAt, todayStart)
      ));
      yesterdayRevenue = parseFloat(yesterdayPayments[0]?.total || '0');
    } catch { /* non-critical */ }

    try {
      const weekPayments = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
      }).from(paymentRecords).where(gte(paymentRecords.createdAt, weekStart));
      weekRevenue = parseFloat(weekPayments[0]?.total || '0');
    } catch (e) { appLogger.error('Dashboard: weekRevenue query failed', { error: e instanceof Error ? e.message : String(e) }); }

    try {
      const lastWeekPayments = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
      }).from(paymentRecords).where(and(
        gte(paymentRecords.createdAt, lastWeekStart),
        lt(paymentRecords.createdAt, weekStart)
      ));
      lastWeekRevenue = parseFloat(lastWeekPayments[0]?.total || '0');
    } catch { /* non-critical */ }

    try {
      const monthPayments = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
      }).from(paymentRecords).where(gte(paymentRecords.createdAt, monthStart));
      monthRevenue = parseFloat(monthPayments[0]?.total || '0');
    } catch (e) { appLogger.error('Dashboard: monthRevenue query failed', { error: e instanceof Error ? e.message : String(e) }); }

    try {
      const lastMonthPayments = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
      }).from(paymentRecords).where(and(
        gte(paymentRecords.createdAt, lastMonthStart),
        lt(paymentRecords.createdAt, monthStart)
      ));
      lastMonthRevenue = parseFloat(lastMonthPayments[0]?.total || '0');
    } catch { /* non-critical */ }

    const todayChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
    const weekChange = lastWeekRevenue > 0 ? ((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;
    const monthChange = lastMonthRevenue > 0 ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    // Package counts
    let todayPackages = 0, weekPackages = 0, monthPackages = 0;
    try {
      const todayPkgCount = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, todayStart));
      todayPackages = todayPkgCount[0]?.count || 0;
    } catch { /* ignore */ }
    try {
      const weekPkgCount = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, weekStart));
      weekPackages = weekPkgCount[0]?.count || 0;
    } catch { /* ignore */ }
    try {
      const monthPkgCount = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, monthStart));
      monthPackages = monthPkgCount[0]?.count || 0;
    } catch { /* ignore */ }

    // Total debt - use unified debt calculation
    let totalDebt = 0;
    try {
      const debtInfo = await getTotalDebtAmount();
      totalDebt = debtInfo.totalUsd;
    } catch (e) { appLogger.error('Dashboard: totalDebt query failed', { error: e instanceof Error ? e.message : String(e) }); }

    return {
      todayRevenue,
      weekRevenue,
      monthRevenue,
      todayChange: Math.round(todayChange * 10) / 10,
      weekChange: Math.round(weekChange * 10) / 10,
      monthChange: Math.round(monthChange * 10) / 10,
      todayPackages,
      weekPackages,
      monthPackages,
      totalDebt
    };
  } catch (err) {
    appLogger.error("getDashboardFinancialStats failed", { error: err instanceof Error ? err.message : String(err) });
    return emptyResult;
  }
}

export async function getDashboardRevenueChart(days: number = 30): Promise<{ date: string; revenue: number; packages: number }[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get daily revenue - using raw SQL to avoid GROUP BY issues with MySQL strict mode
    let revenueData: { date: string; revenue: string }[] = [];
    try {
      const startDateStr = startDate.toISOString().slice(0, 10);
      const revenueResult = await db.execute(
        sql`SELECT DATE(createdAt) as date, COALESCE(SUM(CAST(amountUsd AS DECIMAL(12,2))), 0) as revenue 
            FROM paymentRecords 
            WHERE createdAt >= ${startDateStr} 
            GROUP BY DATE(createdAt) 
            ORDER BY date`
      );
      const rawRevenue = (Array.isArray(revenueResult) ? revenueResult[0] : revenueResult) as unknown as any[];
      revenueData = (rawRevenue || []).map((r: any) => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        revenue: String(r.revenue ?? '0'),
      }));
    } catch (e) {
      appLogger.error('Error fetching revenue data', { error: e instanceof Error ? e.message : String(e) });
      revenueData = [];
    }

    // Get daily package counts
    let packageData: { date: string; count: number }[] = [];
    try {
      const startDateStr = startDate.toISOString().slice(0, 10);
      const packageResult = await db.execute(
        sql`SELECT DATE(createdAt) as date, COUNT(*) as count
            FROM packages
            WHERE createdAt >= ${startDateStr}
            GROUP BY DATE(createdAt)
            ORDER BY date`
      );
      const rawPackages = (Array.isArray(packageResult) ? packageResult[0] : packageResult) as unknown as any[];
      packageData = (rawPackages || []).map((p: any) => ({
        date: p.date instanceof Date ? p.date.toISOString().split('T')[0] : String(p.date),
        count: Number(p.count || 0),
      }));
    } catch (e) {
      appLogger.error('Error fetching package data', { error: e instanceof Error ? e.message : String(e) });
      packageData = [];
    }

    // Create a map for easy lookup - handle different date formats
    const revenueMap = new Map<string, number>();
    for (const r of revenueData) {
      // Handle both ISO date strings and Date objects
      const dateKey = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      revenueMap.set(dateKey, parseFloat(r.revenue) || 0);
    }
    
    const packageMap = new Map<string, number>();
    for (const p of packageData) {
      const dateKey = typeof p.date === 'string' ? p.date.split('T')[0] : new Date(p.date).toISOString().split('T')[0];
      packageMap.set(dateKey, p.count || 0);
    }

    // Generate all dates in range
    const result: { date: string; revenue: number; packages: number }[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        revenue: revenueMap.get(dateStr) || 0,
        packages: packageMap.get(dateStr) || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    appLogger.error('Error in getDashboardRevenueChart', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/** Daily revenue, expenses, and profit for dashboard chart (داهات، خەرجی، قازانج) */
export async function getDashboardProfitLossChart(days: number = 30): Promise<{ date: string; revenue: number; expenses: number; profit: number }[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString().slice(0, 10);

    let revenueData: { date: string; revenue: string }[] = [];
    try {
      const revenueResult = await db.execute(
        sql`SELECT DATE(createdAt) as date, COALESCE(SUM(CAST(amountUsd AS DECIMAL(12,2))), 0) as revenue 
            FROM paymentRecords 
            WHERE createdAt >= ${startDateStr} 
            GROUP BY DATE(createdAt) 
            ORDER BY date`
      );
      const rawRevenue = (Array.isArray(revenueResult) ? revenueResult[0] : revenueResult) as unknown as any[];
      revenueData = (rawRevenue || []).map((r: any) => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        revenue: String(r.revenue ?? '0'),
      }));
    } catch (e) {
      appLogger.error('Error fetching revenue for P/L chart', { error: e instanceof Error ? e.message : String(e) });
    }

    let expenseData: { date: string; expenses: string }[] = [];
    try {
      const expenseResult = await db.execute(
        sql`SELECT DATE(expenseDate) as date, COALESCE(SUM(CAST(amountUsd AS DECIMAL(12,2))), 0) as expenses
            FROM expenses
            WHERE expenseDate >= ${startDateStr}
            GROUP BY DATE(expenseDate)
            ORDER BY date`
      );
      const rawExpenses = (Array.isArray(expenseResult) ? expenseResult[0] : expenseResult) as unknown as any[];
      expenseData = (rawExpenses || []).map((e: any) => ({
        date: e.date instanceof Date ? e.date.toISOString().split('T')[0] : String(e.date),
        expenses: String(e.expenses ?? '0'),
      }));
    } catch (e) {
      appLogger.error('Error fetching expenses for P/L chart', { error: e instanceof Error ? e.message : String(e) });
    }

    const revenueMap = new Map<string, number>();
    for (const r of revenueData) {
      const dateKey = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      revenueMap.set(dateKey, parseFloat(r.revenue) || 0);
    }
    const expenseMap = new Map<string, number>();
    for (const e of expenseData) {
      const dateKey = typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toISOString().split('T')[0];
      expenseMap.set(dateKey, parseFloat(e.expenses) || 0);
    }

    const result: { date: string; revenue: number; expenses: number; profit: number }[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const revenue = revenueMap.get(dateStr) || 0;
      const expenses = expenseMap.get(dateStr) || 0;
      result.push({
        date: dateStr,
        revenue,
        expenses,
        profit: revenue - expenses,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    appLogger.error('Error in getDashboardProfitLossChart', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function getDashboardActiveBatches(): Promise<{
  id: number;
  batchCode: string;
  status: string;
  shippingType: string;
  packageCount: number;
  totalWeight: number;
  createdAt: Date;
}[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const activeBatches = await db.select({
      id: batches.id,
      batchCode: batches.batchCode,
      status: batches.status,
      shippingType: batches.shippingType,
      createdAt: batches.createdAt
    }).from(batches)
      .where(inArray(batches.status, ['preparing', 'in_transit', 'arrived']))
      .orderBy(desc(batches.createdAt))
      .limit(5);

    // Batch fetch package stats for all active batches (avoid N+1)
    const batchIds = activeBatches.map((b) => b.id);
    const statsRows = batchIds.length > 0
      ? await db.select({
          batchId: packages.batchId,
          count: count(),
          totalWeight: sql<string>`COALESCE(SUM(CAST(${packages.weightKg} AS DECIMAL(10,2))), 0)`
        })
          .from(packages)
          .where(inArray(packages.batchId, batchIds))
          .groupBy(packages.batchId)
      : [];
    const statsByBatchId = new Map(statsRows.map((r) => [r.batchId, { count: r.count, totalWeight: parseFloat(r.totalWeight || "0") }]));

    return activeBatches.map((batch) => {
      const stats = statsByBatchId.get(batch.id) ?? { count: 0, totalWeight: 0 };
      return {
        ...batch,
        packageCount: stats.count,
        totalWeight: stats.totalWeight
      };
    });
  } catch (err) {
    appLogger.error("getDashboardActiveBatches failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function getDashboardTopDebtors(limit: number = 5): Promise<{
  customerId: number;
  customerName: string;
  customerCode: string;
  debtUsd: number;
  lastPaymentDate: Date | null;
}[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const debtors = await db.select({
      accountId: customerAccounts.id,
      customerId: customerAccounts.customerId,
      debtUsd: sql<string>`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`
    }).from(customerAccounts)
      .where(gt(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`, 0))
      .orderBy(desc(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`))
      .limit(limit);

    if (debtors.length === 0) return [];

    const customerIds = debtors.map((d) => d.customerId);
    const accountIds = debtors.map((d) => d.accountId);
    const customersList = await db.select({
      id: customers.id,
      fullName: customers.fullName,
      customerCode: customers.customerCode
    }).from(customers).where(inArray(customers.id, customerIds));
    const customerMap = new Map(customersList.map((c) => [c.id, c]));

    let lastPaymentByAccount = new Map<number, Date>();
    try {
      const lastPayments = await db.select({
        accountId: paymentRecords.accountId,
        paymentDate: sql<Date>`MAX(${paymentRecords.createdAt})`.as("paymentDate")
      }).from(paymentRecords).where(inArray(paymentRecords.accountId, accountIds)).groupBy(paymentRecords.accountId);
      lastPaymentByAccount = new Map(lastPayments.map((p) => [p.accountId, p.paymentDate]));
    } catch { /* paymentRecords may not exist */ }

    return debtors.map((debtor) => {
      const customer = customerMap.get(debtor.customerId);
      const lastPaymentDate = lastPaymentByAccount.get(debtor.accountId) ?? null;
      return {
        customerId: debtor.customerId,
        customerName: customer?.fullName || 'Unknown',
        customerCode: customer?.customerCode || '',
        debtUsd: parseFloat(debtor.debtUsd),
        lastPaymentDate
      };
    });
  } catch (err) {
    appLogger.error("getDashboardTopDebtors failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function getDashboardRecentActivity(limit: number = 10): Promise<{
  id: string;
  type: 'package' | 'payment' | 'customer' | 'batch' | 'delivery';
  title: string;
  description: string;
  timestamp: Date;
  icon: string;
  color: string;
}[]> {
  const db = await getDb();
  if (!db) return [];
  try {
  const activities: {
    id: string;
    type: 'package' | 'payment' | 'customer' | 'batch' | 'delivery';
    title: string;
    description: string;
    timestamp: Date;
    icon: string;
    color: string;
  }[] = [];

  // Recent packages
  const recentPackages = await db.select({
    id: packages.id,
    trackingNumber: packages.trackingNumber,
    createdAt: packages.createdAt
  }).from(packages).orderBy(desc(packages.createdAt)).limit(5);

  recentPackages.forEach(pkg => {
    activities.push({
      id: `pkg-${pkg.id}`,
      type: 'package',
      title: 'پاکەتی نوێ تۆمارکرا',
      description: pkg.trackingNumber || `PKG-${pkg.id}`,
      timestamp: pkg.createdAt,
      icon: 'Package',
      color: 'blue'
    });
  });

  // Recent payments (join to get customerId, then batch fetch customer names to avoid N+1)
  const recentPayments = await db.select({
    id: paymentRecords.id,
    amountUsd: paymentRecords.amountUsd,
    customerId: customerAccounts.customerId,
    paymentDate: paymentRecords.createdAt
  })
    .from(paymentRecords)
    .innerJoin(customerAccounts, eq(paymentRecords.accountId, customerAccounts.id))
    .orderBy(desc(paymentRecords.createdAt))
    .limit(5);

  const paymentCustomerIds = Array.from(new Set(recentPayments.map((p) => p.customerId).filter((id): id is number => id != null)));
  const customersList = paymentCustomerIds.length > 0
    ? await db.select({ id: customers.id, fullName: customers.fullName }).from(customers).where(inArray(customers.id, paymentCustomerIds))
    : [];
  const customerMap = new Map(customersList.map((c) => [c.id, c.fullName ?? 'Unknown']));

  for (const payment of recentPayments) {
    activities.push({
      id: `pay-${payment.id}`,
      type: 'payment',
      title: `$${payment.amountUsd} وەرگیرا`,
      description: payment.customerId ? (customerMap.get(payment.customerId) ?? 'Unknown') : 'Unknown',
      timestamp: payment.paymentDate,
      icon: 'DollarSign',
      color: 'green'
    });
  }

  // Recent customers (from customers table)
  const recentCustomers = await db.select({
    id: customers.id,
    fullName: customers.fullName,
    customerCode: customers.customerCode,
    createdAt: customers.createdAt
  }).from(customers)
    .orderBy(desc(customers.createdAt))
    .limit(3);

  recentCustomers.forEach(cust => {
    activities.push({
      id: `cust-${cust.id}`,
      type: 'customer',
      title: 'کڕیاری نوێ',
      description: cust.fullName || cust.customerCode || '',
      timestamp: cust.createdAt!,
      icon: 'User',
      color: 'purple'
    });
  });

  // Recent deliveries
  const recentDeliveries = await db.select({
    id: packages.id,
    trackingNumber: packages.trackingNumber,
    updatedAt: packages.updatedAt
  }).from(packages)
    .where(eq(packages.status, 'delivered'))
    .orderBy(desc(packages.updatedAt))
    .limit(3);

  recentDeliveries.forEach(del => {
    activities.push({
      id: `del-${del.id}`,
      type: 'delivery',
      title: 'پاکەت گەیاندرا',
      description: del.trackingNumber || `PKG-${del.id}`,
      timestamp: del.updatedAt,
      icon: 'CheckCircle',
      color: 'emerald'
    });
  });

  // Sort by timestamp and limit
  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
  } catch (err) {
    appLogger.error("getDashboardRecentActivity failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function getDashboardAlerts(): Promise<{
  id: string;
  type: 'warning' | 'info' | 'error' | 'success';
  title: string;
  description: string;
  count?: number;
  link?: string;
}[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const alerts: {
      id: string;
      type: 'warning' | 'info' | 'error' | 'success';
      title: string;
      description: string;
      count?: number;
      link?: string;
    }[] = [];

    // High debt customers — those whose debt has passed THEIR OWN credit
    // limit (currentBalanceUsd > 0 means they owe; compare against creditLimit).
    try {
      const highDebtors = await db.select({ count: count() })
        .from(customerAccounts)
        .where(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) > 0 AND CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) > CAST(COALESCE(${customerAccounts.creditLimitUsd}, '0') AS DECIMAL(12,2))`);
      if (highDebtors[0]?.count > 0) {
        alerts.push({ id: 'high-debt', type: 'warning', title: 'کڕیارە قەرزدارەکان', description: `${highDebtors[0].count} کڕیار قەرزیان لە سنووری قەرز تێپەڕیوە`, count: highDebtors[0].count, link: '/finance/debtors' });
      }
    } catch { /* ignore */ }

    // Orders still missing a tracking number (active, pre-tracking states).
    // Highlight ones older than 7 days as critical.
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const noTrackWhere = and(
        isNull(fullPackageOrders.deletedAt),
        inArray(fullPackageOrders.status, ['pending', 'approved', 'ordered'] as any),
        or(isNull(fullPackageOrders.trackingNumber), eq(fullPackageOrders.trackingNumber, '')),
      );
      const noTrack = await db.select({ count: count() }).from(fullPackageOrders).where(noTrackWhere);
      const total = noTrack[0]?.count || 0;
      if (total > 0) {
        const agingRes = await db.select({ count: count() }).from(fullPackageOrders)
          .where(and(noTrackWhere, lt(fullPackageOrders.createdAt, sevenDaysAgo)));
        const aging = agingRes[0]?.count || 0;
        alerts.push({
          id: 'orders-no-tracking',
          type: aging > 0 ? 'error' : 'warning',
          title: 'ئۆردەری بێ تراکینگ',
          description: aging > 0
            ? `${total} ئۆردەر بێ تراکینگن — ${aging}ـیان زیاتر لە ٧ ڕۆژە`
            : `${total} ئۆردەر هێشتا بێ تراکینگن`,
          count: total,
          link: '/unified-orders',
        });
      }
    } catch { /* ignore */ }

    // Large active orders (≥ $1000) — keep an eye on high-value orders.
    try {
      const bigOrders = await db.select({ count: count() }).from(fullPackageOrders)
        .where(and(
          isNull(fullPackageOrders.deletedAt),
          notInArray(fullPackageOrders.status, ['delivered', 'cancelled', 'refunded', 'returned', 'rejected'] as any),
          sql`(CAST(COALESCE(${fullPackageOrders.sellingPriceUsd}, ${fullPackageOrders.itemPriceUsd}, '0') AS DECIMAL(12,2)) * COALESCE(${fullPackageOrders.quantity}, 1)) >= 1000`,
        ));
      if (bigOrders[0]?.count > 0) {
        alerts.push({
          id: 'large-orders',
          type: 'info',
          title: 'ئۆردەری گەورە',
          description: `${bigOrders[0].count} ئۆردەری چالاک بەهای $1000 یان زیاتر`,
          count: bigOrders[0].count,
          link: '/unified-orders',
        });
      }
    } catch { /* ignore */ }

    // Batches at customs
    try {
      const customsBatches = await db.select({ count: count() }).from(batches).where(eq(batches.status, 'customs'));
      if (customsBatches[0]?.count > 0) {
        alerts.push({ id: 'customs', type: 'info', title: 'باچ لە گومرگ', description: `${customsBatches[0].count} باچ لە گومرگدا`, count: customsBatches[0].count, link: '/batches' });
      }
    } catch { /* ignore */ }

    // Unclaimed packages
    try {
      const unclaimedPkgs = await db.select({ count: count() }).from(packages).where(eq(packages.isUnclaimed, true));
      if (unclaimedPkgs[0]?.count > 0) {
        alerts.push({ id: 'unclaimed', type: 'warning', title: 'پاکەتی بێ خاوەن', description: `${unclaimedPkgs[0].count} پاکەت بێ خاوەنە`, count: unclaimedPkgs[0].count, link: '/packages/unclaimed' });
      }
    } catch { /* ignore */ }

    // Pending Full Package orders
    try {
      const pendingFP = await db.select({ count: count() }).from(fullPackageOrders).where(eq(fullPackageOrders.status, 'pending'));
      if (pendingFP[0]?.count > 0) {
        alerts.push({ id: 'pending-fp', type: 'info', title: 'داواکاری Full Package', description: `${pendingFP[0].count} داواکاری چاوەڕوانە`, count: pendingFP[0].count, link: '/full-package' });
      }
    } catch { /* ignore */ }

    // Today's deliveries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const todayDeliveries = await db.select({ count: count() }).from(packages).where(and(eq(packages.status, 'delivered'), gte(packages.updatedAt, todayStart)));
      if (todayDeliveries[0]?.count > 0) {
        alerts.push({ id: 'today-deliveries', type: 'success', title: 'گەیاندنی ئەمڕۆ', description: `${todayDeliveries[0].count} پاکەت گەیاندرا ئەمڕۆ`, count: todayDeliveries[0].count });
      }
    } catch { /* ignore */ }

    // New payments today
    try {
      const todayPayments = await db.select({ count: count() }).from(paymentRecords).where(gte(paymentRecords.createdAt, todayStart));
      if (todayPayments[0]?.count > 0) {
        alerts.push({ id: 'today-payments', type: 'success', title: 'پارەدانی ئەمڕۆ', description: `${todayPayments[0].count} پارەدان وەرگیرا`, count: todayPayments[0].count, link: '/finance' });
      }
    } catch { /* ignore */ }

    return alerts;
  } catch (err) {
    appLogger.error("getDashboardAlerts failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function getDashboardNewCustomers(days: number = 7): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const result = await db.select({ count: count() }).from(customers).where(gte(customers.createdAt, startDate));
    return result[0]?.count || 0;
  } catch (err) {
    appLogger.error("getDashboardNewCustomers failed", { error: err instanceof Error ? err.message : String(err) });
    return 0;
  }
}

// Positive counterpart to the alerts: this-week wins / records to celebrate on
// the dashboard. Each block is isolated in its own try/catch so one failing
// metric never blanks the whole section.
export async function getWeeklyHighlights(): Promise<{
  profit: { thisWeekUsd: number; lastWeekUsd: number; deltaPct: number | null; isRecord: boolean };
  newCustomers: { thisWeek: number; lastWeek: number };
  orders: { thisWeek: number; lastWeek: number };
  topCustomer: { name: string; code: string; orders: number; spentUsd: number } | null;
  fastestBatch: { code: string; days: number } | null;
}> {
  const empty = {
    profit: { thisWeekUsd: 0, lastWeekUsd: 0, deltaPct: null as number | null, isRecord: false },
    newCustomers: { thisWeek: 0, lastWeek: 0 },
    orders: { thisWeek: 0, lastWeek: 0 },
    topCustomer: null as { name: string; code: string; orders: number; spentUsd: number } | null,
    fastestBatch: null as { code: string; days: number } | null,
  };
  const db = await getDb();
  if (!db) return empty;
  try {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);

    // Profit — bucket daily P/L into trailing 7-day weeks; this week is a
    // record if it's the highest of the last ~13 weeks (and positive).
    const profit = { thisWeekUsd: 0, lastWeekUsd: 0, deltaPct: null as number | null, isRecord: false };
    try {
      const daily = await getDashboardProfitLossChart(91);
      const desc7 = [...daily].sort((a, b) => (a.date < b.date ? 1 : -1));
      const weeks: number[] = [];
      for (let i = 0; i < desc7.length; i += 7) {
        weeks.push(desc7.slice(i, i + 7).reduce((s, d) => s + (d.profit || 0), 0));
      }
      const thisWeek = weeks[0] ?? 0;
      const lastWeek = weeks[1] ?? 0;
      const maxWeek = weeks.length ? Math.max(...weeks) : 0;
      profit.thisWeekUsd = thisWeek;
      profit.lastWeekUsd = lastWeek;
      profit.deltaPct = lastWeek !== 0 ? ((thisWeek - lastWeek) / Math.abs(lastWeek)) * 100 : null;
      profit.isRecord = thisWeek > 0 && thisWeek >= maxWeek && weeks.length >= 3;
    } catch { /* ignore */ }

    // New customers — this week vs the week before
    const newCustomers = { thisWeek: 0, lastWeek: 0 };
    try {
      const [tw] = await db.select({ c: count() }).from(customers).where(gte(customers.createdAt, weekAgo));
      const [lw] = await db.select({ c: count() }).from(customers).where(and(gte(customers.createdAt, twoWeeksAgo), lt(customers.createdAt, weekAgo)));
      newCustomers.thisWeek = tw?.c || 0;
      newCustomers.lastWeek = lw?.c || 0;
    } catch { /* ignore */ }

    // Orders — this week vs the week before
    const orders = { thisWeek: 0, lastWeek: 0 };
    try {
      const [tw] = await db.select({ c: count() }).from(fullPackageOrders).where(and(isNull(fullPackageOrders.deletedAt), gte(fullPackageOrders.createdAt, weekAgo)));
      const [lw] = await db.select({ c: count() }).from(fullPackageOrders).where(and(isNull(fullPackageOrders.deletedAt), gte(fullPackageOrders.createdAt, twoWeeksAgo), lt(fullPackageOrders.createdAt, weekAgo)));
      orders.thisWeek = tw?.c || 0;
      orders.lastWeek = lw?.c || 0;
    } catch { /* ignore */ }

    // Most active customer this week (by order count)
    let topCustomer: { name: string; code: string; orders: number; spentUsd: number } | null = null;
    try {
      const rows = await db.select({
        customerId: fullPackageOrders.customerId,
        orders: sql<number>`COUNT(*)`,
        spent: sql<string>`COALESCE(SUM(CAST(COALESCE(${fullPackageOrders.sellingPriceUsd}, ${fullPackageOrders.itemPriceUsd}, '0') AS DECIMAL(12,2)) * COALESCE(${fullPackageOrders.quantity}, 1)), 0)`,
      }).from(fullPackageOrders)
        .where(and(isNull(fullPackageOrders.deletedAt), gte(fullPackageOrders.createdAt, weekAgo)))
        .groupBy(fullPackageOrders.customerId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(1);
      if (rows[0]?.customerId) {
        const [cust] = await db.select().from(customers).where(eq(customers.id, rows[0].customerId)).limit(1);
        if (cust) {
          topCustomer = {
            name: (cust as any).fullName || (cust as any).fullNameKurdish || (cust as any).name || "",
            code: (cust as any).customerCode || "",
            orders: Number(rows[0].orders) || 0,
            spentUsd: Number(rows[0].spent) || 0,
          };
        }
      }
    } catch { /* ignore */ }

    // Fastest recently-arrived batch (last 30 days) by transit days
    let fastestBatch: { code: string; days: number } | null = null;
    try {
      const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 30);
      const rows = await db.select({
        code: batches.batchCode,
        days: sql<number>`DATEDIFF(${batches.actualArrival}, ${batches.departureDate})`,
      }).from(batches)
        .where(and(isNotNull(batches.actualArrival), isNotNull(batches.departureDate), gte(batches.actualArrival, thirtyAgo)))
        .orderBy(sql`DATEDIFF(${batches.actualArrival}, ${batches.departureDate}) ASC`)
        .limit(1);
      if (rows[0] && rows[0].days != null && Number(rows[0].days) >= 0) {
        fastestBatch = { code: rows[0].code, days: Number(rows[0].days) };
      }
    } catch { /* ignore */ }

    return { profit, newCustomers, orders, topCustomer, fastestBatch };
  } catch (err) {
    appLogger.error("getWeeklyHighlights failed", { error: err instanceof Error ? err.message : String(err) });
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Self orders = packages registered under a customer that are NOT tied to a
// commission / full-package order (the customer bought the goods themselves,
// we only ship). In the data model these are simply packages with no linked
// order: `fullPackageOrderId IS NULL`. (The primary order link is always
// mirrored into that column, so a null value reliably means "unlinked".)
// This is a READ-ONLY rollup over existing data — nothing about how packages
// are created or stored changes.
//
// Revenue = the shipping charge billed (calculatedCostUsd).
// Cost    = chargeable measure × the batch's OWN cost rate (costPerKg /
//           costPerCbm). Packages not yet in a batch contribute 0 cost.
// Profit  = revenue − cost.
type SelfOrderRow = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string;
  customerCode: string;
  shippingType: string;
  weightKg: number;
  revenueUsd: number;
  costUsd: number;
  profitUsd: number;
  status: string;
  createdAt: Date;
};

function computePkgCost(shippingType: string, weightKg: unknown, volumeCbm: unknown, costPerKg: unknown, costPerCbm: unknown): number {
  if (shippingType === 'sea') {
    return (parseFloat(String(volumeCbm ?? 0)) || 0) * (parseFloat(String(costPerCbm ?? 0)) || 0);
  }
  return (parseFloat(String(weightKg ?? 0)) || 0) * (parseFloat(String(costPerKg ?? 0)) || 0);
}

export async function getSelfOrderReport(days?: number): Promise<{
  summary: {
    count: number;
    revenueUsd: number;
    costUsd: number;
    profitUsd: number;
    byType: Record<'air_regular' | 'air_irregular' | 'sea', { count: number; revenueUsd: number }>;
    topCustomers: { customerId: number; name: string; code: string; count: number; revenueUsd: number }[];
  };
  recent: SelfOrderRow[];
}> {
  const empty = {
    summary: {
      count: 0, revenueUsd: 0, costUsd: 0, profitUsd: 0,
      byType: { air_regular: { count: 0, revenueUsd: 0 }, air_irregular: { count: 0, revenueUsd: 0 }, sea: { count: 0, revenueUsd: 0 } },
      topCustomers: [] as { customerId: number; name: string; code: string; count: number; revenueUsd: number }[],
    },
    recent: [] as SelfOrderRow[],
  };
  const db = await getDb();
  if (!db) return empty;
  try {
    const conds: any[] = [isNull(packages.fullPackageOrderId), isNotNull(packages.customerId), eq(packages.isUnclaimed, false)];
    if (days && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      conds.push(gte(packages.createdAt, since));
    }
    const where = and(...conds);

    // Pull self-order packages with their customer + batch cost rates, then do
    // the air/sea cost math in JS (clearer than a SQL CASE and reused per row).
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
      calculatedCostUsd: packages.calculatedCostUsd,
      costPerKg: batches.costPerKg,
      costPerCbm: batches.costPerCbm,
      status: packages.status,
      createdAt: packages.createdAt,
    })
      .from(packages)
      .leftJoin(customers, eq(packages.customerId, customers.id))
      .leftJoin(batches, eq(packages.batchId, batches.id))
      .where(where)
      .orderBy(desc(packages.createdAt));

    const byType: Record<string, { count: number; revenueUsd: number }> = {
      air_regular: { count: 0, revenueUsd: 0 },
      air_irregular: { count: 0, revenueUsd: 0 },
      sea: { count: 0, revenueUsd: 0 },
    };
    const custMap = new Map<number, { customerId: number; name: string; code: string; count: number; revenueUsd: number }>();
    let revenueUsd = 0, costUsd = 0;
    const recent: SelfOrderRow[] = [];

    for (const r of rows) {
      const rev = parseFloat(String(r.calculatedCostUsd ?? 0)) || 0;
      const cost = computePkgCost(r.shippingType, r.weightKg, r.volumeCbm, r.costPerKg, r.costPerCbm);
      revenueUsd += rev;
      costUsd += cost;
      if (byType[r.shippingType]) { byType[r.shippingType].count += 1; byType[r.shippingType].revenueUsd += rev; }
      if (r.customerId) {
        const c = custMap.get(r.customerId) || { customerId: r.customerId, name: r.customerName || '', code: r.customerCode || '', count: 0, revenueUsd: 0 };
        c.count += 1; c.revenueUsd += rev;
        custMap.set(r.customerId, c);
      }
      if (recent.length < 100) {
        recent.push({
          id: r.id, packageCode: r.packageCode, trackingNumber: r.trackingNumber,
          customerId: r.customerId, customerName: r.customerName || '', customerCode: r.customerCode || '',
          shippingType: r.shippingType, weightKg: parseFloat(String(r.weightKg ?? 0)) || 0,
          revenueUsd: rev, costUsd: cost, profitUsd: rev - cost,
          status: r.status, createdAt: r.createdAt as Date,
        });
      }
    }

    const topCustomers = Array.from(custMap.values()).sort((a, b) => b.count - a.count || b.revenueUsd - a.revenueUsd).slice(0, 5);

    return {
      summary: {
        count: rows.length,
        revenueUsd,
        costUsd,
        profitUsd: revenueUsd - costUsd,
        byType: byType as any,
        topCustomers,
      },
      recent,
    };
  } catch (err) {
    appLogger.error("getSelfOrderReport failed", { error: err instanceof Error ? err.message : String(err) });
    return empty;
  }
}



// ============ ALERT SYSTEM HELPERS ============

export type AlertStatus = "normal" | "warning" | "high_risk";

export interface AlertInfo {
  status: AlertStatus;
  daysSinceCreation: number;
  message: string;
}

// Calculate alert status for a package
export function calculatePackageAlert(pkg: {
  registeredAt: Date;
  status: string;
  deliveredAt?: Date | null;
}): AlertInfo {
  // If delivered, always normal
  if (pkg.status === "delivered" || pkg.deliveredAt) {
    return {
      status: "normal",
      daysSinceCreation: 0,
      message: "گەیشتووە"
    };
  }
  
  const now = new Date();
  const registeredAt = new Date(pkg.registeredAt);
  const daysSinceCreation = Math.floor((now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCreation > 20) {
    return {
      status: "high_risk",
      daysSinceCreation,
      message: `🔴 ${daysSinceCreation} ڕۆژە - مەترسی بەرز!`
    };
  } else if (daysSinceCreation > 10) {
    return {
      status: "warning",
      daysSinceCreation,
      message: `⚠️ ${daysSinceCreation} ڕۆژە - ئاگاداری`
    };
  }
  
  return {
    status: "normal",
    daysSinceCreation,
    message: `✅ ${daysSinceCreation} ڕۆژ - ئاسایی`
  };
}

// Calculate alert status for a batch
export function calculateBatchAlert(batch: {
  estimatedArrival?: Date | null;
  actualArrival?: Date | null;
  status: string;
  departureDate?: Date | null;
}): AlertInfo {
  // If arrived or closed, always normal
  if (batch.status === "arrived" || batch.status === "delivered" || batch.status === "closed" || batch.actualArrival) {
    return {
      status: "normal",
      daysSinceCreation: 0,
      message: "گەیشتووە"
    };
  }
  
  const now = new Date();
  
  // If has estimated arrival
  if (batch.estimatedArrival) {
    const eta = new Date(batch.estimatedArrival);
    const daysUntilEta = Math.floor((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue > 0) {
      // Overdue
      if (daysOverdue > 5) {
        return {
          status: "high_risk",
          daysSinceCreation: daysOverdue,
          message: `🔴 ${daysOverdue} ڕۆژ دواکەوتووە - مەترسی بەرز!`
        };
      } else {
        return {
          status: "warning",
          daysSinceCreation: daysOverdue,
          message: `⚠️ ${daysOverdue} ڕۆژ دواکەوتووە - ئاگاداری`
        };
      }
    } else if (daysUntilEta <= 2) {
      // Close to ETA
      return {
        status: "warning",
        daysSinceCreation: 0,
        message: `⚠️ ${Math.abs(daysUntilEta)} ڕۆژ ماوە بۆ گەیشتن`
      };
    }
  }
  
  // Calculate days since departure
  if (batch.departureDate) {
    const departure = new Date(batch.departureDate);
    const daysSinceDeparture = Math.floor((now.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24));
    
    // Default thresholds based on shipping type would be better, but use general ones
    if (daysSinceDeparture > 30) {
      return {
        status: "high_risk",
        daysSinceCreation: daysSinceDeparture,
        message: `🔴 ${daysSinceDeparture} ڕۆژە لە ڕێگایە - مەترسی بەرز!`
      };
    } else if (daysSinceDeparture > 15) {
      return {
        status: "warning",
        daysSinceCreation: daysSinceDeparture,
        message: `⚠️ ${daysSinceDeparture} ڕۆژە لە ڕێگایە`
      };
    }
    
    return {
      status: "normal",
      daysSinceCreation: daysSinceDeparture,
      message: `✅ ${daysSinceDeparture} ڕۆژە لە ڕێگایە - ئاسایی`
    };
  }
  
  return {
    status: "normal",
    daysSinceCreation: 0,
    message: "✅ ئاسایی"
  };
}

// Get packages with alert status
export async function getPackagesWithAlerts(filters?: {
  alertStatus?: AlertStatus;
  status?: string;
  customerId?: number;
  batchId?: number;
}): Promise<(Package & { alert: AlertInfo })[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(packages);
  
  // Apply filters
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(packages.status, filters.status as any));
  }
  if (filters?.customerId) {
    conditions.push(eq(packages.customerId, filters.customerId));
  }
  if (filters?.batchId) {
    conditions.push(eq(packages.batchId, filters.batchId));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const results = await query.orderBy(desc(packages.createdAt));
  
  // Add alert info to each package
  const packagesWithAlerts = results.map(pkg => ({
    ...pkg,
    alert: calculatePackageAlert({
      registeredAt: pkg.registeredAt,
      status: pkg.status,
      deliveredAt: pkg.deliveredAt
    })
  }));
  
  // Filter by alert status if specified
  if (filters?.alertStatus) {
    return packagesWithAlerts.filter(p => p.alert.status === filters.alertStatus);
  }
  
  return packagesWithAlerts;
}

// Get batches with alert status
export async function getBatchesWithAlerts(filters?: {
  alertStatus?: AlertStatus;
  status?: string;
}): Promise<(Batch & { alert: AlertInfo })[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(batches);
  
  if (filters?.status) {
    query = query.where(eq(batches.status, filters.status as any)) as any;
  }
  
  const results = await query.orderBy(desc(batches.createdAt));
  
  // Add alert info to each batch
  const batchesWithAlerts = results.map(batch => ({
    ...batch,
    alert: calculateBatchAlert({
      estimatedArrival: batch.estimatedArrival,
      actualArrival: batch.actualArrival,
      status: batch.status,
      departureDate: batch.departureDate
    })
  }));
  
  // Filter by alert status if specified
  if (filters?.alertStatus) {
    return batchesWithAlerts.filter(b => b.alert.status === filters.alertStatus);
  }
  
  return batchesWithAlerts;
}

// Get alert summary for dashboard
export async function getAlertSummary(): Promise<{
  packages: { normal: number; warning: number; highRisk: number; total: number };
  batches: { normal: number; warning: number; highRisk: number; total: number };
}> {
  const db = await getDb();
  if (!db) {
    return {
      packages: { normal: 0, warning: 0, highRisk: 0, total: 0 },
      batches: { normal: 0, warning: 0, highRisk: 0, total: 0 }
    };
  }
  
  // Get active packages (not delivered)
  const activePackages = await db.select().from(packages)
    .where(notInArray(packages.status, ["delivered", "cancelled", "returned"]));
  
  // Get active batches (not closed)
  const activeBatches = await db.select().from(batches)
    .where(notInArray(batches.status, ["closed", "delivered"]));
  
  // Calculate alerts
  const packageAlerts = activePackages.map(pkg => calculatePackageAlert({
    registeredAt: pkg.registeredAt,
    status: pkg.status,
    deliveredAt: pkg.deliveredAt
  }));
  
  const batchAlerts = activeBatches.map(batch => calculateBatchAlert({
    estimatedArrival: batch.estimatedArrival,
    actualArrival: batch.actualArrival,
    status: batch.status,
    departureDate: batch.departureDate
  }));
  
  return {
    packages: {
      normal: packageAlerts.filter(a => a.status === "normal").length,
      warning: packageAlerts.filter(a => a.status === "warning").length,
      highRisk: packageAlerts.filter(a => a.status === "high_risk").length,
      total: activePackages.length
    },
    batches: {
      normal: batchAlerts.filter(a => a.status === "normal").length,
      warning: batchAlerts.filter(a => a.status === "warning").length,
      highRisk: batchAlerts.filter(a => a.status === "high_risk").length,
      total: activeBatches.length
    }
  };
}



// ============ PROFIT REPORTS ============

// Get detailed profit report for Full Package orders
export async function getFullPackageProfitReport(filters?: {
  startDate?: Date;
  endDate?: Date;
  orderType?: 'full_package' | 'purchase_request' | 'commission';
  customerId?: number;
  status?: string;
}): Promise<{
  orders: Array<{
    id: number;
    orderCode: string;
    productName: string;
    orderType: string;
    customerId: number;
    customerName?: string;
    purchasePriceUsd: number;
    sellingPriceUsd: number;
    shippingCostUsd: number;
    profitUsd: number;
    profitMargin: number;
    quantity: number;
    status: string;
    deliveredDate: Date | null;
    createdAt: Date;
  }>;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalCost: number;
    totalShipping: number;
    totalProfit: number;
    avgProfit: number;
    avgProfitMargin: number;
    profitableOrders: number;
    lossOrders: number;
  };
}> {
  const db = await getDb();
  if (!db) return { orders: [], summary: { totalOrders: 0, totalRevenue: 0, totalCost: 0, totalShipping: 0, totalProfit: 0, avgProfit: 0, avgProfitMargin: 0, profitableOrders: 0, lossOrders: 0 } };
  
  const conditions = [];
  
  if (filters?.startDate) {
    conditions.push(gte(fullPackageOrders.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(fullPackageOrders.createdAt, filters.endDate));
  }
  if (filters?.orderType) {
    conditions.push(eq(fullPackageOrders.orderType, filters.orderType));
  }
  if (filters?.customerId) {
    conditions.push(eq(fullPackageOrders.customerId, filters.customerId));
  }
  if (filters?.status) {
    conditions.push(eq(fullPackageOrders.status, filters.status as any));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const ordersResult = await db.select({
    id: fullPackageOrders.id,
    orderCode: fullPackageOrders.orderCode,
    productName: fullPackageOrders.productName,
    orderType: fullPackageOrders.orderType,
    customerId: fullPackageOrders.customerId,
    purchasePriceUsd: fullPackageOrders.purchasePriceUsd,
    sellingPriceUsd: fullPackageOrders.sellingPriceUsd,
    shippingCostUsd: fullPackageOrders.shippingCostUsd,
    profitUsd: fullPackageOrders.profitUsd,
    quantity: fullPackageOrders.quantity,
    status: fullPackageOrders.status,
    deliveredDate: fullPackageOrders.deliveredDate,
    createdAt: fullPackageOrders.createdAt,
    customerName: customers.fullName,
  })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(fullPackageOrders.createdAt));
  
  const orders = ordersResult.map(order => {
    const purchasePrice = parseFloat(order.purchasePriceUsd || '0');
    const sellingPrice = parseFloat(order.sellingPriceUsd || '0');
    const shippingCost = parseFloat(order.shippingCostUsd || '0');
    const profit = parseFloat(order.profitUsd || '0');
    const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    
    return {
      id: order.id,
      orderCode: order.orderCode,
      productName: order.productName || '',
      orderType: order.orderType || 'full_package',
      customerId: order.customerId!,
      customerName: order.customerName || undefined,
      purchasePriceUsd: purchasePrice,
      sellingPriceUsd: sellingPrice,
      shippingCostUsd: shippingCost,
      profitUsd: profit,
      profitMargin,
      quantity: order.quantity || 1,
      status: order.status || 'pending',
      deliveredDate: order.deliveredDate,
      createdAt: order.createdAt!,
    };
  });
  
  // Calculate summary
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.sellingPriceUsd * o.quantity, 0);
  const totalCost = orders.reduce((sum, o) => sum + o.purchasePriceUsd * o.quantity, 0);
  const totalShipping = orders.reduce((sum, o) => sum + o.shippingCostUsd, 0);
  const totalProfit = orders.reduce((sum, o) => sum + o.profitUsd, 0);
  const avgProfit = totalOrders > 0 ? totalProfit / totalOrders : 0;
  const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const profitableOrders = orders.filter(o => o.profitUsd > 0).length;
  const lossOrders = orders.filter(o => o.profitUsd < 0).length;
  
  return {
    orders,
    summary: {
      totalOrders,
      totalRevenue,
      totalCost,
      totalShipping,
      totalProfit,
      avgProfit,
      avgProfitMargin,
      profitableOrders,
      lossOrders,
    }
  };
}

// Get monthly profit report with all order types
export async function getMonthlyProfitReport(year: number, month?: number): Promise<{
  months: Array<{
    year: number;
    month: number;
    monthName: string;
    fullPackage: { count: number; revenue: number; cost: number; shipping: number; profit: number };
    purchaseRequest: { count: number; revenue: number; cost: number; shipping: number; profit: number };
    commission: { count: number; revenue: number; cost: number; shipping: number; profit: number };
    packages: { count: number; revenue: number };
    total: { revenue: number; cost: number; shipping: number; profit: number };
    comparison?: { profitChange: number; profitChangePercent: number };
  }>;
  yearSummary: {
    totalRevenue: number;
    totalCost: number;
    totalShipping: number;
    totalProfit: number;
    avgMonthlyProfit: number;
    bestMonth: { month: number; profit: number } | null;
    worstMonth: { month: number; profit: number } | null;
  };
}> {
  const db = await getDb();
  if (!db) return { months: [], yearSummary: { totalRevenue: 0, totalCost: 0, totalShipping: 0, totalProfit: 0, avgMonthlyProfit: 0, bestMonth: null, worstMonth: null } };
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Get all months to query
  const monthsToQuery = month ? [month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  const months = [];
  
  for (const m of monthsToQuery) {
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0, 23, 59, 59);
    
    // Full Package orders
    const fpOrders = await db.select({
      count: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(sellingPriceUsd * quantity), 0)`,
      cost: sql<number>`COALESCE(SUM(purchasePriceUsd * quantity), 0)`,
      shipping: sql<number>`COALESCE(SUM(shippingCostUsd), 0)`,
      profit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
    }).from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'full_package'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      ));
    
    // Purchase Request orders
    const prOrders = await db.select({
      count: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(sellingPriceUsd * quantity), 0)`,
      cost: sql<number>`COALESCE(SUM(purchasePriceUsd * quantity), 0)`,
      shipping: sql<number>`COALESCE(SUM(shippingCostUsd), 0)`,
      profit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
    }).from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'purchase_request'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      ));
    
    // Commission orders
    const commOrders = await db.select({
      count: sql<number>`COUNT(*)`,
      // Item price and commission are both PER UNIT — multiply by quantity,
      // matching commissionGoodsTotal in fullPackage.db.ts.
      revenue: sql<number>`COALESCE(SUM((itemPriceUsd + commissionFeeUsd) * quantity), 0)`,
      cost: sql<number>`COALESCE(SUM(itemPriceUsd * quantity), 0)`,
      shipping: sql<number>`COALESCE(SUM(shippingCostUsd), 0)`,
      profit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
    }).from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'commission'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      ));
    
    // Package deliveries
    const pkgDeliveries = await db.select({
      count: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(calculatedCostUsd), 0)`,
    }).from(packages)
      .where(and(
        eq(packages.isCharged, true),
        gte(packages.deliveredAt, startDate),
        lte(packages.deliveredAt, endDate)
      ));
    
    const fullPackage = {
      count: Number(fpOrders[0]?.count || 0),
      revenue: Number(fpOrders[0]?.revenue || 0),
      cost: Number(fpOrders[0]?.cost || 0),
      shipping: Number(fpOrders[0]?.shipping || 0),
      profit: Number(fpOrders[0]?.profit || 0),
    };
    
    const purchaseRequest = {
      count: Number(prOrders[0]?.count || 0),
      revenue: Number(prOrders[0]?.revenue || 0),
      cost: Number(prOrders[0]?.cost || 0),
      shipping: Number(prOrders[0]?.shipping || 0),
      profit: Number(prOrders[0]?.profit || 0),
    };
    
    const commission = {
      count: Number(commOrders[0]?.count || 0),
      revenue: Number(commOrders[0]?.revenue || 0),
      cost: Number(commOrders[0]?.cost || 0),
      shipping: Number(commOrders[0]?.shipping || 0),
      profit: Number(commOrders[0]?.profit || 0),
    };
    
    const pkgs = {
      count: Number(pkgDeliveries[0]?.count || 0),
      revenue: Number(pkgDeliveries[0]?.revenue || 0),
    };
    
    const total = {
      revenue: fullPackage.revenue + purchaseRequest.revenue + commission.revenue + pkgs.revenue,
      cost: fullPackage.cost + purchaseRequest.cost + commission.cost,
      shipping: fullPackage.shipping + purchaseRequest.shipping + commission.shipping,
      profit: fullPackage.profit + purchaseRequest.profit + commission.profit + pkgs.revenue,
    };
    
    months.push({
      year,
      month: m,
      monthName: monthNames[m - 1],
      fullPackage,
      purchaseRequest,
      commission,
      packages: pkgs,
      total,
    });
  }
  
  // Add comparison with previous month
  for (let i = 1; i < months.length; i++) {
    const current = months[i];
    const previous = months[i - 1];
    const profitChange = current.total.profit - previous.total.profit;
    const profitChangePercent = previous.total.profit !== 0 
      ? (profitChange / Math.abs(previous.total.profit)) * 100 
      : 0;
    
    (months[i] as any).comparison = { profitChange, profitChangePercent };
  }
  
  // Year summary
  const totalRevenue = months.reduce((sum, m) => sum + m.total.revenue, 0);
  const totalCost = months.reduce((sum, m) => sum + m.total.cost, 0);
  const totalShipping = months.reduce((sum, m) => sum + m.total.shipping, 0);
  const totalProfit = months.reduce((sum, m) => sum + m.total.profit, 0);
  const avgMonthlyProfit = months.length > 0 ? totalProfit / months.length : 0;
  
  const sortedByProfit = [...months].sort((a, b) => b.total.profit - a.total.profit);
  const bestMonth = sortedByProfit.length > 0 && sortedByProfit[0].total.profit > 0 
    ? { month: sortedByProfit[0].month, profit: sortedByProfit[0].total.profit }
    : null;
  const worstMonth = sortedByProfit.length > 0 
    ? { month: sortedByProfit[sortedByProfit.length - 1].month, profit: sortedByProfit[sortedByProfit.length - 1].total.profit }
    : null;
  
  return {
    months,
    yearSummary: {
      totalRevenue,
      totalCost,
      totalShipping,
      totalProfit,
      avgMonthlyProfit,
      bestMonth,
      worstMonth,
    }
  };
}

// Get profit breakdown by order type
export async function getProfitByOrderType(startDate?: Date, endDate?: Date): Promise<{
  fullPackage: { count: number; totalProfit: number; avgProfit: number };
  purchaseRequest: { count: number; totalProfit: number; avgProfit: number };
  commission: { count: number; totalProfit: number; avgProfit: number };
  packages: { count: number; totalRevenue: number };
}> {
  const db = await getDb();
  if (!db) return {
    fullPackage: { count: 0, totalProfit: 0, avgProfit: 0 },
    purchaseRequest: { count: 0, totalProfit: 0, avgProfit: 0 },
    commission: { count: 0, totalProfit: 0, avgProfit: 0 },
    packages: { count: 0, totalRevenue: 0 },
  };
  
  const dateConditions: SQL[] = [];
  if (startDate) dateConditions.push(gte(fullPackageOrders.createdAt, startDate));
  if (endDate) dateConditions.push(lte(fullPackageOrders.createdAt, endDate));
  
  const getOrderStats = async (orderType: 'full_package' | 'purchase_request' | 'commission') => {
    const conditions = [eq(fullPackageOrders.orderType, orderType), ...dateConditions];
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
      totalProfit: sql<number>`COALESCE(SUM(profitUsd), 0)`,
    }).from(fullPackageOrders)
      .where(and(...conditions));
    
    const count = Number(result[0]?.count || 0);
    const totalProfit = Number(result[0]?.totalProfit || 0);
    return { count, totalProfit, avgProfit: count > 0 ? totalProfit / count : 0 };
  };
  
  const pkgConditions = [];
  if (startDate) pkgConditions.push(gte(packages.deliveredAt, startDate));
  if (endDate) pkgConditions.push(lte(packages.deliveredAt, endDate));
  pkgConditions.push(eq(packages.isCharged, true));
  
  const pkgResult = await db.select({
    count: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(calculatedCostUsd), 0)`,
  }).from(packages)
    .where(and(...pkgConditions));
  
  return {
    fullPackage: await getOrderStats('full_package'),
    purchaseRequest: await getOrderStats('purchase_request'),
    commission: await getOrderStats('commission'),
    packages: {
      count: Number(pkgResult[0]?.count || 0),
      totalRevenue: Number(pkgResult[0]?.totalRevenue || 0),
    },
  };
}

/** Net profit from batches: for packages delivered in period, revenue minus allocated batch cost */
async function getPackageNetProfitFromBatches(
  db: Awaited<ReturnType<typeof getDb>>,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (!db) return 0;
  const pkgInPeriod = await db
    .select({
      batchId: packages.batchId,
      revenueInPeriod: sql<number>`COALESCE(SUM(${packages.calculatedCostUsd}), 0)`,
    })
    .from(packages)
    .where(and(
      eq(packages.isCharged, true),
      gte(packages.deliveredAt, startDate),
      lte(packages.deliveredAt, endDate),
      isNotNull(packages.batchId)
    ))
    .groupBy(packages.batchId);
  if (pkgInPeriod.length === 0) return 0;
  const batchIds = pkgInPeriod.map((r) => r.batchId).filter((id): id is number => id != null);
  if (batchIds.length === 0) return 0;

  const batchTotals = await db
    .select({
      batchId: packages.batchId,
      totalRevenue: sql<number>`COALESCE(SUM(${packages.calculatedCostUsd}), 0)`,
    })
    .from(packages)
    .where(inArray(packages.batchId, batchIds))
    .groupBy(packages.batchId);
  const batchCosts = await db
    .select({
      id: batches.id,
      totalCost: sql<number>`COALESCE(
        CASE WHEN ${batches.shippingType} = 'sea'
        THEN CAST(${batches.chargedCbm} AS DECIMAL(12,2)) * CAST(COALESCE(${batches.costPerCbm}, 0) AS DECIMAL(12,2))
        ELSE CAST(${batches.chargedWeightKg} AS DECIMAL(12,2)) * CAST(COALESCE(${batches.costPerKg}, 0) AS DECIMAL(12,2))
        END, 0
      )`,
    })
    .from(batches)
    .where(inArray(batches.id, batchIds));

  const revenueByBatch = new Map<number, number>();
  for (const r of pkgInPeriod) if (r.batchId != null) revenueByBatch.set(r.batchId, Number(r.revenueInPeriod ?? 0));
  const totalRevenueByBatch = new Map<number, number>();
  for (const r of batchTotals) if (r.batchId != null) totalRevenueByBatch.set(r.batchId, Number(r.totalRevenue ?? 0));
  const costByBatch = new Map<number, number>();
  for (const r of batchCosts) costByBatch.set(r.id, Number(r.totalCost ?? 0));

  let netProfit = 0;
  for (const batchId of batchIds) {
    const revenueInPeriod = revenueByBatch.get(batchId) ?? 0;
    const totalBatchRevenue = totalRevenueByBatch.get(batchId) ?? 0;
    const totalBatchCost = costByBatch.get(batchId) ?? 0;
    const allocatedCost = totalBatchRevenue > 0 ? totalBatchCost * (revenueInPeriod / totalBatchRevenue) : 0;
    netProfit += revenueInPeriod - allocatedCost;
  }
  return netProfit;
}

/** Aggregated profit from all sources + company expenses for summary/expense tab */
export async function getAggregatedProfitAndExpenses(
  year: number,
  month?: number
): Promise<{
  fullPackageProfit: number;
  commissionProfit: number;
  packageRevenue: number;
  packageNetProfitFromBatch: number;
  serviceProfit: number;
  totalProfit: number;
  totalExpenses: number;
  netSurplus: number;
  expensesByCategory: Array<{ categoryId: number; categoryName: string; amountUsd: number }>;
}> {
  const db = await getDb();
  const empty = {
    fullPackageProfit: 0,
    commissionProfit: 0,
    packageRevenue: 0,
    packageNetProfitFromBatch: 0,
    serviceProfit: 0,
    totalProfit: 0,
    totalExpenses: 0,
    netSurplus: 0,
    expensesByCategory: [],
  };
  if (!db) return empty;

  const startDate = new Date(year, month ? month - 1 : 0, 1);
  const endDate = month
    ? new Date(year, month, 0, 23, 59, 59)
    : new Date(year, 11, 31, 23, 59, 59);

  const [fpResult, commResult, pkgResult, pkgNetResult, svcResult, expSumResult, expByCatResult] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(profitUsd), 0)` })
      .from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'full_package'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      )),
    db.select({ total: sql<number>`COALESCE(SUM(profitUsd), 0)` })
      .from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'commission'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      )),
    db.select({ total: sql<number>`COALESCE(SUM(calculatedCostUsd), 0)` })
      .from(packages)
      .where(and(
        eq(packages.isCharged, true),
        gte(packages.deliveredAt, startDate),
        lte(packages.deliveredAt, endDate)
      )),
    getPackageNetProfitFromBatches(db, startDate, endDate),
    db.select({ total: sql<number>`COALESCE(SUM(profitAmount), 0)` })
      .from(extraServices)
      .where(and(
        gte(extraServices.createdAt, startDate),
        lte(extraServices.createdAt, endDate)
      )),
    db.select({ total: sql<number>`COALESCE(SUM(amountUsd), 0)` })
      .from(expenses)
      .where(and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      )),
    db.select({
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.nameEn,
      amountUsd: sql<number>`COALESCE(SUM(${expenses.amountUsd}), 0)`,
    })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      ))
      .groupBy(expenses.categoryId, expenseCategories.nameEn),
  ]);

  const fullPackageProfit = Number(fpResult[0]?.total ?? 0);
  const commissionProfit = Number(commResult[0]?.total ?? 0);
  const packageRevenue = Number(pkgResult[0]?.total ?? 0);
  const packageNetProfitFromBatch = Number(pkgNetResult ?? 0);
  const serviceProfit = Number(svcResult[0]?.total ?? 0);
  const totalProfit = fullPackageProfit + commissionProfit + packageNetProfitFromBatch + serviceProfit;
  const totalExpenses = Number(expSumResult[0]?.total ?? 0);
  const netSurplus = totalProfit - totalExpenses;

  const expensesByCategory = (expByCatResult ?? []).map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? '',
    amountUsd: Number(r.amountUsd ?? 0),
  }));

  return {
    fullPackageProfit,
    commissionProfit,
    packageRevenue,
    packageNetProfitFromBatch,
    serviceProfit,
    totalProfit,
    totalExpenses,
    netSurplus,
    expensesByCategory,
  };
}

// ============ EXPENSE ALERT SYSTEM ============

export async function createExpenseAlert(data: InsertExpenseAlert): Promise<ExpenseAlert> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(expenseAlerts).values(data);
  const insertId = Number(result[0].insertId);
  const [alert] = await db.select().from(expenseAlerts).where(eq(expenseAlerts.id, insertId));
  return alert;
}

export async function getExpenseAlerts(): Promise<ExpenseAlert[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseAlerts).orderBy(desc(expenseAlerts.createdAt));
}

export async function getExpenseAlertById(id: number): Promise<ExpenseAlert | null> {
  const db = await getDb();
  if (!db) return null;
  const [alert] = await db.select().from(expenseAlerts).where(eq(expenseAlerts.id, id));
  return alert || null;
}

export async function updateExpenseAlert(id: number, data: Partial<InsertExpenseAlert>): Promise<ExpenseAlert | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(expenseAlerts).set(data).where(eq(expenseAlerts.id, id));
  const [alert] = await db.select().from(expenseAlerts).where(eq(expenseAlerts.id, id));
  return alert || null;
}

export async function deleteExpenseAlert(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(expenseAlerts).where(eq(expenseAlerts.id, id));
  return true;
}

export async function toggleExpenseAlert(id: number, isEnabled: boolean): Promise<ExpenseAlert | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(expenseAlerts).set({ isEnabled }).where(eq(expenseAlerts.id, id));
  const [alert] = await db.select().from(expenseAlerts).where(eq(expenseAlerts.id, id));
  return alert || null;
}

// Get expense alert logs
export async function getExpenseAlertLogs(alertId?: number, limit = 50): Promise<ExpenseAlertLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(expenseAlertLogs).orderBy(desc(expenseAlertLogs.triggeredAt)).limit(limit);
  
  if (alertId) {
    return db.select().from(expenseAlertLogs)
      .where(eq(expenseAlertLogs.alertId, alertId))
      .orderBy(desc(expenseAlertLogs.triggeredAt))
      .limit(limit);
  }
  
  return query;
}

// Check if expenses exceed thresholds and trigger alerts
export async function checkExpenseThresholds(newExpenseAmount: number, newExpenseCategoryId?: number): Promise<{
  alertsTriggered: Array<{
    alert: ExpenseAlert;
    totalExpenses: number;
    thresholdAmount: number;
    periodLabel: string;
  }>;
}> {
  const db = await getDb();
  if (!db) return { alertsTriggered: [] };
  
  // Get all enabled alerts
  const enabledAlerts = await db.select().from(expenseAlerts)
    .where(eq(expenseAlerts.isEnabled, true));
  
  if (enabledAlerts.length === 0) return { alertsTriggered: [] };
  
  const now = new Date();
  const alertsTriggered: Array<{
    alert: ExpenseAlert;
    totalExpenses: number;
    thresholdAmount: number;
    periodLabel: string;
  }> = [];
  
  for (const alert of enabledAlerts) {
    // Check if this alert applies to the category
    if (alert.categoryId && newExpenseCategoryId && alert.categoryId !== newExpenseCategoryId) {
      continue;
    }
    
    // For per_transaction alerts, check if this single expense exceeds threshold
    if (alert.alertType === 'per_transaction') {
      const threshold = parseFloat(alert.thresholdAmount);
      if (newExpenseAmount >= threshold) {
        alertsTriggered.push({
          alert,
          totalExpenses: newExpenseAmount,
          thresholdAmount: threshold,
          periodLabel: 'مامەڵەی تاکە',
        });
        
        // Log the alert
        await db.insert(expenseAlertLogs).values({
          alertId: alert.id,
          totalExpenses: String(newExpenseAmount),
          thresholdAmount: alert.thresholdAmount,
          periodStart: now,
          periodEnd: now,
          expenseCount: 1,
          notificationSent: true,
          details: JSON.stringify({ type: 'per_transaction', amount: newExpenseAmount }),
        });
      }
      continue;
    }
    
    // Calculate period start based on alert type
    let periodStart: Date;
    let periodLabel: string;
    
    switch (alert.alertType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodLabel = 'ئەمڕۆ';
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        periodLabel = 'ئەم هەفتەیە';
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = 'ئەم مانگە';
        break;
      default:
        continue;
    }
    
    // Build conditions for expense query
    const conditions = [
      gte(expenses.expenseDate, periodStart),
      lte(expenses.expenseDate, now),
    ];
    
    if (alert.categoryId) {
      conditions.push(eq(expenses.categoryId, alert.categoryId));
    }
    
    // Get total expenses for the period
    const [result] = await db.select({
      total: sql<string>`COALESCE(SUM(${expenses.amountUsd}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(expenses).where(and(...conditions));
    
    const totalExpenses = parseFloat(result?.total || '0');
    const threshold = parseFloat(alert.thresholdAmount);
    
    if (totalExpenses >= threshold) {
      // Check if we already sent an alert for this period
      const existingLogs = await db.select().from(expenseAlertLogs)
        .where(and(
          eq(expenseAlertLogs.alertId, alert.id),
          gte(expenseAlertLogs.periodStart, periodStart),
        ))
        .limit(1);
      
      if (existingLogs.length === 0) {
        alertsTriggered.push({
          alert,
          totalExpenses,
          thresholdAmount: threshold,
          periodLabel,
        });
        
        // Log the alert
        await db.insert(expenseAlertLogs).values({
          alertId: alert.id,
          totalExpenses: String(totalExpenses),
          thresholdAmount: alert.thresholdAmount,
          periodStart,
          periodEnd: now,
          expenseCount: result?.count || 0,
          notificationSent: true,
          details: JSON.stringify({ 
            type: alert.alertType, 
            totalExpenses,
            categoryId: alert.categoryId,
          }),
        });
      }
    }
  }
  
  return { alertsTriggered };
}

// ============ COMPREHENSIVE P&L DASHBOARD FUNCTIONS ============

export async function getBatchProfitByShippingType(startDate: Date, endDate: Date) {
  const emptyResult = { air_regular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, air_irregular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, sea: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 } };
  const db = await getDb();
  if (!db) return emptyResult;
  try {
    // Try fetching with typed columns first, fall back to raw SQL if schema mismatch
    let batchList: { id: number; shippingType: string | null; shippingCost: string | null; totalWeight: string | null }[];
    try {
      batchList = (await db.select({ id: batches.id, shippingType: batches.shippingType, shippingCost: batches.shippingCost, actualWeightKg: batches.actualWeightKg, chargedWeightKg: batches.chargedWeightKg, totalWeight: batches.totalWeight, actualCbm: batches.actualCbm, chargedCbm: batches.chargedCbm }).from(batches).where(and(gte(batches.createdAt, startDate), lte(batches.createdAt, endDate)))) as any;
    } catch {
      // Fallback: minimal columns that should always exist
      const [rows] = (await db.execute(sql`SELECT id, shippingType, shippingCost, totalWeight FROM batches WHERE createdAt >= ${startDate} AND createdAt <= ${endDate}`)) as unknown as [any[]];
      batchList = (rows ?? []).map((r: any) => ({ id: Number(r.id), shippingType: r.shippingType, shippingCost: r.shippingCost, totalWeight: r.totalWeight }));
    }
    const result: Record<string, { revenue: number; cost: number; profit: number; count: number; totalWeight: number; totalCbm: number; batchCount: number }> = {
      air_regular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 },
      air_irregular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 },
      sea: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 },
    };
    if (batchList.length === 0) return result;
    const batchIds = batchList.map(b => b.id);
    let allPackages: { batchId: number | null; calculatedCostUsd: string | null }[];
    try {
      allPackages = await db.select({ batchId: packages.batchId, calculatedCostUsd: packages.calculatedCostUsd }).from(packages).where(inArray(packages.batchId, batchIds));
    } catch {
      // Fallback: raw SQL
      const [pkgRows] = (await db.execute(sql`SELECT batchId, calculatedCostUsd FROM packages WHERE batchId IN (${sql.raw(batchIds.join(','))})`)) as unknown as [any[]];
      allPackages = (pkgRows ?? []).map((r: any) => ({ batchId: r.batchId != null ? Number(r.batchId) : null, calculatedCostUsd: r.calculatedCostUsd != null ? String(r.calculatedCostUsd) : null }));
    }
    const packagesByBatch = new Map<number, { calculatedCostUsd: string | null }[]>();
    for (const pkg of allPackages) {
      if (pkg.batchId == null) continue;
      if (!packagesByBatch.has(pkg.batchId)) packagesByBatch.set(pkg.batchId, []);
      packagesByBatch.get(pkg.batchId)!.push({ calculatedCostUsd: pkg.calculatedCostUsd });
    }
    for (const batch of batchList) {
      const type = (batch as any).shippingType || 'air_regular';
      if (!result[type]) continue;
      result[type].batchCount++;
      result[type].cost += Number((batch as any).shippingCost || 0);
      result[type].totalWeight += Number((batch as any).actualWeightKg || (batch as any).chargedWeightKg || (batch as any).totalWeight || 0);
      result[type].totalCbm += Number((batch as any).actualCbm || (batch as any).chargedCbm || 0);
      const batchPackages = packagesByBatch.get(batch.id) ?? [];
      for (const pkg of batchPackages) {
        result[type].count++;
        result[type].revenue += Number(pkg.calculatedCostUsd || 0);
      }
      result[type].profit = result[type].revenue - result[type].cost;
    }
    return result;
  } catch (err) {
    appLogger.error("getBatchProfitByShippingType failed", { error: err instanceof Error ? err.message : String(err) });
    return emptyResult;
  }
}

export async function getFullPackageProfitBreakdown(startDate: Date, endDate: Date) {
  const emptyResult = { fullPackage: { revenue: 0, cost: 0, shippingCost: 0, profit: 0, count: 0 }, commission: { totalCommission: 0, count: 0 } };
  const db = await getDb();
  if (!db) return emptyResult;
  try {
    const fpOrders = await db.select().from(fullPackageOrders).where(and(gte(fullPackageOrders.createdAt, startDate), lte(fullPackageOrders.createdAt, endDate), eq(fullPackageOrders.orderType, 'full_package')));
    const fullPackageData = { revenue: 0, cost: 0, shippingCost: 0, profit: 0, count: fpOrders.length };
    for (const order of fpOrders) {
      const selling = Number(order.sellingPriceUsd || 0);
      const purchase = Number(order.purchasePriceUsd || 0);
      const shipping = Number(order.shippingCostUsd || 0);
      fullPackageData.revenue += selling;
      fullPackageData.cost += purchase;
      fullPackageData.shippingCost += shipping;
      fullPackageData.profit += (selling - purchase - shipping);
    }
    const commOrders = await db.select().from(fullPackageOrders).where(and(gte(fullPackageOrders.createdAt, startDate), lte(fullPackageOrders.createdAt, endDate), eq(fullPackageOrders.orderType, 'commission')));
    const commissionData = { totalCommission: 0, count: commOrders.length };
    for (const order of commOrders) {
      commissionData.totalCommission += Number(order.commissionFeeUsd || order.commissionAmount || 0);
    }
    return { fullPackage: fullPackageData, commission: commissionData };
  } catch (err) {
    appLogger.error("getFullPackageProfitBreakdown failed", { error: err instanceof Error ? err.message : String(err) });
    return emptyResult;
  }
}

export async function getServiceProfitBreakdown(startDate: Date, endDate: Date) {
  const emptyResult = { revenue: 0, cost: 0, profit: 0, count: 0, byType: [] as { typeId: number; typeName: string; revenue: number; cost: number; profit: number; count: number }[] };
  const db = await getDb();
  if (!db) return emptyResult;
  try {
    const services = await db.select().from(extraServices).where(and(gte(extraServices.createdAt, startDate), lte(extraServices.createdAt, endDate)));
    const typeMap = new Map<number, { typeName: string; revenue: number; cost: number; profit: number; count: number }>();
    let totalRevenue = 0, totalCost = 0, totalProfit = 0;
    let types: { id: number; nameKu: string | null; nameEn: string }[] = [];
    try { types = await db.select().from(serviceTypes) as any; } catch { /* serviceTypes may not exist */ }
    const typeNameMap = new Map<number, string>();
    for (const t of types) typeNameMap.set(t.id, t.nameKu || t.nameEn || `Service ${t.id}`);
    for (const svc of services) {
      const revenue = Number(svc.priceAmount || 0);
      const cost = Number(svc.costAmount || 0);
      const profit = Number(svc.profitAmount || 0) || (revenue - cost);
      totalRevenue += revenue; totalCost += cost; totalProfit += profit;
      const existing = typeMap.get(svc.serviceTypeId) || { typeName: typeNameMap.get(svc.serviceTypeId) || '', revenue: 0, cost: 0, profit: 0, count: 0 };
      existing.revenue += revenue; existing.cost += cost; existing.profit += profit; existing.count++;
      typeMap.set(svc.serviceTypeId, existing);
    }
    return { revenue: totalRevenue, cost: totalCost, profit: totalProfit, count: services.length, byType: Array.from(typeMap.entries()).map(([typeId, data]) => ({ typeId, ...data })) };
  } catch (err) {
    appLogger.error("getServiceProfitBreakdown failed", { error: err instanceof Error ? err.message : String(err) });
    return emptyResult;
  }
}

export async function getExpenseBreakdownDetailed(startDate: Date, endDate: Date) {
  const emptyResult = { categories: [] as { id: number; nameEn: string; nameKu: string; icon: string; color: string; amount: number; count: number; percentage: number }[], total: 0 };
  const db = await getDb();
  if (!db) return emptyResult;
  try {
    const expenseResult = await db.select({ categoryId: expenses.categoryId, amount: sql<number>`SUM(${expenses.amountUsd})`, count: sql<number>`COUNT(*)` }).from(expenses).where(and(gte(expenses.expenseDate, startDate), lte(expenses.expenseDate, endDate))).groupBy(expenses.categoryId);
    let allCategories: ExpenseCategory[] = [];
    try { allCategories = await db.select().from(expenseCategories); } catch { /* table may not exist */ }
    const catMap = new Map<number, ExpenseCategory>();
    for (const cat of allCategories) catMap.set(cat.id, cat);
    let total = 0;
    const categories = expenseResult.map(e => {
      const amount = Number(e.amount || 0);
      total += amount;
      const cat = catMap.get(e.categoryId);
      return { id: e.categoryId, nameEn: cat?.nameEn || 'Other', nameKu: cat?.nameKu || 'تر', icon: cat?.icon || '📦', color: cat?.color || '#6B7280', amount, count: Number(e.count || 0), percentage: 0 };
    });
    for (const cat of categories) cat.percentage = total > 0 ? (cat.amount / total) * 100 : 0;
    categories.sort((a, b) => b.amount - a.amount);
    return { categories, total };
  } catch (err) {
    appLogger.error("getExpenseBreakdownDetailed failed", { error: err instanceof Error ? err.message : String(err) });
    return emptyResult;
  }
}

export async function getMonthlyTrendData(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [] as { month: string; revenue: number; expenses: number; netProfit: number }[];
  const months: { month: string; startDate: Date; endDate: Date }[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (current <= endDate) {
    const monthStart = new Date(current);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    months.push({ month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`, startDate: monthStart, endDate: monthEnd > endDate ? endDate : monthEnd });
    current.setMonth(current.getMonth() + 1);
  }
  const results: { month: string; revenue: number; expenses: number; netProfit: number }[] = [];
  for (const m of months) {
    let revenue = 0, expenseTotal = 0;
    try {
      const txResult = await db.select({ amount: sql<number>`SUM(${ledgerTransactions.amountUsd})` }).from(ledgerTransactions).where(and(gte(ledgerTransactions.createdAt, m.startDate), lte(ledgerTransactions.createdAt, m.endDate), sql`${ledgerTransactions.transactionType} LIKE 'DEBIT_%'`));
      revenue += Number(txResult[0]?.amount || 0);
    } catch { /* ignore */ }
    try {
      const revResult = await db.select({ amount: sql<number>`SUM(${revenueRecords.amountUsd})` }).from(revenueRecords).where(and(gte(revenueRecords.createdAt, m.startDate), lte(revenueRecords.createdAt, m.endDate), eq(revenueRecords.status, 'confirmed')));
      if (revenue === 0) revenue += Number(revResult[0]?.amount || 0);
    } catch { /* ignore */ }
    try {
      const expResult = await db.select({ amount: sql<number>`SUM(${expenses.amountUsd})` }).from(expenses).where(and(gte(expenses.expenseDate, m.startDate), lte(expenses.expenseDate, m.endDate)));
      expenseTotal = Number(expResult[0]?.amount || 0);
    } catch { /* ignore */ }
    results.push({ month: m.month, revenue, expenses: expenseTotal, netProfit: revenue - expenseTotal });
  }
  return results;
}

export async function getActivityStats(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { packagesDelivered: 0, fullPackagesSold: 0, commissionOrders: 0, invoicesIssued: 0, paymentsReceived: 0, servicesCompleted: 0, totalCustomers: 0 };
  let packagesDelivered = 0, fullPackagesSold = 0, commissionOrders = 0, invoicesIssued = 0, paymentsReceived = 0, servicesCompleted = 0, totalCustomers = 0;
  try {
    const pkgResult = await db.select({ count: sql<number>`COUNT(*)` }).from(packages).where(and(eq(packages.status, 'delivered'), gte(packages.deliveredAt, startDate), lte(packages.deliveredAt, endDate)));
    packagesDelivered = Number(pkgResult[0]?.count || 0);
  } catch { /* ignore */ }
  try {
    const fpResult = await db.select({ count: sql<number>`COUNT(*)` }).from(fullPackageOrders).where(and(eq(fullPackageOrders.orderType, 'full_package'), gte(fullPackageOrders.createdAt, startDate), lte(fullPackageOrders.createdAt, endDate)));
    fullPackagesSold = Number(fpResult[0]?.count || 0);
  } catch { /* ignore */ }
  try {
    const commResult = await db.select({ count: sql<number>`COUNT(*)` }).from(fullPackageOrders).where(and(eq(fullPackageOrders.orderType, 'commission'), gte(fullPackageOrders.createdAt, startDate), lte(fullPackageOrders.createdAt, endDate)));
    commissionOrders = Number(commResult[0]?.count || 0);
  } catch { /* ignore */ }
  try {
    const invResult = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices).where(and(gte(invoices.createdAt, startDate), lte(invoices.createdAt, endDate)));
    invoicesIssued = Number(invResult[0]?.count || 0);
  } catch { /* ignore */ }
  try {
    const payResult = await db.select({ count: sql<number>`COUNT(*)` }).from(paymentRecords).where(and(gte(paymentRecords.createdAt, startDate), lte(paymentRecords.createdAt, endDate)));
    paymentsReceived = Number(payResult[0]?.count || 0);
  } catch { /* ignore */ }
  try {
    const svcResult = await db.select({ count: sql<number>`COUNT(*)` }).from(extraServices).where(and(gte(extraServices.createdAt, startDate), lte(extraServices.createdAt, endDate)));
    servicesCompleted = Number(svcResult[0]?.count || 0);
  } catch { /* ignore */ }
  try {
    const custResult = await db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(eq(customers.isActive, true));
    totalCustomers = Number(custResult[0]?.count || 0);
  } catch { /* ignore */ }
  return { packagesDelivered, fullPackagesSold, commissionOrders, invoicesIssued, paymentsReceived, servicesCompleted, totalCustomers };
}

const EMPTY_DASHBOARD_STATS = {
  revenueBySource: {
    batchProfit: { air_regular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, air_irregular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, sea: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, total: 0 },
    fullPackage: { revenue: 0, cost: 0, shippingCost: 0, profit: 0, count: 0 },
    commission: { totalCommission: 0, count: 0 },
    service: { revenue: 0, cost: 0, profit: 0, count: 0, byType: [] },
    totalRevenue: 0,
  },
  expenseBreakdown: { categories: [] as { id: number; nameEn: string; nameKu: string; icon: string; color: string; amount: number; count: number; percentage: number }[], total: 0 },
  profitLoss: { totalRevenue: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0, isProfit: true },
  monthlyTrend: [] as { month: string; revenue: number; expenses: number; netProfit: number }[],
  activity: { packagesDelivered: 0, fullPackagesSold: 0, commissionOrders: 0, invoicesIssued: 0, paymentsReceived: 0, servicesCompleted: 0, totalCustomers: 0 },
};

export async function getComprehensiveDashboardStats(startDate: Date, endDate: Date) {
  // Each sub-query is individually wrapped so ONE failure doesn't zero-out the entire dashboard
  const defaultBatchProfit = { air_regular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, air_irregular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, sea: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 } };
  const defaultFpProfit = { fullPackage: { revenue: 0, cost: 0, shippingCost: 0, profit: 0, count: 0 }, commission: { totalCommission: 0, count: 0 } };
  const defaultServiceProfit = { revenue: 0, cost: 0, profit: 0, count: 0, byType: [] as { typeId: number; typeName: string; revenue: number; cost: number; profit: number; count: number }[] };
  const defaultExpenseBreakdown = { categories: [] as { id: number; nameEn: string; nameKu: string; icon: string; color: string; amount: number; count: number; percentage: number }[], total: 0 };

  const safeCall = async <T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> => {
    try { return await fn(); } catch (err) {
      appLogger.error(`Dashboard sub-query [${label}] failed`, { error: err instanceof Error ? err.message : String(err) });
      return fallback;
    }
  };

  const defaultDeliveryBox = { totalCharge: 0, totalCost: 0, totalProfit: 0, boxCount: 0, packageCount: 0 };

  const [batchProfit, fpProfit, serviceProfit, expenseBreakdown, monthlyTrend, activity, deliveryBoxProfit] = await Promise.all([
    safeCall(() => getBatchProfitByShippingType(startDate, endDate), defaultBatchProfit, "batchProfit"),
    safeCall(() => getFullPackageProfitBreakdown(startDate, endDate), defaultFpProfit, "fullPackageProfit"),
    safeCall(() => getServiceProfitBreakdown(startDate, endDate), defaultServiceProfit, "serviceProfit"),
    safeCall(() => getExpenseBreakdownDetailed(startDate, endDate), defaultExpenseBreakdown, "expenseBreakdown"),
    safeCall(() => getMonthlyTrendData(startDate, endDate), [] as { month: string; revenue: number; expenses: number; netProfit: number }[], "monthlyTrend"),
    safeCall(() => getActivityStats(startDate, endDate), { packagesDelivered: 0, fullPackagesSold: 0, commissionOrders: 0, invoicesIssued: 0, paymentsReceived: 0, servicesCompleted: 0, totalCustomers: 0 }, "activityStats"),
    safeCall(() => getDeliveryBoxProfitBreakdown(startDate, endDate), defaultDeliveryBox, "deliveryBoxProfit"),
  ]);

  const batchRevenue = (batchProfit.air_regular?.profit || 0) + (batchProfit.air_irregular?.profit || 0) + (batchProfit.sea?.profit || 0);
  const fpRevenue = fpProfit?.fullPackage?.profit ?? 0;
  const commissionRevenue = fpProfit?.commission?.totalCommission ?? 0;
  const serviceRevenue = serviceProfit?.profit ?? 0;
  const deliveryRevenue = deliveryBoxProfit?.totalProfit ?? 0;
  const totalGrossRevenue = batchRevenue + fpRevenue + commissionRevenue + serviceRevenue + deliveryRevenue;
  const totalExpenses = expenseBreakdown?.total ?? 0;
  const netProfit = totalGrossRevenue - totalExpenses;
  const profitMargin = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;

  return {
    revenueBySource: { batchProfit: { air_regular: batchProfit.air_regular, air_irregular: batchProfit.air_irregular, sea: batchProfit.sea, total: batchRevenue }, fullPackage: { ...fpProfit?.fullPackage }, commission: { ...fpProfit?.commission }, service: serviceProfit, deliveryBox: deliveryBoxProfit, totalRevenue: totalGrossRevenue },
    expenseBreakdown,
    profitLoss: { totalRevenue: totalGrossRevenue, totalExpenses, netProfit, profitMargin, isProfit: netProfit >= 0 },
    monthlyTrend,
    activity,
  };
}

