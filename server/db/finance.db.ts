import { getDb } from './connection';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { generateAccountNumber, generateTransactionNumber, generatePaymentNumber } from './utils.db';
import { createInvoice } from './invoices.db';
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

// ============ LEDGER OPERATIONS ============


// ============ LEGACY LEDGER FUNCTIONS REMOVED ============
// createLedgerEntry and getCustomerLedger have been removed.
// Use recordLedgerTransaction and getCustomerTransactionHistory instead.
// All financial transactions now use the unified ledgerTransactions table.

export async function getCustomerBalance(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Use unified ledger system (customerAccounts)
  let accountResult = await db.select().from(customerAccounts)
    .where(eq(customerAccounts.customerId, customerId))
    .limit(1);
  
  // Auto-create account if not exists
  if (!accountResult[0]) {
    // Get customer info for account number (from customers table)
    const customer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (customer[0]) {
      const accountNumber = `ACC-${customer[0].customerCode || customerId}-${new Date().getFullYear()}`;
      try {
        await db.insert(customerAccounts).values({
          customerId,
          accountNumber,
          currentBalanceUsd: "0",
          currentBalanceIqd: "0",
          packageDebtUsd: "0",
          fullPackageDebtUsd: "0",
          purchaseRequestDebtUsd: "0",
          commissionDebtUsd: "0",
          serviceDebtUsd: "0",
          creditBalanceUsd: "0",
          creditBalanceIqd: "0",
          totalDebitUsd: "0",
          totalCreditUsd: "0",
          totalDebitIqd: "0",
          totalCreditIqd: "0",
        });
        console.log(`[Balance] Auto-created account for customer ${customerId}`);
        // Re-fetch the account
        accountResult = await db.select().from(customerAccounts)
          .where(eq(customerAccounts.customerId, customerId))
          .limit(1);
      } catch (err) {
        console.error(`[Balance] Failed to auto-create account:`, err);
      }
    }
  }
  
  if (accountResult[0]) {
    return parseFloat(accountResult[0].currentBalanceUsd || '0');
  }
  
  return 0;
}

// DEPRECATED: Use getAllLedgerTransactions instead
export async function getAllLedgerEntries(limit = 100) {
  console.warn('[DEPRECATED] getAllLedgerEntries is deprecated. Use getAllLedgerTransactions instead.');
  const result = await getAllLedgerTransactions({ limit, page: 1 });
  return result.data;
}

const ALL_LEDGER_DEFAULT_LIMIT = 50;

// Get all ledger transactions from unified system (paginated, explicit columns; optional cursor)
export async function getAllLedgerTransactions(options: { limit?: number; page?: number; cursor?: number } = {}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page: 1, pageSize: ALL_LEDGER_DEFAULT_LIMIT, totalPages: 0, nextCursor: undefined as number | undefined };
  const pageSize = Math.min(100, options.limit ?? ALL_LEDGER_DEFAULT_LIMIT);
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * pageSize;
  const cursor = options.cursor;
  const dataWhereClause = cursor != null ? lt(ledgerTransactions.id, cursor) : undefined;
  const countResult = await db.select({ count: count() }).from(ledgerTransactions);
  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const data = await db.select({
    id: ledgerTransactions.id,
    accountId: ledgerTransactions.accountId,
    transactionNumber: ledgerTransactions.transactionNumber,
    transactionType: ledgerTransactions.transactionType,
    amountUsd: ledgerTransactions.amountUsd,
    amountIqd: ledgerTransactions.amountIqd,
    balanceAfterUsd: ledgerTransactions.balanceAfterUsd,
    referenceType: ledgerTransactions.referenceType,
    referenceId: ledgerTransactions.referenceId,
    description: ledgerTransactions.description,
    createdAt: ledgerTransactions.createdAt,
  })
    .from(ledgerTransactions)
    .where(dataWhereClause)
    .orderBy(desc(ledgerTransactions.id))
    .limit(pageSize)
    .offset(cursor != null ? 0 : offset);
  const nextCursor = cursor != null && data.length === pageSize && data.length > 0 ? (data[data.length - 1] as { id: number }).id : undefined;
  return { data, total, page, pageSize, totalPages, nextCursor };
}


// ============ EXCHANGE RATE OPERATIONS ============

export async function createExchangeRate(data: InsertExchangeRate): Promise<ExchangeRate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(exchangeRates).values(data);
  const inserted = await db.select().from(exchangeRates).where(eq(exchangeRates.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getCurrentExchangeRate(targetCurrency: string): Promise<ExchangeRate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const result = await db.select().from(exchangeRates).where(
    and(
      eq(exchangeRates.targetCurrency, targetCurrency),
      lte(exchangeRates.effectiveFrom, now),
      or(isNull(exchangeRates.effectiveTo), gte(exchangeRates.effectiveTo, now))
    )
  ).orderBy(desc(exchangeRates.effectiveFrom)).limit(1);
  return result[0];
}

export async function getAllExchangeRates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exchangeRates).orderBy(desc(exchangeRates.effectiveFrom));
}


// ============ CUSTOMER LEDGER SYSTEM ============

// Create customer account
export async function createCustomerAccount(data: InsertCustomerAccount): Promise<CustomerAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(customerAccounts).values(data);
  const insertId = result[0].insertId;
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, insertId));
  return account;
}

// Get customer account by customer ID
export async function getCustomerAccountByCustomerId(customerId: number): Promise<CustomerAccount | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.customerId, customerId));
  return account || null;
}

// Get customer account by account number
export async function getCustomerAccountByNumber(accountNumber: string): Promise<CustomerAccount | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.accountNumber, accountNumber));
  return account || null;
}

// Get or create customer account
export async function getOrCreateCustomerAccount(customerId: number, customerCode: string): Promise<CustomerAccount> {
  const existing = await getCustomerAccountByCustomerId(customerId);
  if (existing) return existing;
  
  return await createCustomerAccount({
    customerId,
    accountNumber: generateAccountNumber(customerCode),
    currentBalanceUsd: "0",
    currentBalanceIqd: "0",
  });
}

// Update customer account balance
export async function updateCustomerAccountBalance(
  accountId: number, 
  newBalanceUsd: string, 
  newBalanceIqd: string,
  updateTotals?: { debitUsd?: string; creditUsd?: string; debitIqd?: string; creditIqd?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {
    currentBalanceUsd: newBalanceUsd,
    currentBalanceIqd: newBalanceIqd,
    lastTransactionAt: new Date(),
  };
  
  if (updateTotals) {
    if (updateTotals.debitUsd) updateData.totalDebitUsd = sql`totalDebitUsd + ${updateTotals.debitUsd}`;
    if (updateTotals.creditUsd) updateData.totalCreditUsd = sql`totalCreditUsd + ${updateTotals.creditUsd}`;
    if (updateTotals.debitIqd) updateData.totalDebitIqd = sql`totalDebitIqd + ${updateTotals.debitIqd}`;
    if (updateTotals.creditIqd) updateData.totalCreditIqd = sql`totalCreditIqd + ${updateTotals.creditIqd}`;
  }
  
  await db.update(customerAccounts).set(updateData).where(eq(customerAccounts.id, accountId));
}

// Create ledger transaction
export async function createLedgerTransaction(data: InsertLedgerTransaction): Promise<LedgerTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ledgerTransactions).values(data);
  const insertId = result[0].insertId;
  const [transaction] = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.id, insertId));
  return transaction;
}

const LEDGER_DEFAULT_LIMIT = 50;

// Get ledger transactions for account (cursor-based when cursor provided)
export async function getAccountLedgerTransactions(
  accountId: number,
  options: { limit?: number; cursor?: number } = {}
): Promise<{ data: LedgerTransaction[]; nextCursor: number | null }> {
  const db = await getDb();
  if (!db) return { data: [], nextCursor: null };
  const limit = Math.min(100, options.limit ?? LEDGER_DEFAULT_LIMIT);
  const conditions = [eq(ledgerTransactions.accountId, accountId)];
  if (options.cursor != null) {
    conditions.push(lt(ledgerTransactions.id, options.cursor));
  }
  const data = await db.select({
    id: ledgerTransactions.id,
    accountId: ledgerTransactions.accountId,
    transactionNumber: ledgerTransactions.transactionNumber,
    transactionType: ledgerTransactions.transactionType,
    amountUsd: ledgerTransactions.amountUsd,
    amountIqd: ledgerTransactions.amountIqd,
    balanceBeforeUsd: ledgerTransactions.balanceBeforeUsd,
    balanceAfterUsd: ledgerTransactions.balanceAfterUsd,
    balanceBeforeIqd: ledgerTransactions.balanceBeforeIqd,
    balanceAfterIqd: ledgerTransactions.balanceAfterIqd,
    referenceType: ledgerTransactions.referenceType,
    referenceId: ledgerTransactions.referenceId,
    description: ledgerTransactions.description,
    invoiceId: ledgerTransactions.invoiceId,
    createdAt: ledgerTransactions.createdAt,
  })
    .from(ledgerTransactions)
    .where(and(...conditions))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(limit + 1);
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;
  return { data: items as LedgerTransaction[], nextCursor };
}

