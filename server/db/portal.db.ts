import { getDb } from './connection';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { getCustomerAccountByCustomerId } from './finance.db';
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

// ============ NOTIFICATION PREFERENCES OPERATIONS ============

export async function getNotificationPrefs(customerId: number): Promise<CustomerNotificationPref | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customerNotificationPrefs)
    .where(eq(customerNotificationPrefs.customerId, customerId))
    .limit(1);
  return result[0];
}

export async function upsertNotificationPrefs(customerId: number, prefs: Partial<InsertCustomerNotificationPref>) {
  const db = await getDb();
  if (!db) return;
  
  const existing = await getNotificationPrefs(customerId);
  if (existing) {
    await db.update(customerNotificationPrefs).set(prefs).where(eq(customerNotificationPrefs.customerId, customerId));
  } else {
    await db.insert(customerNotificationPrefs).values({ customerId, ...prefs });
  }
}


// ============ CUSTOMER PORTAL FUNCTIONS ============

// Get batches that contain packages for a specific customer
export async function getCustomerBatches(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get distinct batch IDs for this customer's packages
  const customerPackages = await db.select({
    batchId: packages.batchId
  }).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      isNotNull(packages.batchId)
    ))
    .groupBy(packages.batchId);
  
  if (customerPackages.length === 0) return [];
  
  const batchIds = customerPackages.map(p => p.batchId).filter((id): id is number => id !== null);
  
  // Get batch details with customer's package count
  const batchesWithCounts = await Promise.all(
    batchIds.map(async (batchId) => {
      const batch = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
      const customerPackageCount = await db.select({ count: sql<number>`COUNT(*)` })
        .from(packages)
        .where(and(
          eq(packages.batchId, batchId),
          eq(packages.customerId, customerId)
        ));
      
      if (!batch[0]) return null;
      
      return {
        ...batch[0],
        customerPackageCount: customerPackageCount[0]?.count || 0
      };
    })
  );
  
  return batchesWithCounts.filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Get customer's packages in a specific batch
export async function getCustomerPackagesInBatch(customerId: number, batchId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const customerPackages = await db.select().from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      eq(packages.batchId, batchId)
    ))
    .orderBy(desc(packages.createdAt));
  
  // Check if each package is linked to a Full Package order
  const result = [];
  for (const pkg of customerPackages) {
    let isFullPackage = false;
    let fullPackageOrderId = null;
    let fullPackageOrderType: 'full_package' | 'commission' | null = null;
    
    if (pkg.trackingNumber) {
      // Check if this tracking number is linked to a Full Package order
      const fpOrder = await db.select()
        .from(fullPackageOrders)
        .where(eq(fullPackageOrders.trackingNumber, pkg.trackingNumber))
        .limit(1);
      
      if (fpOrder[0]) {
        isFullPackage = true;
        fullPackageOrderId = fpOrder[0].id;
        fullPackageOrderType = fpOrder[0].orderType as 'full_package' | 'commission';
      }
    }
    
    result.push({
      ...pkg,
      weightKg: Number(pkg.weightKg) || 0,
      volumeCbm: Number(pkg.volumeCbm) || 0,
      lengthCm: Number(pkg.lengthCm) || 0,
      widthCm: Number(pkg.widthCm) || 0,
      heightCm: Number(pkg.heightCm) || 0,
      calculatedCostUsd: Number(pkg.calculatedCostUsd) || 0,
      isFullPackage,
      fullPackageOrderId,
      fullPackageOrderType,
    });
  }
  
  return result;
}

// Get customer's recent packages (not in batch yet)
export async function getCustomerUnbatchedPackages(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      isNull(packages.batchId)
    ))
    .orderBy(desc(packages.createdAt));
}

// Get customer financial summary
export async function getCustomerFinancialSummary(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const account = await getCustomerAccountByCustomerId(customerId);
  if (!account) {
    return {
      balanceUsd: 0,
      balanceIqd: 0,
      creditLimitUsd: 0,
      totalPackages: 0,
      totalPaid: 0,
      status: 'active' as const
    };
  }
  
  // Get total paid
  const totalPaidData = await db.select({
    total: sql<number>`SUM(${paymentRecords.amountUsd} - ${paymentRecords.reversedAmountUsd})`
  }).from(paymentRecords)
    .where(eq(paymentRecords.accountId, account.id));
  
  // Get total packages delivered
  const packageCount = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      eq(packages.status, 'delivered')
    ));
  
  return {
    balanceUsd: Number(account.currentBalanceUsd) || 0,
    balanceIqd: Number(account.currentBalanceIqd) || 0,
    creditLimitUsd: Number(account.creditLimitUsd) || 0,
    totalPackages: packageCount[0]?.count || 0,
    totalPaid: totalPaidData[0]?.total || 0,
    status: account.accountStatus
  };
}

