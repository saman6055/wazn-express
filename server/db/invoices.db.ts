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

// ============ INVOICE OPERATIONS ============

export async function createInvoice(data: InsertInvoice): Promise<Invoice> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoices).values(data);
  const inserted = await db.select().from(invoices).where(eq(invoices.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getInvoiceById(id: number): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result[0];
}

export async function getInvoicesByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.customerId, customerId)).orderBy(desc(invoices.createdAt));
}

export async function getAllInvoices(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function getNextInvoiceNumber(): Promise<string> {
  const db = await getDb();
  if (!db) return "INV-000001";
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices);
  const count = (result[0]?.count || 0) + 1;
  return `INV-${count.toString().padStart(6, '0')}`;
}


// ============ INVOICE REPORTS ============

export interface InvoiceReportSummary {
  totalInvoices: number;
  totalAmountUsd: number;
  totalAmountIqd: number;
  paidInvoices: number;
  paidAmountUsd: number;
  unpaidInvoices: number;
  unpaidAmountUsd: number;
  cancelledInvoices: number;
  averageInvoiceUsd: number;
}

export interface MonthlyInvoiceData {
  month: string; // YYYY-MM format
  year: number;
  monthNumber: number;
  totalInvoices: number;
  totalAmountUsd: number;
  paidInvoices: number;
  paidAmountUsd: number;
  unpaidInvoices: number;
  unpaidAmountUsd: number;
}

export interface CustomerInvoiceSummary {
  customerId: number;
  customerCode: string;
  customerName: string;
  totalInvoices: number;
  totalAmountUsd: number;
  paidAmountUsd: number;
  unpaidAmountUsd: number;
  lastInvoiceDate: Date | null;
}

export interface ServiceTypeInvoiceSummary {
  serviceType: string;
  totalInvoices: number;
  totalAmountUsd: number;
  averageAmountUsd: number;
}

// Get invoice summary for a date range
export async function getInvoiceSummary(startDate?: Date, endDate?: Date): Promise<InvoiceReportSummary> {
  const db = await getDb();
  if (!db) {
    return {
      totalInvoices: 0,
      totalAmountUsd: 0,
      totalAmountIqd: 0,
      paidInvoices: 0,
      paidAmountUsd: 0,
      unpaidInvoices: 0,
      unpaidAmountUsd: 0,
      cancelledInvoices: 0,
      averageInvoiceUsd: 0
    };
  }

  let query = db.select({
    id: invoices.id,
    totalUsd: invoices.totalUsd,
    totalIqd: invoices.totalIqd,
    status: invoices.status,
  }).from(invoices);

  // Apply date filters
  const conditions: any[] = [];
  if (startDate) {
    conditions.push(gte(invoices.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(invoices.createdAt, endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const allInvoices = await query;

  const totalInvoices = allInvoices.length;
  const totalAmountUsd = allInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalUsd || '0'), 0);
  const totalAmountIqd = allInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalIqd || '0'), 0);
  
  const paidInvoices = allInvoices.filter(inv => inv.status === 'paid').length;
  const paidAmountUsd = allInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + parseFloat(inv.totalUsd || '0'), 0);
  
  const unpaidInvoices = allInvoices.filter(inv => inv.status === 'issued' || inv.status === 'draft').length;
  const unpaidAmountUsd = allInvoices
    .filter(inv => inv.status === 'issued' || inv.status === 'draft')
    .reduce((sum, inv) => sum + parseFloat(inv.totalUsd || '0'), 0);
  
  const cancelledInvoices = allInvoices.filter(inv => inv.status === 'cancelled').length;
  const averageInvoiceUsd = totalInvoices > 0 ? totalAmountUsd / totalInvoices : 0;

  return {
    totalInvoices,
    totalAmountUsd,
    totalAmountIqd,
    paidInvoices,
    paidAmountUsd,
    unpaidInvoices,
    unpaidAmountUsd,
    cancelledInvoices,
    averageInvoiceUsd
  };
}