// Create payment record
export async function createPaymentRecord(data: InsertPaymentRecord): Promise<PaymentRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(paymentRecords).values(data);
  const insertId = result[0].insertId;
  const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, insertId));
  return payment;
}

// Get payment record by ID
export async function getPaymentRecordById(id: number): Promise<PaymentRecord | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [record] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, id));
  return record || null;
}

// Get payment records for account
export async function getAccountPaymentRecords(accountId: number, limit = 50): Promise<PaymentRecord[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(paymentRecords)
    .where(eq(paymentRecords.accountId, accountId))
    .orderBy(desc(paymentRecords.createdAt))
    .limit(limit);
}

// Get recent payment records across all accounts (for accountant dashboard)
export async function getRecentPayments(limit = 20): Promise<(PaymentRecord & { customerName?: string; customerCode?: string })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(paymentRecords)
    .orderBy(desc(paymentRecords.createdAt))
    .limit(limit);
  const accountIds = [...new Set(rows.map((r) => r.accountId))];
  const accounts = accountIds.length > 0
    ? await db.select().from(customerAccounts).where(inArray(customerAccounts.id, accountIds))
    : [];
  const customerIds = [...new Set(accounts.map((a) => a.customerId))];
  const customersList = customerIds.length > 0
    ? await db.select({ id: customers.id, fullName: customers.fullName, customerCode: customers.customerCode }).from(customers).where(inArray(customers.id, customerIds))
    : [];
  const accountToCustomer = new Map<number, { fullName: string; customerCode: string }>();
  for (const a of accounts) {
    const c = customersList.find((x) => x.id === a.customerId);
    if (c) accountToCustomer.set(a.id, { fullName: c.fullName || "", customerCode: c.customerCode || "" });
  }
  return rows.map((r) => {
    const cust = accountToCustomer.get(r.accountId);
    return { ...r, customerName: cust?.fullName, customerCode: cust?.customerCode };
  });
}

// Get customer balance distribution (debt / credit / zero) for pie chart
export async function getBalanceDistribution(): Promise<{ debtCount: number; creditCount: number; zeroCount: number }> {
  const db = await getDb();
  if (!db) return { debtCount: 0, creditCount: 0, zeroCount: 0 };
  const accounts = await db.select({ balanceUsd: customerAccounts.currentBalanceUsd }).from(customerAccounts);
  let debtCount = 0;
  let creditCount = 0;
  let zeroCount = 0;
  for (const a of accounts) {
    const b = parseFloat(String(a.balanceUsd ?? 0));
    if (b > 0) debtCount++;
    else if (b < 0) creditCount++;
    else zeroCount++;
  }
  return { debtCount, creditCount, zeroCount };
}

// Get all customer accounts with customer info
export async function getAllCustomerAccountsWithInfo(): Promise<(CustomerAccount & { customer?: Customer })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const accounts = await db.select().from(customerAccounts).orderBy(desc(customerAccounts.currentBalanceUsd));
  const customersList = await db.select().from(customers);
  
  return accounts.map(account => ({
    ...account,
    customer: customersList.find(c => c.id === account.customerId)
  }));
}

// Get debtors (customers with positive balance = they owe money)
// Uses unified customerAccounts table for balance
export async function getDebtors(minBalanceUsd = 0): Promise<{ customerId: number; balanceUsd: number; balanceIqd: number; customer?: Customer }[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get all customer accounts with positive balance (debt)
  const accountsWithDebt = await db.select({
    customerId: customerAccounts.customerId,
    balanceUsd: customerAccounts.currentBalanceUsd,
    balanceIqd: customerAccounts.currentBalanceIqd,
  }).from(customerAccounts)
    .where(gt(customerAccounts.currentBalanceUsd, sql`${minBalanceUsd}`))
    .orderBy(desc(customerAccounts.currentBalanceUsd));
  
  // Get customer details for each debtor
  const customerIds = accountsWithDebt.map(a => a.customerId);
  const customersList = customerIds.length > 0 
    ? await db.select().from(customers).where(inArray(customers.id, customerIds))
    : [];
  
  // Map accounts to debtors with customer info
  return accountsWithDebt.map(account => ({
    customerId: account.customerId,
    balanceUsd: Number(account.balanceUsd) || 0,
    balanceIqd: Number(account.balanceIqd) || 0,
    customer: customersList.find(c => c.id === account.customerId)
  }));
}

// Get total debt amount
export async function getTotalDebtAmount(): Promise<{ totalUsd: number; totalIqd: number; count: number }> {
  // Use getDebtors to get accurate debt calculation from all sources
  const debtors = await getDebtors(0);
  
  const totalUsd = debtors.reduce((sum, d) => sum + d.balanceUsd, 0);
  const totalIqd = debtors.reduce((sum, d) => sum + d.balanceIqd, 0);
  
  return {
    totalUsd,
    totalIqd,
    count: debtors.length
  };
}

// Get financial summary
export async function getFinancialSummary(): Promise<{
  totalDebtUsd: number;
  totalDebtIqd: number;
  totalCreditUsd: number;
  totalCreditIqd: number;
  debtorsCount: number;
  creditorsCount: number;
  totalAccounts: number;
}> {
  const db = await getDb();
  if (!db) return { totalDebtUsd: 0, totalDebtIqd: 0, totalCreditUsd: 0, totalCreditIqd: 0, debtorsCount: 0, creditorsCount: 0, totalAccounts: 0 };
  
  // Get all financial data from customerAccounts directly
  const result = await db.select({
    totalDebtUsd: sql<string>`COALESCE(SUM(CASE WHEN CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) > 0 THEN CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) ELSE 0 END), 0)`,
    totalDebtIqd: sql<string>`COALESCE(SUM(CASE WHEN CAST(${customerAccounts.currentBalanceIqd} AS DECIMAL(15,0)) > 0 THEN CAST(${customerAccounts.currentBalanceIqd} AS DECIMAL(15,0)) ELSE 0 END), 0)`,
    totalCreditUsd: sql<string>`COALESCE(SUM(CASE WHEN CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) < 0 THEN ABS(CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))) ELSE 0 END), 0)`,
    totalCreditIqd: sql<string>`COALESCE(SUM(CASE WHEN CAST(${customerAccounts.currentBalanceIqd} AS DECIMAL(15,0)) < 0 THEN ABS(CAST(${customerAccounts.currentBalanceIqd} AS DECIMAL(15,0))) ELSE 0 END), 0)`,
    debtorsCount: sql<number>`COUNT(CASE WHEN CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) > 0 THEN 1 END)`,
    creditorsCount: sql<number>`COUNT(CASE WHEN CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2)) < 0 THEN 1 END)`,
    totalAccounts: sql<number>`COUNT(*)`
  }).from(customerAccounts);
  
  return {
    totalDebtUsd: parseFloat(result[0]?.totalDebtUsd || '0'),
    totalDebtIqd: parseFloat(result[0]?.totalDebtIqd || '0'),
    totalCreditUsd: parseFloat(result[0]?.totalCreditUsd || '0'),
    totalCreditIqd: parseFloat(result[0]?.totalCreditIqd || '0'),
    debtorsCount: result[0]?.debtorsCount || 0,
    creditorsCount: result[0]?.creditorsCount || 0,
    totalAccounts: result[0]?.totalAccounts || 0
  };
}


// ============ UNIFIED CHARGE SYSTEM ============

// Generate unique invoice number
function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

// Get charge type display name
function getChargeTypeDisplayName(chargeType: string, language: 'en' | 'ku' | 'ar' = 'ku'): { name: string, nameKu: string, nameAr: string } {
  const names: Record<string, { name: string, nameKu: string, nameAr: string }> = {
    'PACKAGE': { name: 'Package Delivery', nameKu: 'گەیاندنی بار', nameAr: 'توصيل الطرد' },
    'FULL_PACKAGE': { name: 'Full Package Order', nameKu: 'داواکاری پاکەیجی تەواو', nameAr: 'طلب الحزمة الكاملة' },
    'PURCHASE_REQUEST': { name: 'Purchase Request', nameKu: 'داواکاری کڕین', nameAr: 'طلب الشراء' },
    'COMMISSION': { name: 'Commission Order', nameKu: 'داواکاری کۆمیشن', nameAr: 'طلب العمولة' },
    'SERVICE': { name: 'Service Fee', nameKu: 'کرێی خزمەتگوزاری', nameAr: 'رسوم الخدمة' }
  };
  return names[chargeType] || { name: 'Other Charge', nameKu: 'کرێی تر', nameAr: 'رسوم أخرى' };
}