// Get customer's transaction history from unified ledger system
export async function getCustomerTransactionHistory(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  // First, get or create customer account
  const account = await getCustomerAccountByCustomerId(customerId);
  if (!account) {
    // Try to auto-create account
    const customer = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
    if (!customer[0]) return [];
    
    // Return empty if no account exists yet
    return [];
  }
  
  // Get transactions from unified ledgerTransactions table
  const transactions = await db.select({
    id: ledgerTransactions.id,
    transactionType: ledgerTransactions.transactionType,
    transactionNumber: ledgerTransactions.transactionNumber,
    amountUsd: ledgerTransactions.amountUsd,
    amountIqd: ledgerTransactions.amountIqd,
    balanceBeforeUsd: ledgerTransactions.balanceBeforeUsd,
    balanceAfterUsd: ledgerTransactions.balanceAfterUsd,
    description: ledgerTransactions.description,
    createdAt: ledgerTransactions.createdAt,
    referenceType: ledgerTransactions.referenceType,
    referenceId: ledgerTransactions.referenceId,
    invoiceId: ledgerTransactions.invoiceId,
  }).from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, account.id))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(limit);
  
  // Return transactions from unified ledgerTransactions table only
  // Legacy ledgerEntries fallback removed - system now uses unified ledger
  return transactions;
}

// Search package by tracking number for customer
export async function searchCustomerPackage(customerId: number, trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      or(
        eq(packages.trackingNumber, trackingNumber),
        eq(packages.packageCode, trackingNumber)
      )
    ))
    .limit(1);
  
  return result[0] || null;
}

// Get customer notification count
export async function getCustomerNotificationCount(customerId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  // Count unread notifications (status changes in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const result = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(packageStatusHistory)
    .innerJoin(packages, eq(packageStatusHistory.packageId, packages.id))
    .where(and(
      eq(packages.customerId, customerId),
      gte(packageStatusHistory.changedAt, sevenDaysAgo)
    ));
  
  return result[0]?.count || 0;
}



// ============ PACKAGE CLAIM REQUESTS ============

// Get next claim request number
export async function getNextClaimRequestNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const year = new Date().getFullYear();
  const prefix = `CLM-${year}-`;
  
  const result = await db.select({ requestNumber: packageClaimRequests.requestNumber })
    .from(packageClaimRequests)
    .where(like(packageClaimRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(packageClaimRequests.id))
    .limit(1);
  
  let nextNum = 1;
  if (result.length > 0 && result[0].requestNumber) {
    const match = result[0].requestNumber.match(/CLM-\d+-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }
  
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

// Create a new claim request
export async function createClaimRequest(data: {
  packageId: number;
  trackingNumber: string;
  customerId: number;
  customerNote?: string;
}): Promise<PackageClaimRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const requestNumber = await getNextClaimRequestNumber();
  
  const [request] = await db.insert(packageClaimRequests).values({
    requestNumber,
    packageId: data.packageId,
    trackingNumber: data.trackingNumber,
    customerId: data.customerId,
    customerNote: data.customerNote,
    status: "pending",
  }).$returningId();
  
  const [created] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, request.id));
  return created;
}

// Get all claim requests (for admin)
export async function getAllClaimRequests(options?: {
  status?: "pending" | "approved" | "rejected";
  limit?: number;
  offset?: number;
}): Promise<{ requests: PackageClaimRequest[]; total: number }> {
  const db = await getDb();
  if (!db) return { requests: [], total: 0 };
  
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(packageClaimRequests.status, options.status));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [totalResult] = await db.select({ count: count() })
    .from(packageClaimRequests)
    .where(whereClause);
  
  const requests = await db.select()
    .from(packageClaimRequests)
    .where(whereClause)
    .orderBy(desc(packageClaimRequests.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
  
  return { requests, total: totalResult?.count || 0 };
}

// Get claim requests by customer
export async function getClaimRequestsByCustomer(customerId: number): Promise<PackageClaimRequest[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(packageClaimRequests)
    .where(eq(packageClaimRequests.customerId, customerId))
    .orderBy(desc(packageClaimRequests.createdAt));
}

// Get claim request by ID
export async function getClaimRequestById(id: number): Promise<PackageClaimRequest | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [request] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, id));
  return request || null;
}

// Check if customer already has pending claim for this package
export async function hasExistingClaimRequest(packageId: number, customerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [existing] = await db.select({ count: count() })
    .from(packageClaimRequests)
    .where(and(
      eq(packageClaimRequests.packageId, packageId),
      eq(packageClaimRequests.customerId, customerId),
      eq(packageClaimRequests.status, "pending")
    ));
  
  return (existing?.count || 0) > 0;
}