// Get monthly invoice breakdown for a year
export async function getMonthlyInvoiceReport(year: number): Promise<MonthlyInvoiceData[]> {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const allInvoices = await db.select({
    id: invoices.id,
    totalUsd: invoices.totalUsd,
    status: invoices.status,
    createdAt: invoices.createdAt,
  })
  .from(invoices)
  .where(and(
    gte(invoices.createdAt, startDate),
    lte(invoices.createdAt, endDate)
  ));

  // Group by month
  const monthlyData: Map<string, MonthlyInvoiceData> = new Map();
  
  // Initialize all 12 months
  for (let month = 0; month < 12; month++) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    monthlyData.set(monthKey, {
      month: monthKey,
      year,
      monthNumber: month + 1,
      totalInvoices: 0,
      totalAmountUsd: 0,
      paidInvoices: 0,
      paidAmountUsd: 0,
      unpaidInvoices: 0,
      unpaidAmountUsd: 0
    });
  }

  // Populate with actual data
  for (const inv of allInvoices) {
    const date = new Date(inv.createdAt!);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const data = monthlyData.get(monthKey);
    
    if (data) {
      data.totalInvoices++;
      data.totalAmountUsd += parseFloat(inv.totalUsd || '0');
      
      if (inv.status === 'paid') {
        data.paidInvoices++;
        data.paidAmountUsd += parseFloat(inv.totalUsd || '0');
      } else if (inv.status === 'issued' || inv.status === 'draft') {
        data.unpaidInvoices++;
        data.unpaidAmountUsd += parseFloat(inv.totalUsd || '0');
      }
    }
  }

  return Array.from(monthlyData.values()).sort((a, b) => a.monthNumber - b.monthNumber);
}

// Get yearly invoice summary for multiple years
export async function getYearlyInvoiceReport(years: number[]): Promise<{ year: number; summary: InvoiceReportSummary }[]> {
  const results: { year: number; summary: InvoiceReportSummary }[] = [];
  
  for (const year of years) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    const summary = await getInvoiceSummary(startDate, endDate);
    results.push({ year, summary });
  }
  
  return results.sort((a, b) => b.year - a.year);
}

// Get invoice statistics by customer
export async function getInvoicesByCustomerReport(startDate?: Date, endDate?: Date, limit = 50): Promise<CustomerInvoiceSummary[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select({
    customerId: invoices.customerId,
    totalUsd: invoices.totalUsd,
    status: invoices.status,
    createdAt: invoices.createdAt,
  }).from(invoices);

  const conditions: any[] = [];
  if (startDate) conditions.push(gte(invoices.createdAt, startDate));
  if (endDate) conditions.push(lte(invoices.createdAt, endDate));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const allInvoices = await query;

  // Group by customer
  const customerMap: Map<number, {
    totalInvoices: number;
    totalAmountUsd: number;
    paidAmountUsd: number;
    unpaidAmountUsd: number;
    lastInvoiceDate: Date | null;
  }> = new Map();

  for (const inv of allInvoices) {
    const existing = customerMap.get(inv.customerId) || {
      totalInvoices: 0,
      totalAmountUsd: 0,
      paidAmountUsd: 0,
      unpaidAmountUsd: 0,
      lastInvoiceDate: null
    };

    existing.totalInvoices++;
    existing.totalAmountUsd += parseFloat(inv.totalUsd || '0');
    
    if (inv.status === 'paid') {
      existing.paidAmountUsd += parseFloat(inv.totalUsd || '0');
    } else if (inv.status === 'issued' || inv.status === 'draft') {
      existing.unpaidAmountUsd += parseFloat(inv.totalUsd || '0');
    }

    if (!existing.lastInvoiceDate || new Date(inv.createdAt!) > existing.lastInvoiceDate) {
      existing.lastInvoiceDate = new Date(inv.createdAt!);
    }

    customerMap.set(inv.customerId, existing);
  }

  // Get customer details (from customers table)
  const customerIds = Array.from(customerMap.keys());
  const customerDetails = await db.select({
    id: customers.id,
    customerCode: customers.customerCode,
    fullName: customers.fullName,
  })
  .from(customers)
  .where(inArray(customers.id, customerIds));

  const customerLookup = new Map(customerDetails.map(c => [c.id, c]));

  const results: CustomerInvoiceSummary[] = [];
  for (const [customerId, data] of Array.from(customerMap)) {
    const customer = customerLookup.get(customerId);
    results.push({
      customerId,
      customerCode: customer?.customerCode || 'Unknown',
      customerName: customer?.fullName || 'Unknown',
      ...data
    });
  }

  // Sort by total amount descending
  return results.sort((a, b) => b.totalAmountUsd - a.totalAmountUsd).slice(0, limit);
}