// Unified charge function for all transaction types
// Automatically creates an invoice for every DEBIT transaction
export async function applyCharge(
  customerId: number,
  customerCode: string,
  chargeType: 'PACKAGE' | 'FULL_PACKAGE' | 'PURCHASE_REQUEST' | 'COMMISSION' | 'SERVICE',
  referenceId: number,
  amountUsd: number,
  description: string,
  createdById: number,
  lineItems?: { description: string; quantity: number; unitPrice: number; total: number }[]
): Promise<{ transaction: LedgerTransaction; invoice: Invoice }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const account = await getOrCreateCustomerAccount(customerId, customerCode);
  
  const currentBalanceUsd = parseFloat(account.currentBalanceUsd || '0');
  const currentBalanceIqd = parseFloat(account.currentBalanceIqd || '0');
  const newBalanceUsd = currentBalanceUsd + amountUsd;
  
  // Map charge type to transaction type and reference type
  const typeMapping: Record<typeof chargeType, { transactionType: string, referenceType: string }> = {
    'PACKAGE': { transactionType: 'DEBIT_PACKAGE', referenceType: 'package' },
    'FULL_PACKAGE': { transactionType: 'DEBIT_FULL_PACKAGE', referenceType: 'full_package' },
    'PURCHASE_REQUEST': { transactionType: 'DEBIT_PURCHASE_REQUEST', referenceType: 'purchase_request' },
    'COMMISSION': { transactionType: 'DEBIT_COMMISSION', referenceType: 'commission' },
    'SERVICE': { transactionType: 'DEBIT_SERVICE', referenceType: 'service' }
  };
  
  const { transactionType, referenceType } = typeMapping[chargeType];
  const chargeTypeNames = getChargeTypeDisplayName(chargeType);
  
  // Create invoice first
  const invoiceNumber = generateInvoiceNumber();
  const defaultLineItems = lineItems || [{
    description: `${chargeTypeNames.nameKu} / ${chargeTypeNames.name}`,
    quantity: 1,
    unitPrice: amountUsd,
    total: amountUsd
  }];
  
  const invoice = await createInvoice({
    invoiceNumber,
    customerId,
    packageId: referenceType === 'package' ? referenceId : null,
    batchId: null,
    subtotalUsd: amountUsd.toFixed(2),
    taxUsd: '0',
    totalUsd: amountUsd.toFixed(2),
    status: 'issued',
    issuedAt: new Date(),
    lineItems: defaultLineItems,
    notes: description,
    createdById
  });
  
  // Create ledger transaction with invoice link
  const transaction = await createLedgerTransaction({
    accountId: account.id,
    transactionNumber: generateTransactionNumber(),
    transactionType: transactionType as any,
    amountUsd: amountUsd.toFixed(2),
    amountIqd: '0',
    balanceBeforeUsd: currentBalanceUsd.toFixed(2),
    balanceAfterUsd: newBalanceUsd.toFixed(2),
    balanceBeforeIqd: currentBalanceIqd.toFixed(0),
    balanceAfterIqd: currentBalanceIqd.toFixed(0),
    referenceType: referenceType as any,
    referenceId,
    description,
    invoiceId: invoice.id,
    createdById
  });
  
  // Update account balance
  await updateCustomerAccountBalance(account.id, newBalanceUsd.toFixed(2), currentBalanceIqd.toFixed(0));
  
  return { transaction, invoice };
}

// Record package charge (when package is delivered)
// Wrapper around applyCharge for backward compatibility
export async function recordPackageCharge(
  customerId: number,
  customerCode: string,
  packageId: number,
  amountUsd: number,
  description: string,
  createdById: number
): Promise<LedgerTransaction> {
  const result = await applyCharge(customerId, customerCode, 'PACKAGE', packageId, amountUsd, description, createdById);
  return result.transaction;
}

// Record package charge WITHOUT creating an invoice (for batch processing)
// Use this when you want to create a consolidated invoice separately
export async function recordPackageChargeWithoutInvoice(
  customerId: number,
  customerCode: string,
  packageId: number,
  amountUsd: number,
  description: string,
  createdById: number,
  invoiceId?: number
): Promise<LedgerTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const account = await getOrCreateCustomerAccount(customerId, customerCode);
  
  const currentBalanceUsd = parseFloat(account.currentBalanceUsd || '0');
  const currentBalanceIqd = parseFloat(account.currentBalanceIqd || '0');
  const newBalanceUsd = currentBalanceUsd + amountUsd;
  
  // Create ledger transaction (without creating invoice)
  const transaction = await createLedgerTransaction({
    accountId: account.id,
    transactionNumber: generateTransactionNumber(),
    transactionType: 'DEBIT_PACKAGE' as any,
    amountUsd: amountUsd.toFixed(2),
    amountIqd: '0',
    balanceBeforeUsd: currentBalanceUsd.toFixed(2),
    balanceAfterUsd: newBalanceUsd.toFixed(2),
    balanceBeforeIqd: currentBalanceIqd.toFixed(0),
    balanceAfterIqd: currentBalanceIqd.toFixed(0),
    referenceType: 'package' as any,
    referenceId: packageId,
    description,
    invoiceId: invoiceId || null,
    createdById
  });
  
  // Update account balance
  await updateCustomerAccountBalance(account.id, newBalanceUsd.toFixed(2), currentBalanceIqd.toFixed(0));
  
  return transaction;
}

// Record payment received
export async function recordPaymentReceived(
  customerId: number,
  customerCode: string,
  amountUsd: number,
  amountIqd: number,
  paymentMethod: InsertPaymentRecord['paymentMethod'],
  receivedById: number,
  notes?: string,
  receiptNumber?: string
): Promise<{ transaction: LedgerTransaction; payment: PaymentRecord }> {
  const account = await getOrCreateCustomerAccount(customerId, customerCode);
  
  const currentBalanceUsd = parseFloat(account.currentBalanceUsd || '0');
  const currentBalanceIqd = parseFloat(account.currentBalanceIqd || '0');
  const newBalanceUsd = currentBalanceUsd - amountUsd;
  const newBalanceIqd = currentBalanceIqd - amountIqd;
  
  // Create ledger transaction
  const transaction = await createLedgerTransaction({
    accountId: account.id,
    transactionNumber: generateTransactionNumber(),
    transactionType: 'CREDIT_PAYMENT',
    amountUsd: amountUsd.toFixed(2),
    amountIqd: amountIqd.toFixed(0),
    balanceBeforeUsd: currentBalanceUsd.toFixed(2),
    balanceAfterUsd: newBalanceUsd.toFixed(2),
    balanceBeforeIqd: currentBalanceIqd.toFixed(0),
    balanceAfterIqd: newBalanceIqd.toFixed(0),
    referenceType: 'payment',
    description: notes || 'Payment received',
    createdById: receivedById
  });
  
  // Create payment record
  const payment = await createPaymentRecord({
    accountId: account.id,
    transactionId: transaction.id,
    paymentNumber: generatePaymentNumber(),
    amountUsd: amountUsd.toFixed(2),
    amountIqd: amountIqd.toFixed(0),
    paymentMethod,
    paymentStatus: 'confirmed',
    receiptNumber,
    notes,
    receivedById,
    confirmedById: receivedById,
    confirmedAt: new Date()
  });
  
  // Update account balance and last payment
  const db = await getDb();
  if (db) {
    await db.update(customerAccounts).set({
      currentBalanceUsd: newBalanceUsd.toFixed(2),
      currentBalanceIqd: newBalanceIqd.toFixed(0),
      lastTransactionAt: new Date(),
      lastPaymentAt: new Date()
    }).where(eq(customerAccounts.id, account.id));
  }
  
  return { transaction, payment };
}

// Get recent transactions across all accounts
export async function getRecentTransactions(limit = 20): Promise<(LedgerTransaction & { customer?: Customer })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const transactions = await db.select()
    .from(ledgerTransactions)
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(limit);
  
  const accounts = await db.select().from(customerAccounts);
  const customersList = await db.select().from(customers);
  
  return transactions.map(txn => {
    const account = accounts.find(a => a.id === txn.accountId);
    const customer = account ? customersList.find(c => c.id === account.customerId) : undefined;
    return { ...txn, customer };
  });
}

// Create payment reminder
export async function createPaymentReminder(data: InsertPaymentReminder): Promise<PaymentReminder> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(paymentReminders).values(data);
  const insertId = result[0].insertId;
  const [reminder] = await db.select().from(paymentReminders).where(eq(paymentReminders.id, insertId));
  return reminder;
}

// Get pending reminders
export async function getPendingReminders(): Promise<PaymentReminder[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(paymentReminders)
    .where(eq(paymentReminders.status, 'pending'))
    .orderBy(paymentReminders.scheduledAt);
}