// Approve claim request
export async function approveClaimRequest(
  requestId: number,
  reviewedById: number,
  adminNote?: string
): Promise<PackageClaimRequest | null> {
  const db = await getDb();
  if (!db) return null;
  
  const request = await getClaimRequestById(requestId);
  if (!request) return null;
  
  // Update request status
  await db.update(packageClaimRequests)
    .set({
      status: "approved",
      reviewedById,
      reviewedAt: new Date(),
      adminNote,
    })
    .where(eq(packageClaimRequests.id, requestId));
  
  // Assign package to customer
  await db.update(packages)
    .set({
      customerId: request.customerId,
      isUnclaimed: false,
      claimedAt: new Date(),
      claimedById: reviewedById,
    })
    .where(eq(packages.id, request.packageId));
  
  const [updated] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, requestId));
  return updated;
}

// Reject claim request
export async function rejectClaimRequest(
  requestId: number,
  reviewedById: number,
  adminNote?: string
): Promise<PackageClaimRequest | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(packageClaimRequests)
    .set({
      status: "rejected",
      reviewedById,
      reviewedAt: new Date(),
      adminNote,
    })
    .where(eq(packageClaimRequests.id, requestId));
  
  const [updated] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, requestId));
  return updated;
}

// Get pending claim requests count (for admin badge)
export async function getPendingClaimRequestsCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.select({ count: count() })
    .from(packageClaimRequests)
    .where(eq(packageClaimRequests.status, "pending"));
  
  return result?.count || 0;
}

// Search unclaimed packages by tracking number
export async function searchUnclaimedPackages(searchTerm: string): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(packages)
    .where(and(
      eq(packages.isUnclaimed, true),
      or(
        like(packages.trackingNumber, `%${searchTerm}%`),
        like(packages.packageCode, `%${searchTerm}%`)
      )
    ))
    .orderBy(desc(packages.createdAt))
    .limit(50);
}

// Get unclaimed packages with pagination and search
export async function getUnclaimedPackagesWithSearch(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ packages: Package[]; total: number }> {
  const db = await getDb();
  if (!db) return { packages: [], total: 0 };
  
  const conditions = [eq(packages.isUnclaimed, true)];
  
  if (options?.search) {
    conditions.push(
      or(
        like(packages.trackingNumber, `%${options.search}%`),
        like(packages.packageCode, `%${options.search}%`)
      )!
    );
  }
  
  const whereClause = and(...conditions);
  
  const [totalResult] = await db.select({ count: count() })
    .from(packages)
    .where(whereClause);
  
  const result = await db.select()
    .from(packages)
    .where(whereClause)
    .orderBy(desc(packages.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
  
  return { packages: result, total: totalResult?.count || 0 };
}



// ============ CUSTOMER MESSAGES ============

export async function getCustomerMessages(customerId: number, limit = 50): Promise<CustomerMessage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(customerMessages)
    .where(eq(customerMessages.customerId, customerId))
    .orderBy(desc(customerMessages.createdAt))
    .limit(limit);
}

export async function getConversationMessages(conversationId: string, limit = 100): Promise<CustomerMessage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(customerMessages)
    .where(eq(customerMessages.conversationId, conversationId))
    .orderBy(customerMessages.createdAt)
    .limit(limit);
}

export async function createCustomerMessage(data: InsertCustomerMessage): Promise<CustomerMessage | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(customerMessages).values(data);
  const [message] = await db.select().from(customerMessages).where(eq(customerMessages.id, result.insertId));
  return message || null;
}

export async function markCustomerMessagesAsRead(customerId: number, senderType: 'customer' | 'admin'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Mark messages from the other party as read
  const readSenderType = senderType === 'customer' ? 'admin' : 'customer';
  
  await db.update(customerMessages)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(customerMessages.customerId, customerId),
      eq(customerMessages.senderType, readSenderType),
      eq(customerMessages.isRead, false)
    ));
}

export async function getUnreadMessageCount(customerId: number, forSenderType: 'customer' | 'admin'): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Count unread messages from the other party
  const fromSenderType = forSenderType === 'customer' ? 'admin' : 'customer';
  
  const [result] = await db.select({ count: count() })
    .from(customerMessages)
    .where(and(
      eq(customerMessages.customerId, customerId),
      eq(customerMessages.senderType, fromSenderType),
      eq(customerMessages.isRead, false)
    ));
  
  return result?.count || 0;
}