// Get invoice statistics by service type (based on line items)
export async function getInvoicesByServiceTypeReport(startDate?: Date, endDate?: Date): Promise<ServiceTypeInvoiceSummary[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select({
    id: invoices.id,
    totalUsd: invoices.totalUsd,
    lineItems: invoices.lineItems,
    createdAt: invoices.createdAt,
  }).from(invoices);

  const conditions: any[] = [];
  if (startDate) conditions.push(gte(invoices.createdAt, startDate));
  if (endDate) conditions.push(lte(invoices.createdAt, endDate));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const allInvoices = await query;

  // Group by service type from line items
  const serviceTypeMap: Map<string, {
    totalInvoices: number;
    totalAmountUsd: number;
  }> = new Map();

  for (const inv of allInvoices) {
    const lineItems = inv.lineItems || [];
    for (const item of lineItems) {
      // Extract service type from description
      let serviceType = 'Other';
      const desc = item.description.toLowerCase();
      
      if (desc.includes('package') || desc.includes('پاکەت')) {
        serviceType = 'Package Shipping';
      } else if (desc.includes('full package') || desc.includes('فول پاکێج')) {
        serviceType = 'Full Package';
      } else if (desc.includes('purchase') || desc.includes('کڕین')) {
        serviceType = 'Purchase Request';
      } else if (desc.includes('commission') || desc.includes('کۆمیشن')) {
        serviceType = 'Commission Purchase';
      } else if (desc.includes('delivery') || desc.includes('گەیاندن')) {
        serviceType = 'Delivery';
      } else if (desc.includes('arrival') || desc.includes('گەیشتن')) {
        serviceType = 'Arrival Charge';
      }

      const existing = serviceTypeMap.get(serviceType) || {
        totalInvoices: 0,
        totalAmountUsd: 0
      };

      existing.totalInvoices++;
      existing.totalAmountUsd += item.total || 0;
      serviceTypeMap.set(serviceType, existing);
    }
  }

  const results: ServiceTypeInvoiceSummary[] = [];
  for (const [serviceType, data] of Array.from(serviceTypeMap)) {
    results.push({
      serviceType,
      totalInvoices: data.totalInvoices,
      totalAmountUsd: data.totalAmountUsd,
      averageAmountUsd: data.totalInvoices > 0 ? data.totalAmountUsd / data.totalInvoices : 0
    });
  }

  return results.sort((a, b) => b.totalAmountUsd - a.totalAmountUsd);
}

// Get recent invoices with pagination
export async function getRecentInvoices(page = 1, pageSize = 20, status?: string, customerId?: number) {
  const db = await getDb();
  if (!db) return { invoices: [], total: 0 };

  const conditions: any[] = [];
  if (status) conditions.push(eq(invoices.status, status as any));
  if (customerId) conditions.push(eq(invoices.customerId, customerId));

  const offset = (page - 1) * pageSize;

  let query = db.select().from(invoices);
  let countQuery = db.select({ count: count() }).from(invoices);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
    countQuery = countQuery.where(and(...conditions)) as any;
  }

  const [invoiceList, countResult] = await Promise.all([
    query.orderBy(desc(invoices.createdAt)).limit(pageSize).offset(offset),
    countQuery
  ]);

  const total = countResult[0]?.count || 0;
  return {
    invoices: invoiceList,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