// ============ COMPANY FINANCIAL MANAGEMENT ============


// ============ EXPENSE CATEGORIES ============

export async function getAllExpenseCategories(): Promise<ExpenseCategory[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenseCategories).orderBy(expenseCategories.sortOrder);
}

export async function getActiveExpenseCategories(): Promise<ExpenseCategory[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(expenseCategories)
    .where(eq(expenseCategories.isActive, true))
    .orderBy(expenseCategories.sortOrder);
}

export async function getExpenseCategoryById(id: number): Promise<ExpenseCategory | null> {
  const db = await getDb();
  if (!db) return null;
  const [category] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
  return category || null;
}

export async function createExpenseCategory(data: InsertExpenseCategory): Promise<ExpenseCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(expenseCategories).values(data);
  const insertId = Number(result[0].insertId);
  const [category] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, insertId));
  return category;
}

export async function updateExpenseCategory(id: number, data: Partial<InsertExpenseCategory>): Promise<ExpenseCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(expenseCategories).set(data).where(eq(expenseCategories.id, id));
  const [updated] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
  return updated;
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
}


// ============ EXPENSES ============

export async function getAllExpenses(filters?: {
  categoryId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<Expense[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(expenses);
  const conditions = [];
  
  if (filters?.categoryId) {
    conditions.push(eq(expenses.categoryId, filters.categoryId));
  }
  if (filters?.startDate) {
    conditions.push(gte(expenses.expenseDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(expenses.expenseDate, filters.endDate));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  query = query.orderBy(desc(expenses.expenseDate)) as any;
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  
  return await query;
}

export async function getExpenseById(id: number): Promise<Expense | null> {
  const db = await getDb();
  if (!db) return null;
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
  return expense || null;
}

export async function createExpense(data: InsertExpense): Promise<Expense> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(expenses).values(data);
  const insertId = Number(result[0].insertId);
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, insertId));
  return expense;
}

export async function updateExpense(id: number, data: Partial<InsertExpense>): Promise<Expense> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(expenses).set(data).where(eq(expenses.id, id));
  const [updated] = await db.select().from(expenses).where(eq(expenses.id, id));
  return updated;
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(expenses).where(eq(expenses.id, id));
}

export async function getExpensesSummary(startDate: Date, endDate: Date): Promise<{
  totalAmount: number;
  byCategory: { categoryId: number; categoryName: string; total: number }[];
}> {
  const db = await getDb();
  if (!db) return { totalAmount: 0, byCategory: [] };
  
  const expensesList = await db.select().from(expenses)
    .where(and(
      gte(expenses.expenseDate, startDate),
      lte(expenses.expenseDate, endDate)
    ));
  
  const categories = await db.select().from(expenseCategories);
  
  const totalAmount = expensesList.reduce((sum, e) => sum + Number(e.amountUsd), 0);
  
  const byCategory = categories.map(cat => ({
    categoryId: cat.id,
    categoryName: cat.nameEn,
    total: expensesList
      .filter(e => e.categoryId === cat.id)
      .reduce((sum, e) => sum + Number(e.amountUsd), 0)
  })).filter(c => c.total > 0);
  
  return { totalAmount, byCategory };
}


// ============ PARTNERS ============

export async function getAllPartners(): Promise<Partner[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(partners).orderBy(partners.name);
}

export async function getActivePartners(): Promise<Partner[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(partners)
    .where(eq(partners.isActive, true))
    .orderBy(partners.name);
}

export async function getPartnerById(id: number): Promise<Partner | null> {
  const db = await getDb();
  if (!db) return null;
  const [partner] = await db.select().from(partners).where(eq(partners.id, id));
  return partner || null;
}

export async function createPartner(data: InsertPartner): Promise<Partner> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(partners).values(data);
  const insertId = Number(result[0].insertId);
  const [partner] = await db.select().from(partners).where(eq(partners.id, insertId));
  return partner;
}

export async function updatePartner(id: number, data: Partial<InsertPartner>): Promise<Partner> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partners).set(data).where(eq(partners.id, id));
  const [updated] = await db.select().from(partners).where(eq(partners.id, id));
  return updated;
}

export async function deletePartner(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(partners).where(eq(partners.id, id));
}


// ============ PARTNER TRANSACTIONS ============

export async function getPartnerTransactions(partnerId: number, limit = 50): Promise<PartnerTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(partnerTransactions)
    .where(eq(partnerTransactions.partnerId, partnerId))
    .orderBy(desc(partnerTransactions.transactionDate))
    .limit(limit);
}

export async function getAllPartnerTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  transactionType?: string;
}): Promise<PartnerTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(partnerTransactions);
  const conditions = [];
  
  if (filters?.startDate) {
    conditions.push(gte(partnerTransactions.transactionDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(partnerTransactions.transactionDate, filters.endDate));
  }
  if (filters?.transactionType) {
    conditions.push(eq(partnerTransactions.transactionType, filters.transactionType as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(partnerTransactions.transactionDate));
}

export async function createPartnerTransaction(data: Omit<InsertPartnerTransaction, 'balanceBefore' | 'balanceAfter'>): Promise<PartnerTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current partner balance
  const partner = await getPartnerById(data.partnerId);
  if (!partner) throw new Error("Partner not found");
  
  const currentBalance = Number(partner.currentBalance);
  let newBalance = currentBalance;
  
  // Calculate new balance based on transaction type
  switch (data.transactionType) {
    case 'capital_contribution':
    case 'profit_share':
    case 'loan_to_company':
      newBalance = currentBalance + Number(data.amountUsd);
      break;
    case 'withdrawal':
    case 'loan_repayment':
      newBalance = currentBalance - Number(data.amountUsd);
      break;
    case 'adjustment':
      // For adjustments, amount can be positive or negative
      newBalance = currentBalance + Number(data.amountUsd);
      break;
  }
  
  // Create transaction with balance info
  const transactionData = {
    ...data,
    balanceBefore: currentBalance.toFixed(2),
    balanceAfter: newBalance.toFixed(2)
  };
  
  const result = await db.insert(partnerTransactions).values(transactionData);
  const insertId = Number(result[0].insertId);
  
  // Update partner balance
  await db.update(partners).set({ currentBalance: newBalance.toFixed(2) }).where(eq(partners.id, data.partnerId));
  
  const [transaction] = await db.select().from(partnerTransactions).where(eq(partnerTransactions.id, insertId));
  return transaction;
}


// ============ COMPANY DEBTS ============

export async function getAllCompanyDebts(): Promise<CompanyDebt[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companyDebts).orderBy(desc(companyDebts.createdAt));
}

export async function getActiveCompanyDebts(): Promise<CompanyDebt[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companyDebts)
    .where(eq(companyDebts.status, 'active'))
    .orderBy(companyDebts.dueDate);
}

export async function getCompanyDebtById(id: number): Promise<CompanyDebt | null> {
  const db = await getDb();
  if (!db) return null;
  const [debt] = await db.select().from(companyDebts).where(eq(companyDebts.id, id));
  return debt || null;
}

export async function createCompanyDebt(data: InsertCompanyDebt): Promise<CompanyDebt> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companyDebts).values(data);
  const insertId = Number(result[0].insertId);
  const [debt] = await db.select().from(companyDebts).where(eq(companyDebts.id, insertId));
  return debt;
}

export async function updateCompanyDebt(id: number, data: Partial<InsertCompanyDebt>): Promise<CompanyDebt> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companyDebts).set(data).where(eq(companyDebts.id, id));
  const [updated] = await db.select().from(companyDebts).where(eq(companyDebts.id, id));
  return updated;
}

export async function deleteCompanyDebt(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(companyDebts).where(eq(companyDebts.id, id));
}


// ============ DEBT PAYMENTS ============

export async function getDebtPayments(debtId: number): Promise<DebtPayment[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(debtPayments)
    .where(eq(debtPayments.debtId, debtId))
    .orderBy(desc(debtPayments.paymentDate));
}

export async function createDebtPayment(data: InsertDebtPayment): Promise<DebtPayment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current debt
  const debt = await getCompanyDebtById(data.debtId);
  if (!debt) throw new Error("Debt not found");
  
  const currentPaid = Number(debt.paidAmount);
  const newPaid = currentPaid + Number(data.amountUsd);
  const newRemaining = Number(debt.totalAmount) - newPaid;
  
  // Create payment with remaining balance
  const paymentData = {
    ...data,
    remainingAfter: newRemaining.toFixed(2)
  };
  
  const result = await db.insert(debtPayments).values(paymentData);
  const insertId = Number(result[0].insertId);
  
  // Update debt
  const newStatus = newRemaining <= 0 ? 'paid' : 'active';
  await db.update(companyDebts).set({
    paidAmount: newPaid.toFixed(2),
    remainingAmount: Math.max(0, newRemaining).toFixed(2),
    status: newStatus
  }).where(eq(companyDebts.id, data.debtId));
  
  const [payment] = await db.select().from(debtPayments).where(eq(debtPayments.id, insertId));
  return payment;
}