export async function getAllConversations(): Promise<{ customerId: number; customerName: string; customerCode: string; unreadCount: number; lastMessage: string; lastMessageAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get all unique conversations with customer info and unread count (from customers table)
  const conversations = await db.select({
    customerId: customerMessages.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
  })
    .from(customerMessages)
    .innerJoin(customers, eq(customers.id, customerMessages.customerId))
    .groupBy(customerMessages.customerId, customers.fullName, customers.customerCode);
  
  // Get unread count and last message for each conversation
  const result = await Promise.all(conversations.map(async (conv) => {
    const [unreadResult] = await db.select({ count: count() })
      .from(customerMessages)
      .where(and(
        eq(customerMessages.customerId, conv.customerId),
        eq(customerMessages.senderType, 'customer'),
        eq(customerMessages.isRead, false)
      ));
    
    const [lastMsg] = await db.select()
      .from(customerMessages)
      .where(eq(customerMessages.customerId, conv.customerId))
      .orderBy(desc(customerMessages.createdAt))
      .limit(1);
    
    return {
      customerId: conv.customerId,
      customerName: conv.customerName || '',
      customerCode: conv.customerCode || '',
      unreadCount: unreadResult?.count || 0,
      lastMessage: lastMsg?.message || '',
      lastMessageAt: lastMsg?.createdAt || new Date(),
    };
  }));
  
  return result.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}


// ============ CUSTOMER NOTIFICATIONS ============

export async function getCustomerNotifications(customerId: number, options?: { limit?: number; unreadOnly?: boolean }): Promise<CustomerNotification[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(customerNotifications.customerId, customerId)];
  
  if (options?.unreadOnly) {
    conditions.push(eq(customerNotifications.isRead, false));
  }
  
  return db.select()
    .from(customerNotifications)
    .where(and(...conditions))
    .orderBy(desc(customerNotifications.createdAt))
    .limit(options?.limit || 50);
}

export async function createCustomerNotification(data: InsertCustomerNotification): Promise<CustomerNotification | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(customerNotifications).values(data);
  const [notification] = await db.select().from(customerNotifications).where(eq(customerNotifications.id, result.insertId));
  return notification || null;
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(customerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(customerNotifications.id, notificationId));
}

export async function markAllNotificationsAsRead(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(customerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(customerNotifications.customerId, customerId),
      eq(customerNotifications.isRead, false)
    ));
}

export async function getUnreadNotificationCount(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.select({ count: count() })
    .from(customerNotifications)
    .where(and(
      eq(customerNotifications.customerId, customerId),
      eq(customerNotifications.isRead, false)
    ));
  
  return result?.count || 0;
}


// ============ CUSTOMER ADDRESSES ============

export async function getCustomerAddresses(customerId: number): Promise<CustomerAddress[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(customerAddresses)
    .where(and(
      eq(customerAddresses.customerId, customerId),
      eq(customerAddresses.isActive, true)
    ))
    .orderBy(desc(customerAddresses.isDefault), customerAddresses.label);
}

export async function getCustomerAddressById(addressId: number): Promise<CustomerAddress | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [address] = await db.select()
    .from(customerAddresses)
    .where(eq(customerAddresses.id, addressId));
  
  return address || null;
}

export async function createCustomerAddress(data: InsertCustomerAddress): Promise<CustomerAddress | null> {
  const db = await getDb();
  if (!db) return null;
  
  // If this is the first address or marked as default, unset other defaults
  if (data.isDefault) {
    await db.update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, data.customerId));
  }
  
  const [result] = await db.insert(customerAddresses).values(data);
  const [address] = await db.select().from(customerAddresses).where(eq(customerAddresses.id, result.insertId));
  return address || null;
}

export async function updateCustomerAddress(addressId: number, data: Partial<InsertCustomerAddress>): Promise<CustomerAddress | null> {
  const db = await getDb();
  if (!db) return null;
  
  // If setting as default, unset other defaults first
  if (data.isDefault) {
    const [existing] = await db.select().from(customerAddresses).where(eq(customerAddresses.id, addressId));
    if (existing) {
      await db.update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, existing.customerId));
    }
  }
  
  await db.update(customerAddresses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customerAddresses.id, addressId));
  
  const [address] = await db.select().from(customerAddresses).where(eq(customerAddresses.id, addressId));
  return address || null;
}

export async function deleteCustomerAddress(addressId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Soft delete by setting isActive to false
  await db.update(customerAddresses)
    .set({ isActive: false })
    .where(eq(customerAddresses.id, addressId));
}

export async function setDefaultAddress(addressId: number, customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Unset all defaults for this customer
  await db.update(customerAddresses)
    .set({ isDefault: false })
    .where(eq(customerAddresses.customerId, customerId));
  
  // Set the new default
  await db.update(customerAddresses)
    .set({ isDefault: true })
    .where(eq(customerAddresses.id, addressId));
}

