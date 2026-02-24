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

// ============ CUSTOMER OPERATIONS ============

// Note: createCustomer is defined above with full field support

export async function getCustomerById(id: number): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  // Get customer from customers table only
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function getCustomerByMobile(mobileNumber: string): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.mobileNumber, mobileNumber)).limit(1);
  return result[0];
}

export async function getCustomerByCode(customerCode: string): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.customerCode, customerCode)).limit(1);
  return result[0];
}

export async function getAllCustomers(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  
  // Get customers from customers table only
  if (activeOnly) {
    return db.select().from(customers).where(eq(customers.isActive, true)).orderBy(desc(customers.createdAt));
  }
  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function updateCustomerPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set({ passwordHash }).where(eq(customers.id, id));
}

export async function getCustomerByUserId(userId: number): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.linkedUserId, userId)).limit(1);
  return result[0];
}


// ============ CUSTOMER CODE PREFIX OPERATIONS ============

export async function getAllCustomerCodePrefixes(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(customerCodePrefixes).where(eq(customerCodePrefixes.isActive, true)).orderBy(customerCodePrefixes.code);
  }
  return db.select().from(customerCodePrefixes).orderBy(customerCodePrefixes.code);
}

export async function getCustomerCodePrefixById(id: number): Promise<CustomerCodePrefix | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customerCodePrefixes).where(eq(customerCodePrefixes.id, id)).limit(1);
  return result[0];
}

export async function createCustomerCodePrefix(data: InsertCustomerCodePrefix): Promise<CustomerCodePrefix> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customerCodePrefixes).values(data);
  const inserted = await db.select().from(customerCodePrefixes).where(eq(customerCodePrefixes.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function updateCustomerCodePrefix(id: number, data: Partial<InsertCustomerCodePrefix>) {
  const db = await getDb();
  if (!db) return;
  await db.update(customerCodePrefixes).set(data).where(eq(customerCodePrefixes.id, id));
}

export async function deleteCustomerCodePrefix(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(customerCodePrefixes).where(eq(customerCodePrefixes.id, id));
}


// ============ VIP CUSTOMER OPERATIONS ============

export async function createVipCustomer(data: InsertVipCustomer): Promise<VipCustomer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vipCustomers).values(data);
  const inserted = await db.select().from(vipCustomers).where(eq(vipCustomers.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getVipCustomerByCustomerId(customerId: number): Promise<VipCustomer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vipCustomers)
    .where(and(eq(vipCustomers.customerId, customerId), eq(vipCustomers.isActive, true)))
    .limit(1);
  return result[0];
}

export async function getAllVipCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vipCustomers).where(eq(vipCustomers.isActive, true)).orderBy(desc(vipCustomers.createdAt));
}

export async function updateVipCustomer(id: number, data: Partial<InsertVipCustomer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(vipCustomers).set(data).where(eq(vipCustomers.id, id));
}

export async function deleteVipCustomer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(vipCustomers).set({ isActive: false }).where(eq(vipCustomers.id, id));
}

// ============ DELETE CUSTOMER (SUPER ADMIN ONLY) ============

export async function deleteCustomer(customerId: number, deletedById: number): Promise<{
  success: boolean;
  deletedData: {
    packagesCount: number;
    invoicesCount: number;
    paymentsCount: number;
    servicesCount: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("کڕیار نەدۆزرایەوە");

  // Count related data before deletion
  const [pkgCount] = await db.select({ count: count() }).from(packages).where(eq(packages.customerId, customerId));
  const [invCount] = await db.select({ count: count() }).from(invoices).where(eq(invoices.customerId, customerId));
  const [svcCount] = await db.select({ count: count() }).from(extraServices).where(eq(extraServices.customerId, customerId));

  // Get customer account for payment records count
  const customerAccount = await db.select().from(customerAccounts).where(eq(customerAccounts.customerId, customerId)).limit(1);
  let paymentsCount = 0;
  if (customerAccount[0]) {
    const [payCount] = await db.select({ count: count() }).from(paymentRecords).where(eq(paymentRecords.accountId, customerAccount[0].id));
    paymentsCount = Number(payCount?.count || 0);
  }

  const deletedData = {
    packagesCount: Number(pkgCount?.count || 0),
    invoicesCount: Number(invCount?.count || 0),
    paymentsCount,
    servicesCount: Number(svcCount?.count || 0),
  };

  // Log deletion before removing
  await db.insert(deletionLogs).values({
    entityType: "customer",
    entityId: customerId,
    deletedById,
    entityData: JSON.stringify({
      customer: { id: customer.id, customerCode: customer.customerCode, fullName: customer.fullName },
      relatedCounts: deletedData,
    }),
  } as any);

  // Delete in correct order (cascade manually)
  // 1. Delete ledger transactions, payments, reminders for this customer's account
  if (customerAccount[0]) {
    const accId = customerAccount[0].id;
    await db.delete(ledgerTransactions).where(eq(ledgerTransactions.accountId, accId));
    await db.delete(creditAdjustments).where(eq(creditAdjustments.accountId, accId));
    await db.delete(paymentRecords).where(eq(paymentRecords.accountId, accId));
    await db.delete(paymentReminders).where(eq(paymentReminders.accountId, accId));
    await db.delete(customerAccounts).where(eq(customerAccounts.customerId, customerId));
  }

  // 2. Delete related records
  await db.delete(extraServices).where(eq(extraServices.customerId, customerId));
  await db.delete(customerNotificationPrefs).where(eq(customerNotificationPrefs.customerId, customerId));
  await db.delete(customerMessages).where(eq(customerMessages.customerId, customerId));
  await db.delete(customerNotifications).where(eq(customerNotifications.customerId, customerId));
  await db.delete(vipCustomers).where(eq(vipCustomers.customerId, customerId));
  await db.delete(packageClaimRequests).where(eq(packageClaimRequests.customerId, customerId));

  // 3. Delete invoices
  await db.delete(invoices).where(eq(invoices.customerId, customerId));

  // 4. Delete full package orders for this customer
  await db.delete(fullPackageOrders).where(eq(fullPackageOrders.customerId, customerId));

  // 5. Nullify customer on packages (keep packages for batch records)
  await db.update(packages).set({ customerId: sql`NULL` }).where(eq(packages.customerId, customerId));

  // 6. Delete customer addresses
  await db.delete(customerAddresses).where(eq(customerAddresses.customerId, customerId));

  // 7. Delete the customer
  await db.delete(customers).where(eq(customers.id, customerId));

  return { success: true, deletedData };
}

// Get VIP pricing for a customer
export async function getVipPricing(customerId: number, shippingType: 'air' | 'sea'): Promise<{
  discountPercent: number;
  fixedPricePerKg: number | null;
  tier: string;
} | null> {
  const vip = await getVipCustomerByCustomerId(customerId);
  if (!vip) return null;
  
  return {
    discountPercent: parseFloat(vip.discountPercent || "0"),
    fixedPricePerKg: shippingType === 'air' 
      ? (vip.fixedPricePerKgAir ? parseFloat(vip.fixedPricePerKgAir) : null)
      : (vip.fixedPricePerKgSea ? parseFloat(vip.fixedPricePerKgSea) : null),
    tier: vip.tier,
  };
}