// ============ CASH ACCOUNTS ============

export async function getAllCashAccounts(): Promise<CashAccount[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cashAccounts).orderBy(cashAccounts.accountName);
}

export async function getActiveCashAccounts(): Promise<CashAccount[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cashAccounts)
    .where(eq(cashAccounts.isActive, true))
    .orderBy(cashAccounts.accountName);
}

export async function getCashAccountById(id: number): Promise<CashAccount | null> {
  const db = await getDb();
  if (!db) return null;
  const [account] = await db.select().from(cashAccounts).where(eq(cashAccounts.id, id));
  return account || null;
}

export async function createCashAccount(data: InsertCashAccount): Promise<CashAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cashAccounts).values({
    ...data,
    currentBalance: data.initialBalance || '0'
  });
  const insertId = Number(result[0].insertId);
  const [account] = await db.select().from(cashAccounts).where(eq(cashAccounts.id, insertId));
  return account;
}

export async function updateCashAccount(id: number, data: Partial<InsertCashAccount>): Promise<CashAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cashAccounts).set(data).where(eq(cashAccounts.id, id));
  const [updated] = await db.select().from(cashAccounts).where(eq(cashAccounts.id, id));
  return updated;
}

export async function deleteCashAccount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cashAccounts).where(eq(cashAccounts.id, id));
}

export async function getCashAccountsSummary(): Promise<{
  totalCash: number;
  totalBank: number;
  totalBalance: number;
  accounts: CashAccount[];
}> {
  const db = await getDb();
  if (!db) return { totalCash: 0, totalBank: 0, totalBalance: 0, accounts: [] };
  
  const accounts = await db.select().from(cashAccounts).where(eq(cashAccounts.isActive, true));
  
  const totalCash = accounts
    .filter(a => a.accountType === 'cash')
    .reduce((sum, a) => sum + Number(a.currentBalance), 0);
  
  const totalBank = accounts
    .filter(a => a.accountType === 'bank')
    .reduce((sum, a) => sum + Number(a.currentBalance), 0);
  
  return {
    totalCash,
    totalBank,
    totalBalance: totalCash + totalBank,
    accounts
  };
}


// ============ CASH TRANSACTIONS ============

export async function getCashTransactions(accountId: number, limit = 50): Promise<CashTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cashTransactions)
    .where(eq(cashTransactions.accountId, accountId))
    .orderBy(desc(cashTransactions.transactionDate))
    .limit(limit);
}

export async function getAllCashTransactions(filters?: {
  accountId?: number;
  transactionType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<CashTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(cashTransactions);
  const conditions = [];
  
  if (filters?.accountId) {
    conditions.push(eq(cashTransactions.accountId, filters.accountId));
  }
  if (filters?.transactionType) {
    conditions.push(eq(cashTransactions.transactionType, filters.transactionType as any));
  }
  if (filters?.startDate) {
    conditions.push(gte(cashTransactions.transactionDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(cashTransactions.transactionDate, filters.endDate));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  query = query.orderBy(desc(cashTransactions.transactionDate)) as any;
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  
  return await query;
}

export async function createCashTransaction(data: Omit<InsertCashTransaction, 'balanceBefore' | 'balanceAfter'>): Promise<CashTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current account balance
  const account = await getCashAccountById(data.accountId);
  if (!account) throw new Error("Cash account not found");
  
  const currentBalance = Number(account.currentBalance);
  let newBalance = currentBalance;
  
  // Calculate new balance based on transaction type
  switch (data.transactionType) {
    case 'deposit':
    case 'transfer_in':
    case 'customer_payment':
    case 'partner_deposit':
      newBalance = currentBalance + Number(data.amount);
      break;
    case 'withdrawal':
    case 'transfer_out':
    case 'expense':
    case 'debt_payment':
    case 'partner_withdrawal':
      newBalance = currentBalance - Number(data.amount);
      break;
    case 'adjustment':
      newBalance = currentBalance + Number(data.amount);
      break;
  }
  
  // Create transaction with balance info
  const transactionData = {
    ...data,
    balanceBefore: currentBalance.toFixed(2),
    balanceAfter: newBalance.toFixed(2)
  };
  
  const result = await db.insert(cashTransactions).values(transactionData);
  const insertId = Number(result[0].insertId);
  
  // Update account balance
  await db.update(cashAccounts).set({ currentBalance: newBalance.toFixed(2) }).where(eq(cashAccounts.id, data.accountId));
  
  const [transaction] = await db.select().from(cashTransactions).where(eq(cashTransactions.id, insertId));
  return transaction;
}

// Transfer between accounts
export async function transferBetweenAccounts(
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  description: string,
  createdById: number
): Promise<{ fromTransaction: CashTransaction; toTransaction: CashTransaction }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const now = new Date();
  
  // Create outgoing transaction
  const fromTransaction = await createCashTransaction({
    accountId: fromAccountId,
    transactionType: 'transfer_out',
    amount: amount.toFixed(2),
    relatedAccountId: toAccountId,
    description,
    transactionDate: now,
    createdById
  });
  
  // Create incoming transaction
  const toTransaction = await createCashTransaction({
    accountId: toAccountId,
    transactionType: 'transfer_in',
    amount: amount.toFixed(2),
    relatedAccountId: fromAccountId,
    description,
    transactionDate: now,
    createdById
  });
  
  return { fromTransaction, toTransaction };
}


// ============ FINANCIAL REPORTS ============

export async function getCompanyFinancialOverview(): Promise<{
  totalCash: number;
  totalDebt: number;
  totalPartnerEquity: number;
  netPosition: number;
}> {
  const db = await getDb();
  if (!db) return { totalCash: 0, totalDebt: 0, totalPartnerEquity: 0, netPosition: 0 };
  
  // Get total cash
  const cashSummary = await getCashAccountsSummary();
  const totalCash = cashSummary.totalBalance;
  
  // Get total active debt
  const debts = await getActiveCompanyDebts();
  const totalDebt = debts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
  
  // Get total partner equity (initial capital + retained earnings)
  const partnersList = await getActivePartners();
  const totalPartnerEquity = partnersList.reduce((sum, p) => 
    sum + Number(p.initialCapital) + Number(p.currentBalance), 0);
  
  return {
    totalCash,
    totalDebt,
    totalPartnerEquity,
    netPosition: totalCash - totalDebt
  };
}

export async function getProfitAndLoss(startDate: Date, endDate: Date): Promise<{
  revenue: {
    packageRevenue: number;
    fullPackageRevenue: number;
    otherRevenue: number;
    totalRevenue: number;
  };
  expenses: {
    byCategory: { categoryId: number; categoryName: string; total: number }[];
    totalExpenses: number;
  };
  grossProfit: number;
  netProfit: number;
}> {
  const db = await getDb();
  if (!db) return {
    revenue: { packageRevenue: 0, fullPackageRevenue: 0, otherRevenue: 0, totalRevenue: 0 },
    expenses: { byCategory: [], totalExpenses: 0 },
    grossProfit: 0,
    netProfit: 0
  };
  
  // Get revenue from payments received
  const paymentsResult = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(14,2))), 0)`
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ));
  
  const packageRevenue = parseFloat(paymentsResult[0]?.total || '0');
  
  // Get Full Package profit
  const fullPackageResult = await db.select({
    profit: sql<string>`COALESCE(SUM(CAST(${fullPackageOrders.profitUsd} AS DECIMAL(14,2))), 0)`
  }).from(fullPackageOrders)
    .where(and(
      gte(fullPackageOrders.createdAt, startDate),
      lte(fullPackageOrders.createdAt, endDate),
      eq(fullPackageOrders.status, 'delivered')
    ));
  
  const fullPackageRevenue = parseFloat(fullPackageResult[0]?.profit || '0');
  
  // Get expenses
  const expensesSummary = await getExpensesSummary(startDate, endDate);
  
  const totalRevenue = packageRevenue + fullPackageRevenue;
  const grossProfit = totalRevenue;
  const netProfit = grossProfit - expensesSummary.totalAmount;
  
  return {
    revenue: {
      packageRevenue,
      fullPackageRevenue,
      otherRevenue: 0,
      totalRevenue
    },
    expenses: {
      byCategory: expensesSummary.byCategory,
      totalExpenses: expensesSummary.totalAmount
    },
    grossProfit,
    netProfit
  };
}

export async function getMonthlyProfitTrend(year: number): Promise<{
  month: number;
  revenue: number;
  expenses: number;
  profit: number;
}[]> {
  const results = [];
  
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const pnl = await getProfitAndLoss(startDate, endDate);
    
    results.push({
      month,
      revenue: pnl.revenue.totalRevenue,
      expenses: pnl.expenses.totalExpenses,
      profit: pnl.netProfit
    });
  }
  
  return results;
}



// ============ FINANCE INTEGRATION ============

// Generate revenue record number
export async function generateRevenueRecordNumber(): Promise<string> {
  const db = await getDb();
  if (!db) return `REV-${Date.now()}`;
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REV-${dateStr}`;
  
  const lastRecord = await db.select({ recordNumber: revenueRecords.recordNumber })
    .from(revenueRecords)
    .where(like(revenueRecords.recordNumber, `${prefix}%`))
    .orderBy(desc(revenueRecords.recordNumber))
    .limit(1);
  
  let nextNum = 1;
  if (lastRecord.length > 0) {
    const match = lastRecord[0].recordNumber.match(/-(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  
  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

// Create revenue record
export async function createRevenueRecord(data: {
  recordDate: Date;
  revenueType: 'package_delivery' | 'full_package_sale' | 'full_package_commission' | 'service_fee' | 'extra_service' | 'shipping_fee' | 'other';
  amountUsd: number;
  amountIqd?: number;
  exchangeRate?: number;
  costUsd?: number;
  referenceType?: 'package' | 'fullPackageOrder' | 'invoice' | 'service' | 'manual';
  referenceId?: number;
  customerId?: number;
  description?: string;
  createdById: number;
}): Promise<RevenueRecord | null> {
  const db = await getDb();
  if (!db) return null;
  
  const recordNumber = await generateRevenueRecordNumber();
  const profitUsd = data.amountUsd - (data.costUsd || 0);
  
  const [result] = await db.insert(revenueRecords).values({
    recordNumber,
    recordDate: data.recordDate,
    revenueType: data.revenueType,
    amountUsd: String(data.amountUsd),
    amountIqd: data.amountIqd ? String(data.amountIqd) : null,
    exchangeRate: data.exchangeRate ? String(data.exchangeRate) : null,
    costUsd: String(data.costUsd || 0),
    profitUsd: String(profitUsd),
    referenceType: data.referenceType,
    referenceId: data.referenceId,
    customerId: data.customerId,
    description: data.description,
    status: 'confirmed',
    createdById: data.createdById,
  });
  
  // Update daily summary
  await updateDailyFinancialSummary(data.recordDate, {
    addRevenue: data.amountUsd,
    revenueType: data.revenueType,
  });
  
  return getRevenueRecordById(result.insertId);
}

// Get revenue record by ID
export async function getRevenueRecordById(id: number): Promise<RevenueRecord | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [record] = await db.select().from(revenueRecords).where(eq(revenueRecords.id, id));
  return record || null;
}

// List revenue records with filters
export async function listRevenueRecords(filters: {
  startDate?: Date;
  endDate?: Date;
  revenueType?: string;
  customerId?: number;
  referenceType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ records: RevenueRecord[]; total: number }> {
  const db = await getDb();
  if (!db) return { records: [], total: 0 };
  
  const conditions = [];
  
  if (filters.startDate) {
    conditions.push(gte(revenueRecords.recordDate, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(revenueRecords.recordDate, filters.endDate));
  }
  if (filters.revenueType) {
    conditions.push(eq(revenueRecords.revenueType, filters.revenueType as any));
  }
  if (filters.customerId) {
    conditions.push(eq(revenueRecords.customerId, filters.customerId));
  }
  if (filters.referenceType) {
    conditions.push(eq(revenueRecords.referenceType, filters.referenceType as any));
  }
  if (filters.status) {
    conditions.push(eq(revenueRecords.status, filters.status as any));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(revenueRecords)
    .where(whereClause);
  
  const records = await db.select()
    .from(revenueRecords)
    .where(whereClause)
    .orderBy(desc(revenueRecords.recordDate))
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);
  
  return { records, total: Number(countResult?.count || 0) };
}

// Update or create daily financial summary
export async function updateDailyFinancialSummary(date: Date, updates: {
  addRevenue?: number;
  revenueType?: string;
  addExpense?: number;
  expenseType?: string;
  addCashIn?: number;
  addCashOut?: number;
  addPackagesDelivered?: number;
  addFullPackagesSold?: number;
  addInvoicesIssued?: number;
  addPaymentsReceived?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Normalize date to start of day
  const summaryDate = new Date(date);
  summaryDate.setHours(0, 0, 0, 0);
  
  // Check if summary exists for this date
  const [existing] = await db.select()
    .from(dailyFinancialSummary)
    .where(eq(dailyFinancialSummary.summaryDate, summaryDate));
  
  if (existing) {
    // Update existing summary
    const updateData: Record<string, any> = {};
    
    if (updates.addRevenue) {
      updateData.totalRevenue = sql`${dailyFinancialSummary.totalRevenue} + ${updates.addRevenue}`;
      
      if (updates.revenueType === 'package_delivery') {
        updateData.packageRevenue = sql`${dailyFinancialSummary.packageRevenue} + ${updates.addRevenue}`;
      } else if (updates.revenueType?.includes('full_package')) {
        updateData.fullPackageRevenue = sql`${dailyFinancialSummary.fullPackageRevenue} + ${updates.addRevenue}`;
      } else if (updates.revenueType === 'service_fee' || updates.revenueType === 'extra_service') {
        updateData.serviceRevenue = sql`${dailyFinancialSummary.serviceRevenue} + ${updates.addRevenue}`;
      } else {
        updateData.otherRevenue = sql`${dailyFinancialSummary.otherRevenue} + ${updates.addRevenue}`;
      }
    }
    
    if (updates.addExpense) {
      updateData.totalExpenses = sql`${dailyFinancialSummary.totalExpenses} + ${updates.addExpense}`;
      
      if (updates.expenseType === 'shipping') {
        updateData.shippingExpenses = sql`${dailyFinancialSummary.shippingExpenses} + ${updates.addExpense}`;
      } else if (updates.expenseType === 'purchase') {
        updateData.purchaseExpenses = sql`${dailyFinancialSummary.purchaseExpenses} + ${updates.addExpense}`;
      } else if (updates.expenseType === 'operational') {
        updateData.operationalExpenses = sql`${dailyFinancialSummary.operationalExpenses} + ${updates.addExpense}`;
      } else {
        updateData.otherExpenses = sql`${dailyFinancialSummary.otherExpenses} + ${updates.addExpense}`;
      }
    }
    
    if (updates.addCashIn) {
      updateData.cashIn = sql`${dailyFinancialSummary.cashIn} + ${updates.addCashIn}`;
      updateData.netCashFlow = sql`${dailyFinancialSummary.netCashFlow} + ${updates.addCashIn}`;
    }
    
    if (updates.addCashOut) {
      updateData.cashOut = sql`${dailyFinancialSummary.cashOut} + ${updates.addCashOut}`;
      updateData.netCashFlow = sql`${dailyFinancialSummary.netCashFlow} - ${updates.addCashOut}`;
    }
    
    if (updates.addPackagesDelivered) {
      updateData.packagesDelivered = sql`${dailyFinancialSummary.packagesDelivered} + ${updates.addPackagesDelivered}`;
    }
    
    if (updates.addFullPackagesSold) {
      updateData.fullPackagesSold = sql`${dailyFinancialSummary.fullPackagesSold} + ${updates.addFullPackagesSold}`;
    }
    
    if (updates.addInvoicesIssued) {
      updateData.invoicesIssued = sql`${dailyFinancialSummary.invoicesIssued} + ${updates.addInvoicesIssued}`;
    }
    
    if (updates.addPaymentsReceived) {
      updateData.paymentsReceived = sql`${dailyFinancialSummary.paymentsReceived} + ${updates.addPaymentsReceived}`;
    }
    
    // Recalculate profits
    updateData.grossProfit = sql`${dailyFinancialSummary.totalRevenue} - ${dailyFinancialSummary.totalExpenses}`;
    updateData.netProfit = sql`${dailyFinancialSummary.totalRevenue} - ${dailyFinancialSummary.totalExpenses}`;
    
    if (Object.keys(updateData).length > 0) {
      await db.update(dailyFinancialSummary)
        .set(updateData)
        .where(eq(dailyFinancialSummary.id, existing.id));
    }
  } else {
    // Create new summary
    const newSummary: InsertDailyFinancialSummary = {
      summaryDate,
      totalRevenue: String(updates.addRevenue || 0),
      packageRevenue: updates.revenueType === 'package_delivery' ? String(updates.addRevenue || 0) : '0',
      fullPackageRevenue: updates.revenueType?.includes('full_package') ? String(updates.addRevenue || 0) : '0',
      serviceRevenue: (updates.revenueType === 'service_fee' || updates.revenueType === 'extra_service') ? String(updates.addRevenue || 0) : '0',
      otherRevenue: '0',
      totalExpenses: String(updates.addExpense || 0),
      shippingExpenses: updates.expenseType === 'shipping' ? String(updates.addExpense || 0) : '0',
      purchaseExpenses: updates.expenseType === 'purchase' ? String(updates.addExpense || 0) : '0',
      operationalExpenses: updates.expenseType === 'operational' ? String(updates.addExpense || 0) : '0',
      otherExpenses: '0',
      grossProfit: String((updates.addRevenue || 0) - (updates.addExpense || 0)),
      netProfit: String((updates.addRevenue || 0) - (updates.addExpense || 0)),
      cashIn: String(updates.addCashIn || 0),
      cashOut: String(updates.addCashOut || 0),
      netCashFlow: String((updates.addCashIn || 0) - (updates.addCashOut || 0)),
      packagesDelivered: updates.addPackagesDelivered || 0,
      fullPackagesSold: updates.addFullPackagesSold || 0,
      invoicesIssued: updates.addInvoicesIssued || 0,
      paymentsReceived: updates.addPaymentsReceived || 0,
      totalReceivables: '0',
      totalPayables: '0',
      isFinalized: false,
    };
    
    await db.insert(dailyFinancialSummary).values(newSummary);
  }
}

// Get daily financial summary
export async function getDailyFinancialSummary(date: Date): Promise<DailyFinancialSummary | null> {
  const db = await getDb();
  if (!db) return null;
  
  const summaryDate = new Date(date);
  summaryDate.setHours(0, 0, 0, 0);
  
  const [summary] = await db.select()
    .from(dailyFinancialSummary)
    .where(eq(dailyFinancialSummary.summaryDate, summaryDate));
  
  return summary || null;
}

// Get financial summary for date range
export async function getFinancialSummaryRange(startDate: Date, endDate: Date): Promise<{
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  packagesDelivered: number;
  fullPackagesSold: number;
  invoicesIssued: number;
  paymentsReceived: number;
  dailySummaries: DailyFinancialSummary[];
}> {
  const db = await getDb();
  if (!db) return {
    totalRevenue: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0,
    cashIn: 0, cashOut: 0, netCashFlow: 0,
    packagesDelivered: 0, fullPackagesSold: 0, invoicesIssued: 0, paymentsReceived: 0,
    dailySummaries: []
  };
  
  const summaries = await db.select()
    .from(dailyFinancialSummary)
    .where(and(
      gte(dailyFinancialSummary.summaryDate, startDate),
      lte(dailyFinancialSummary.summaryDate, endDate)
    ))
    .orderBy(asc(dailyFinancialSummary.summaryDate));
  
  const totals = summaries.reduce((acc, s) => ({
    totalRevenue: acc.totalRevenue + Number(s.totalRevenue || 0),
    totalExpenses: acc.totalExpenses + Number(s.totalExpenses || 0),
    grossProfit: acc.grossProfit + Number(s.grossProfit || 0),
    netProfit: acc.netProfit + Number(s.netProfit || 0),
    cashIn: acc.cashIn + Number(s.cashIn || 0),
    cashOut: acc.cashOut + Number(s.cashOut || 0),
    netCashFlow: acc.netCashFlow + Number(s.netCashFlow || 0),
    packagesDelivered: acc.packagesDelivered + (s.packagesDelivered || 0),
    fullPackagesSold: acc.fullPackagesSold + (s.fullPackagesSold || 0),
    invoicesIssued: acc.invoicesIssued + (s.invoicesIssued || 0),
    paymentsReceived: acc.paymentsReceived + (s.paymentsReceived || 0),
  }), {
    totalRevenue: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0,
    cashIn: 0, cashOut: 0, netCashFlow: 0,
    packagesDelivered: 0, fullPackagesSold: 0, invoicesIssued: 0, paymentsReceived: 0,
  });
  
  return { ...totals, dailySummaries: summaries };
}

// Get revenue by type for period
export async function getRevenueByType(startDate: Date, endDate: Date): Promise<{
  type: string;
  amount: number;
  count: number;
}[]> {
  const db = await getDb();
  if (!db) return [];
  
  const revenueMap = new Map<string, { amount: number; count: number }>();
  
  // Source 1: ledgerTransactions (DEBIT entries are charges to customers = revenue)
  try {
    const txResult = await db.select({
      type: ledgerTransactions.transactionType,
      amount: sql<number>`SUM(${ledgerTransactions.amountUsd})`,
      count: sql<number>`COUNT(*)`,
    })
      .from(ledgerTransactions)
      .where(and(
        gte(ledgerTransactions.createdAt, startDate),
        lte(ledgerTransactions.createdAt, endDate),
        sql`${ledgerTransactions.transactionType} LIKE 'DEBIT_%'`
      ))
      .groupBy(ledgerTransactions.transactionType);
    
    for (const r of txResult) {
      let revenueType = 'other';
      const txType = r.type || '';
      if (txType === 'DEBIT_PACKAGE') revenueType = 'package_delivery';
      else if (txType === 'DEBIT_SERVICE') revenueType = 'service_fee';
      else if (txType === 'DEBIT_PENALTY') revenueType = 'penalty';
      else if (txType === 'DEBIT_OTHER') revenueType = 'other';
      
      const existing = revenueMap.get(revenueType) || { amount: 0, count: 0 };
      revenueMap.set(revenueType, {
        amount: existing.amount + Number(r.amount || 0),
        count: existing.count + Number(r.count || 0),
      });
    }
  } catch (e) {
    console.error('[Revenue] Failed to get ledgerTransactions:', e);
  }
  
  // Note: ledgerEntries removed - using unified ledgerTransactions only
  
  // Source 3: revenueRecords (explicit revenue records)
  try {
    const recordResult = await db.select({
      sourceType: revenueRecords.revenueType,
      amount: sql<number>`SUM(${revenueRecords.amountUsd})`,
      count: sql<number>`COUNT(*)`,
    })
      .from(revenueRecords)
      .where(and(
        gte(revenueRecords.createdAt, startDate),
        lte(revenueRecords.createdAt, endDate)
      ))
      .groupBy(revenueRecords.revenueType);
    
    for (const r of recordResult) {
      let revenueType = 'other';
      const sourceType = r.sourceType || '';
      if (sourceType === 'package_delivery') revenueType = 'package_delivery';
      else if (sourceType === 'full_package_sale' || sourceType === 'full_package_commission') revenueType = 'full_package_sale';
      else if (sourceType === 'service_fee' || sourceType === 'extra_service') revenueType = 'service_fee';
      
      const existing = revenueMap.get(revenueType) || { amount: 0, count: 0 };
      // Only add if not already counted
      if (existing.amount === 0) {
        revenueMap.set(revenueType, {
          amount: Number(r.amount || 0),
          count: Number(r.count || 0),
        });
      }
    }
  } catch (e) {
    console.error('[Revenue] Failed to get revenueRecords:', e);
  }
  
  // Convert map to array
  return Array.from(revenueMap.entries()).map(([type, data]) => ({
    type,
    amount: data.amount,
    count: data.count,
  }));
}

// Calculate profit and loss for period
export async function calculateProfitLoss(startDate: Date, endDate: Date): Promise<{
  revenue: {
    packageDelivery: number;
    fullPackageSale: number;
    fullPackageCommission: number;
    serviceFee: number;
    extraService: number;
    shippingFee: number;
    other: number;
    total: number;
  };
  expenses: {
    shipping: number;
    purchase: number;
    operational: number;
    salary: number;
    rent: number;
    utilities: number;
    other: number;
    total: number;
  };
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
}> {
  const db = await getDb();
  if (!db) return {
    revenue: { packageDelivery: 0, fullPackageSale: 0, fullPackageCommission: 0, serviceFee: 0, extraService: 0, shippingFee: 0, other: 0, total: 0 },
    expenses: { shipping: 0, purchase: 0, operational: 0, salary: 0, rent: 0, utilities: 0, other: 0, total: 0 },
    grossProfit: 0, netProfit: 0, profitMargin: 0
  };
  
  // Get revenue by type
  const revenueByType = await getRevenueByType(startDate, endDate);
  const revenue = {
    packageDelivery: 0,
    fullPackageSale: 0,
    fullPackageCommission: 0,
    serviceFee: 0,
    extraService: 0,
    shippingFee: 0,
    other: 0,
    total: 0,
  };
  
  for (const r of revenueByType) {
    const amount = r.amount;
    revenue.total += amount;
    
    switch (r.type) {
      case 'package_delivery': revenue.packageDelivery = amount; break;
      case 'full_package_sale': revenue.fullPackageSale = amount; break;
      case 'full_package_commission': revenue.fullPackageCommission = amount; break;
      case 'service_fee': revenue.serviceFee = amount; break;
      case 'extra_service': revenue.extraService = amount; break;
      case 'shipping_fee': revenue.shippingFee = amount; break;
      default: revenue.other += amount;
    }
  }
  
  // Get expenses by category - join with expenseCategories to get category name
  const expenseResult = await db.select({
    categoryId: expenses.categoryId,
    amount: sql<number>`SUM(${expenses.amountUsd})`,
  })
    .from(expenses)
    .where(and(
      gte(expenses.expenseDate, startDate),
      lte(expenses.expenseDate, endDate)
    ))
    .groupBy(expenses.categoryId);
  
  // Get category names
  const categoryMap = new Map<number, string>();
  if (expenseResult.length > 0) {
    const categoryIds = expenseResult.map(e => e.categoryId);
    const categories = await db.select()
      .from(expenseCategories)
      .where(inArray(expenseCategories.id, categoryIds));
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.nameEn || '');
    }
  }
  
  const expensesData = {
    shipping: 0,
    purchase: 0,
    operational: 0,
    salary: 0,
    rent: 0,
    utilities: 0,
    other: 0,
    total: 0,
  };
  
  for (const e of expenseResult) {
    const amount = Number(e.amount || 0);
    expensesData.total += amount;
    
    const category = (categoryMap.get(e.categoryId) || '').toLowerCase();
    if (category.includes('shipping') || category.includes('transport')) {
      expensesData.shipping += amount;
    } else if (category.includes('purchase') || category.includes('inventory')) {
      expensesData.purchase += amount;
    } else if (category.includes('salary') || category.includes('wage')) {
      expensesData.salary += amount;
    } else if (category.includes('rent')) {
      expensesData.rent += amount;
    } else if (category.includes('utility') || category.includes('electric') || category.includes('water')) {
      expensesData.utilities += amount;
    } else if (category.includes('operational') || category.includes('office')) {
      expensesData.operational += amount;
    } else {
      expensesData.other += amount;
    }
  }
  
  const grossProfit = revenue.total - expensesData.total;
  const netProfit = grossProfit; // Can add tax deductions later
  const profitMargin = revenue.total > 0 ? (netProfit / revenue.total) * 100 : 0;
  
  return {
    revenue,
    expenses: expensesData,
    grossProfit,
    netProfit,
    profitMargin,
  };
}



// ============ BALANCE VALIDATION & REPAIR ============

// Validate account balance matches sum of transactions
export async function validateAccountBalance(accountId: number): Promise<{
  isValid: boolean;
  storedBalance: number;
  calculatedBalance: number;
  difference: number;
  details: {
    totalDebits: number;
    totalCredits: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get account
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId));
  if (!account) throw new Error("Account not found");
  
  const storedBalance = parseFloat(account.currentBalanceUsd || '0');
  
  // Calculate balance from transactions
  const transactions = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.accountId, accountId));
  
  let totalDebits = 0;
  let totalCredits = 0;
  
  for (const txn of transactions) {
    const amount = parseFloat(txn.amountUsd || '0');
    if (txn.transactionType.startsWith('DEBIT')) {
      totalDebits += amount;
    } else if (txn.transactionType.startsWith('CREDIT')) {
      totalCredits += amount;
    }
  }
  
  const calculatedBalance = totalDebits - totalCredits;
  const difference = Math.abs(storedBalance - calculatedBalance);
  const isValid = difference < 0.01; // Allow 1 cent tolerance for rounding
  
  return {
    isValid,
    storedBalance,
    calculatedBalance,
    difference,
    details: {
      totalDebits,
      totalCredits
    }
  };
}

// Repair account balance if mismatch found
export async function repairAccountBalance(accountId: number): Promise<{
  success: boolean;
  oldBalance: number;
  newBalance: number;
  difference: number;
}> {
  const validation = await validateAccountBalance(accountId);
  
  if (validation.isValid) {
    return {
      success: true,
      oldBalance: validation.storedBalance,
      newBalance: validation.storedBalance,
      difference: 0
    };
  }
  
  // Update stored balance to match calculated balance
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(customerAccounts)
    .set({ currentBalanceUsd: validation.calculatedBalance.toFixed(2) })
    .where(eq(customerAccounts.id, accountId));
  
  return {
    success: true,
    oldBalance: validation.storedBalance,
    newBalance: validation.calculatedBalance,
    difference: validation.difference
  };
}

// Validate all accounts and return report
export async function validateAllAccounts(): Promise<{
  totalAccounts: number;
  validAccounts: number;
  invalidAccounts: number;
  issues: Array<{
    accountId: number;
    accountNumber: string;
    customerCode: string;
    storedBalance: number;
    calculatedBalance: number;
    difference: number;
  }>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const accounts = await db.select({ id: customerAccounts.id, customerId: customerAccounts.customerId, accountNumber: customerAccounts.accountNumber }).from(customerAccounts);
  const issues: { accountId: number; accountNumber: string; customerCode: string; storedBalance: number; calculatedBalance: number; difference: number }[] = [];
  const invalidCustomerIds: number[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const account of accounts) {
    const validation = await validateAccountBalance(account.id);
    if (validation.isValid) {
      validCount++;
    } else {
      invalidCount++;
      invalidCustomerIds.push(account.customerId);
      issues.push({
        accountId: account.id,
        accountNumber: account.accountNumber,
        customerCode: '', // filled below via batch fetch
        storedBalance: validation.storedBalance,
        calculatedBalance: validation.calculatedBalance,
        difference: validation.difference
      });
    }
  }

  if (invalidCustomerIds.length > 0) {
    const customersList = await db.select({ id: customers.id, customerCode: customers.customerCode }).from(customers).where(inArray(customers.id, invalidCustomerIds));
    const customerMap = new Map(customersList.map(c => [c.id, c.customerCode || 'Unknown']));
    const customerIdByAccountId = new Map(accounts.map(a => [a.id, a.customerId]));
    for (const issue of issues) {
      const customerId = customerIdByAccountId.get(issue.accountId);
      issue.customerCode = customerId != null ? (customerMap.get(customerId) ?? 'Unknown') : 'Unknown';
    }
  }
  
  return {
    totalAccounts: accounts.length,
    validAccounts: validCount,
    invalidAccounts: invalidCount,
    issues
  };
}

// Calculate breakdown by transaction type for an account
export async function calculateAccountBreakdown(accountId: number): Promise<{
  packageDebt: number;
  fullPackageDebt: number;
  purchaseRequestDebt: number;
  commissionDebt: number;
  serviceDebt: number;
  creditBalance: number;
  totalDebt: number;
  netBalance: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const transactions = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.accountId, accountId));
  
  let packageDebt = 0;
  let fullPackageDebt = 0;
  let purchaseRequestDebt = 0;
  let commissionDebt = 0;
  let serviceDebt = 0;
  let creditBalance = 0;
  
  for (const txn of transactions) {
    const amount = parseFloat(txn.amountUsd || '0');
    
    switch (txn.transactionType) {
      case 'DEBIT_PACKAGE':
        packageDebt += amount;
        break;
      case 'DEBIT_FULL_PACKAGE':
        fullPackageDebt += amount;
        break;
      case 'DEBIT_PURCHASE_REQUEST':
        purchaseRequestDebt += amount;
        break;
      case 'DEBIT_COMMISSION':
        commissionDebt += amount;
        break;
      case 'DEBIT_SERVICE':
      case 'DEBIT_PENALTY':
      case 'DEBIT_OTHER':
        serviceDebt += amount;
        break;
      case 'CREDIT_DEPOSIT':
      case 'CREDIT_PAYMENT':
      case 'CREDIT_REFUND':
      case 'CREDIT_DISCOUNT':
      case 'CREDIT_OTHER':
        creditBalance += amount;
        break;
    }
  }
  
  const totalDebt = packageDebt + fullPackageDebt + purchaseRequestDebt + commissionDebt + serviceDebt;
  const netBalance = totalDebt - creditBalance;
  
  return {
    packageDebt,
    fullPackageDebt,
    purchaseRequestDebt,
    commissionDebt,
    serviceDebt,
    creditBalance,
    totalDebt,
    netBalance
  };
}

// Update account breakdown fields
export async function updateAccountBreakdown(accountId: number): Promise<void> {
  const breakdown = await calculateAccountBreakdown(accountId);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(customerAccounts)
    .set({
      packageDebtUsd: breakdown.packageDebt.toFixed(2),
      fullPackageDebtUsd: breakdown.fullPackageDebt.toFixed(2),
      purchaseRequestDebtUsd: breakdown.purchaseRequestDebt.toFixed(2),
      commissionDebtUsd: breakdown.commissionDebt.toFixed(2),
      serviceDebtUsd: breakdown.serviceDebt.toFixed(2),
      creditBalanceUsd: breakdown.creditBalance.toFixed(2)
    })
    .where(eq(customerAccounts.id, accountId));
}

