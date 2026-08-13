import { getDb } from './connection';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { ENV } from '../_core/env';
import { appLogger } from '../utils/logger';
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

// ============ USER OPERATIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    appLogger.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    appLogger.error("[Database] Failed to upsert user", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    appLogger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByMobile(mobileNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.mobileNumber, mobileNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(usernameOrEmail: string) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.select().from(users).where(or(eq(users.username, usernameOrEmail), eq(users.email, usernameOrEmail), eq(users.name, usernameOrEmail))).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch {
    return undefined;
  }
}

export async function updateUserLastSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

// Create customer in customers table (not users table)
export async function createCustomer(data: {
  customerCode: string;
  sequenceNumber: number;
  fullName: string;
  fullNameArabic?: string;
  fullNameKurdish?: string;
  gender?: "male" | "female";
  nationality?: string;
  businessType?: string;
  mobileNumber: string;
  secondaryMobile?: string;
  passwordHash: string;
  email?: string;
  country?: string;
  city?: string;
  district?: string;
  address?: string;
  goodsTypePreferences?: string[];
  shippingTypePreferences?: string[];
  serviceTypes?: string[];
  notes?: string;
  passportUrl?: string;
  nationalIdUrl?: string;
  contractUrl?: string;
  createdById: number;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(customers).values({
    customerCode: data.customerCode,
    sequenceNumber: data.sequenceNumber,
    fullName: data.fullName,
    fullNameArabic: data.fullNameArabic,
    fullNameKurdish: data.fullNameKurdish,
    gender: data.gender,
    nationality: data.nationality,
    businessType: data.businessType,
    mobileNumber: data.mobileNumber,
    secondaryMobile: data.secondaryMobile,
    passwordHash: data.passwordHash,
    email: data.email,
    country: data.country,
    city: data.city,
    district: data.district,
    address: data.address,
    passportUrl: data.passportUrl,
    nationalIdUrl: data.nationalIdUrl,
    contractUrl: data.contractUrl,
    goodsTypePreferences: data.goodsTypePreferences,
    shippingTypePreferences: data.shippingTypePreferences,
    serviceTypes: data.serviceTypes,
    notes: data.notes,
    createdById: data.createdById,
    isActive: data.isActive,
  });
  
  const insertId = result[0].insertId;
  const newCustomer = await db.select().from(customers).where(eq(customers.id, insertId)).limit(1);
  
  // Auto-create customer account for wallet system
  if (newCustomer[0]) {
    try {
      const accountNumber = `ACC-${data.customerCode}-${new Date().getFullYear()}`;
      await db.insert(customerAccounts).values({
        customerId: insertId,
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
      appLogger.info(`[Customer] Created account ${accountNumber} for customer ${data.customerCode}`);
    } catch (err) {
      appLogger.error(`[Customer] Failed to create account for ${data.customerCode}`, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  
  return newCustomer[0];
}

export async function getNextCustomerSequence(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  
  // Get max sequence from customers table only
  const customersResult = await db.select({ maxSeq: sql<number>`COALESCE(MAX(sequenceNumber), 0)` })
    .from(customers);
  
  const maxSeq = customersResult[0]?.maxSeq || 0;
  return maxSeq + 1;
}

// Get next sequence number for a specific prefix by analyzing existing customer codes
export async function getNextSequenceForPrefix(prefix: string): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  
  // Find all customers whose code starts with this prefix followed by digits
  // e.g., for prefix "QI", find QI0001(...), QI0002(...), etc.
  const upperPrefix = prefix.toUpperCase();
  const result = await db.select({ code: customers.customerCode })
    .from(customers)
    .where(sql`UPPER(${customers.customerCode}) LIKE ${upperPrefix + '%'}`);
  
  let maxNum = 0;
  const prefixRegex = new RegExp(`^${upperPrefix}(\\d+)`, 'i');
  
  for (const row of result) {
    if (!row.code) continue;
    const match = row.code.match(prefixRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  
  return maxNum + 1;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  // Only return staff users (not customers) - customers are in the customers table
  // Filter out any legacy customer records that may exist
  return db.select().from(users)
    .where(sql`${users.role} != 'customer'`)
    .orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "super_admin" | "admin" | "employee" | "accountant") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// Staff management functions
export async function createStaffUser(data: {
  name: string;
  username?: string;
  email?: string;
  mobileNumber?: string;
  passwordHash: string;
  role: "admin" | "employee" | "accountant";
  workCountryId?: number;
  workCity?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const username = data.username || null;
  const values = {
    openId: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    username,
    name: data.name,
    email: data.email ?? null,
    mobileNumber: data.mobileNumber ?? null,
    passwordHash: data.passwordHash,
    role: data.role,
    loginMethod: "username",
    isActive: true,
    workCountryId: data.workCountryId ?? null,
    workCity: data.workCity ?? null,
  };

  try {
    await db.insert(users).values(values);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : null;
    const code = (cause && typeof cause === "object" && "code" in cause) ? (cause as { code: string }).code : (err as { code?: string }).code;
    const errno = (cause && typeof cause === "object" && "errno" in cause) ? (cause as { errno: number }).errno : (err as { errno?: number }).errno;
    const isDup = msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY") || code === "ER_DUP_ENTRY" || errno === 1062;
    if (isDup && username) {
      await db.update(users).set({ passwordHash: data.passwordHash }).where(eq(users.username, username));
    } else {
      throw err;
    }
  }

  if (username) {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }
  return undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

export async function getAllStaff() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(
    or(
      eq(users.role, "admin"),
      eq(users.role, "employee"),
      eq(users.role, "accountant")
    )
  ).orderBy(desc(users.createdAt));
}


// ============ AUDIT LOG OPERATIONS (ADVANCED) ============

// Category mapping for entity types
const entityCategoryMap: Record<string, 'customer' | 'package' | 'batch' | 'full_package' | 'purchase_request' | 'commission' | 'finance' | 'settings' | 'user' | 'system'> = {
  'Customer': 'customer',
  'User': 'user',
  'Package': 'package',
  'Batch': 'batch',
  'batch': 'batch',
  'FullPackageOrder': 'full_package',
  'PurchaseRequest': 'purchase_request',
  'CommissionOrder': 'commission',
  'LedgerTransaction': 'finance',
  'Payment': 'finance',
  'PaymentRecord': 'finance',
  'Invoice': 'finance',
  'CustomerAccount': 'finance',
  'PricingRule': 'settings',
  'Warehouse': 'settings',
  'warehouse': 'settings',
  'Country': 'settings',
  'country': 'settings',
  'ExchangeRate': 'settings',
  'Permission': 'user',
  'System': 'system',
};

// Action labels in Kurdish
const actionLabels: Record<string, string> = {
  'create': 'دروستکردن',
  'update': 'نوێکردنەوە',
  'delete': 'سڕینەوە',
  'status_change': 'گۆڕینی بارودۆخ',
  'charge': 'چارج کردن',
  'payment': 'پارەدان',
  'refund': 'گەڕاندنەوە',
  'adjustment': 'ڕێکخستن',
  'login': 'چوونەژوورەوە',
  'logout': 'چوونەدەرەوە',
  'register_package': 'تۆمارکردنی پاکەت',
  'update_package_status': 'گۆڕینی بارودۆخی پاکەت',
  'create_full_package_order': 'دروستکردنی پاکێجی تەواو',
  'update_full_package_order': 'نوێکردنەوەی پاکێجی تەواو',
  'create_purchase_request': 'دروستکردنی داواکاری کڕین',
  'update_purchase_request': 'نوێکردنەوەی داواکاری کڕین',
  'create_commission_order': 'دروستکردنی کڕین بە تێچوو',
  'update_commission_order': 'نوێکردنەوەی کڕین بە تێچوو',
  'create_batch': 'دروستکردنی باچ',
  'update_batch_status': 'گۆڕینی بارودۆخی باچ',
  'create_customer': 'دروستکردنی کڕیار',
  'update_customer': 'نوێکردنەوەی کڕیار',
  'activate_customer': 'چالاککردنی کڕیار',
  'deactivate_customer': 'ناچالاککردنی کڕیار',
  'record_payment': 'تۆمارکردنی پارەدان',
  'create_invoice': 'دروستکردنی پسوولە',
  'update_pricing': 'نوێکردنەوەی نرخ',
  'update_settings': 'نوێکردنەوەی ڕێکخستنەکان',
};

// Get changed fields between old and new values
function getChangedFields(oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null): string[] {
  if (!oldValues || !newValues) return [];
  const changed: string[] = [];
  const allKeys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));
  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key);
    }
  }
  return changed;
}

// Generate human-readable description
function generateDescription(action: string, entityType: string, entityCode: string | null, changedFields: string[]): string {
  const actionLabel = actionLabels[action] || action;
  const entityLabel = entityCode || entityType;
  
  if (changedFields.length > 0 && changedFields.length <= 3) {
    return `${actionLabel}: ${entityLabel} (${changedFields.join(', ')})`;
  } else if (changedFields.length > 3) {
    return `${actionLabel}: ${entityLabel} (${changedFields.length} فیڵد گۆڕدرا)`;
  }
  return `${actionLabel}: ${entityLabel}`;
}

export interface AdvancedAuditLogData {
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: number;
  entityCode?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAdvancedAuditLog(data: AdvancedAuditLogData) {
  const db = await getDb();
  if (!db) return;
  
  const category = entityCategoryMap[data.entityType] || 'system';
  const actionLabel = actionLabels[data.action] || data.action;
  const changedFields = getChangedFields(data.oldValues || null, data.newValues || null);
  const description = generateDescription(data.action, data.entityType, data.entityCode || null, changedFields);
  
  await db.insert(auditLogs).values({
    userId: data.userId,
    userName: data.userName,
    userRole: data.userRole,
    action: data.action,
    actionLabel,
    category,
    entityType: data.entityType,
    entityId: data.entityId,
    entityCode: data.entityCode,
    oldValues: data.oldValues,
    newValues: data.newValues,
    changedFields,
    description,
    metadata: data.metadata,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}

// Legacy function for backward compatibility
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  
  // Add category if not present
  const category = entityCategoryMap[data.entityType] || 'system';
  const actionLabel = actionLabels[data.action] || data.action;
  
  await db.insert(auditLogs).values({
    ...data,
    category,
    actionLabel,
  });
}

export interface AuditLogFilters {
  category?: string;
  entityType?: string;
  action?: string;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export async function getAdvancedAuditLogs(filters: AuditLogFilters = {}, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  
  const conditions: SQL[] = [];
  
  if (filters.category) {
    conditions.push(eq(auditLogs.category, filters.category as never));
  }
  if (filters.entityType) {
    conditions.push(eq(auditLogs.entityType, filters.entityType as never));
  }
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action as never));
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.startDate) {
    conditions.push(gte(auditLogs.createdAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(auditLogs.createdAt, filters.endDate));
  }
  if (filters.search) {
    const searchCond = or(
      like(auditLogs.entityCode, `%${filters.search}%`),
      like(auditLogs.description, `%${filters.search}%`),
      like(auditLogs.userName, `%${filters.search}%`)
    );
    if (searchCond) conditions.push(searchCond as SQL);
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [logs, countResult] = await Promise.all([
    db.select().from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause)
  ]);
  
  return {
    logs,
    total: countResult[0]?.count || 0
  };
}

export async function getAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function getAuditLogsByEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).where(
    and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId))
  ).orderBy(desc(auditLogs.createdAt));
}

export async function getAuditLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
  return result[0] || null;
}

export async function getAuditLogStats() {
  const db = await getDb();
  if (!db) return { total: 0, byCategory: {}, byAction: {}, recentActivity: [] };
  
  // Get total count
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
  const total = totalResult[0]?.count || 0;
  
  // Get counts by category
  const categoryStats = await db.select({
    category: auditLogs.category,
    count: sql<number>`count(*)`
  }).from(auditLogs).groupBy(auditLogs.category);
  
  const byCategory: Record<string, number> = {};
  categoryStats.forEach(stat => {
    byCategory[stat.category] = stat.count;
  });
  
  // Get counts by action (top 10)
  const actionStats = await db.select({
    action: auditLogs.action,
    count: sql<number>`count(*)`
  }).from(auditLogs).groupBy(auditLogs.action).orderBy(desc(sql`count(*)`)).limit(10);
  
  const byAction: Record<string, number> = {};
  actionStats.forEach(stat => {
    byAction[stat.action] = stat.count;
  });
  
  // Get recent activity (last 24 hours by hour)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentActivity = await db.select({
    hour: sql<string>`DATE_FORMAT(createdAt, '%Y-%m-%d %H:00')`,
    count: sql<number>`count(*)`
  }).from(auditLogs)
    .where(gte(auditLogs.createdAt, oneDayAgo))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m-%d %H:00')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m-%d %H:00')`);
  
  return {
    total,
    byCategory,
    byAction,
    recentActivity
  };
}


// ============ NOTIFICATION LOG OPERATIONS ============

export async function createNotificationLog(data: InsertNotificationLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificationLogs).values(data);
}

export async function getNotificationLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationLogs).orderBy(desc(notificationLogs.createdAt)).limit(limit);
}


// ============ SCHEDULED TASKS LOG OPERATIONS ============

export async function createScheduledTaskLog(data: InsertScheduledTaskLog): Promise<ScheduledTaskLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scheduledTasksLog).values(data);
  const inserted = await db.select().from(scheduledTasksLog).where(eq(scheduledTasksLog.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function updateScheduledTaskLog(id: number, data: Partial<InsertScheduledTaskLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledTasksLog).set(data).where(eq(scheduledTasksLog.id, id));
}

export async function getRecentScheduledTasks(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledTasksLog).orderBy(desc(scheduledTasksLog.createdAt)).limit(limit);
}


// ============ STOCK MANAGEMENT OPERATIONS ============

// Stock Categories
export async function createStockCategory(data: InsertStockCategory): Promise<StockCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(stockCategories).values(data);
  const inserted = await db.select().from(stockCategories).where(eq(stockCategories.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getStockCategoryById(id: number): Promise<StockCategory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockCategories).where(eq(stockCategories.id, id)).limit(1);
  return result[0];
}

export async function getAllStockCategories(activeOnly = true): Promise<StockCategory[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (activeOnly) {
    return db.select().from(stockCategories).where(eq(stockCategories.isActive, true)).orderBy(stockCategories.sortOrder);
  }
  return db.select().from(stockCategories).orderBy(stockCategories.sortOrder);
}

export async function updateStockCategory(id: number, data: Partial<InsertStockCategory>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(stockCategories).set(data).where(eq(stockCategories.id, id));
}

export async function deleteStockCategory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(stockCategories).where(eq(stockCategories.id, id));
}

// Stock Products
export async function createStockProduct(data: InsertStockProduct): Promise<StockProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  appLogger.debug('[DB DEBUG] Input data.barcode', { barcode: data.barcode, type: typeof data.barcode });
  
  // Set available stock = current stock initially
  // Handle empty barcode as null to avoid unique constraint issues
  // Must explicitly check for empty string since empty string is falsy but still sent to DB
  const barcodeValue = (data.barcode && typeof data.barcode === 'string' && data.barcode.trim() !== '') ? data.barcode.trim() : null;
  
  appLogger.debug('[DB DEBUG] Processed barcodeValue', { barcodeValue });
  
  // Create productData without barcode first, then add it only if it has a value
  const { barcode: _ignoredBarcode, ...dataWithoutBarcode } = data;
  const productData: Record<string, unknown> = {
    ...dataWithoutBarcode,
    availableStock: data.currentStock || 0,
  };
  // Only add barcode if it has a real value (not empty string, not null)
  if (barcodeValue) {
    productData.barcode = barcodeValue;
  }
  
  appLogger.debug('[DB DEBUG] Final productData.barcode', { barcode: productData.barcode });
  
  const result = await db.insert(stockProducts).values(productData as InsertStockProduct);
  const rawId = (result[0] as { insertId?: number }).insertId;
  const id: number = typeof rawId === "number" && Number.isFinite(rawId) ? rawId : Number(rawId) || 0;
  const inserted = await db.select().from(stockProducts).where(eq(stockProducts.id, id));
  return inserted[0];
}

export async function getStockProductById(id: number): Promise<StockProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockProducts).where(eq(stockProducts.id, id)).limit(1);
  return result[0];
}

export async function getStockProductBySku(sku: string): Promise<StockProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockProducts).where(eq(stockProducts.sku, sku)).limit(1);
  return result[0];
}

export async function getStockProductByBarcode(barcode: string): Promise<StockProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockProducts).where(eq(stockProducts.barcode, barcode)).limit(1);
  return result[0];
}

export async function getAllStockProducts(filters?: {
  categoryId?: number;
  search?: string;
  lowStock?: boolean;
  activeOnly?: boolean;
}): Promise<StockProduct[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.categoryId) {
    conditions.push(eq(stockProducts.categoryId, filters.categoryId));
  }
  
  if (filters?.activeOnly !== false) {
    conditions.push(eq(stockProducts.isActive, true));
  }
  
  if (filters?.search) {
    conditions.push(
      or(
        like(stockProducts.name, `%${filters.search}%`),
        like(stockProducts.sku, `%${filters.search}%`),
        like(stockProducts.barcode, `%${filters.search}%`)
      )
    );
  }
  
  if (filters?.lowStock) {
    conditions.push(
      sql`${stockProducts.currentStock} <= ${stockProducts.minStockLevel}`
    );
  }
  
  if (conditions.length > 0) {
    return db.select().from(stockProducts).where(and(...conditions)).orderBy(desc(stockProducts.createdAt));
  }
  
  return db.select().from(stockProducts).orderBy(desc(stockProducts.createdAt));
}

export async function updateStockProduct(id: number, data: Partial<InsertStockProduct>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Recalculate available stock if current or reserved stock changes
  const updateData: Record<string, unknown> = { ...data };
  if (data.currentStock !== undefined || data.reservedStock !== undefined) {
    const product = await getStockProductById(id);
    if (product) {
      const currentStock = data.currentStock ?? product.currentStock ?? 0;
      const reservedStock = data.reservedStock ?? product.reservedStock ?? 0;
      updateData.availableStock = currentStock - reservedStock;
    }
  }
  
  await db.update(stockProducts).set(updateData).where(eq(stockProducts.id, id));
}

export async function deleteStockProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(stockProducts).where(eq(stockProducts.id, id));
}

export async function getLowStockProducts(): Promise<StockProduct[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(stockProducts)
    .where(
      and(
        eq(stockProducts.isActive, true),
        eq(stockProducts.trackInventory, true),
        sql`${stockProducts.currentStock} <= ${stockProducts.minStockLevel}`
      )
    )
    .orderBy(stockProducts.currentStock);
}

// Stock Purchases
export async function createStockPurchase(data: InsertStockPurchase): Promise<StockPurchase> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(stockPurchases).values(data);
  const inserted = await db.select().from(stockPurchases).where(eq(stockPurchases.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getStockPurchaseById(id: number): Promise<StockPurchase | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockPurchases).where(eq(stockPurchases.id, id)).limit(1);
  return result[0];
}

export async function getAllStockPurchases(filters?: {
  status?: string;
  supplierId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<StockPurchase[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(stockPurchases.status, filters.status as never));
  }
  
  if (filters?.supplierId) {
    conditions.push(eq(stockPurchases.supplierId, filters.supplierId));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(stockPurchases.createdAt, filters.startDate));
  }
  
  if (filters?.endDate) {
    conditions.push(lte(stockPurchases.createdAt, filters.endDate));
  }
  
  if (conditions.length > 0) {
    return db.select().from(stockPurchases).where(and(...conditions)).orderBy(desc(stockPurchases.createdAt));
  }
  
  return db.select().from(stockPurchases).orderBy(desc(stockPurchases.createdAt));
}

export async function updateStockPurchase(id: number, data: Partial<InsertStockPurchase>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(stockPurchases).set(data).where(eq(stockPurchases.id, id));
}

export async function deleteStockPurchase(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete items first
  await db.delete(stockPurchaseItems).where(eq(stockPurchaseItems.purchaseId, id));
  await db.delete(stockPurchases).where(eq(stockPurchases.id, id));
}

// Stock Purchase Items
export async function createStockPurchaseItem(data: InsertStockPurchaseItem): Promise<StockPurchaseItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(stockPurchaseItems).values(data);
  const inserted = await db.select().from(stockPurchaseItems).where(eq(stockPurchaseItems.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getStockPurchaseItems(purchaseId: number): Promise<StockPurchaseItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockPurchaseItems).where(eq(stockPurchaseItems.purchaseId, purchaseId));
}

export async function updateStockPurchaseItem(id: number, data: Partial<InsertStockPurchaseItem>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(stockPurchaseItems).set(data).where(eq(stockPurchaseItems.id, id));
}

export async function deleteStockPurchaseItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(stockPurchaseItems).where(eq(stockPurchaseItems.id, id));
}

// Receive stock from purchase
export async function receiveStockFromPurchase(purchaseId: number, items: { itemId: number; receivedQuantity: number }[], receivedById: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const purchase = await getStockPurchaseById(purchaseId);
  if (!purchase) throw new Error("Purchase not found");
  
  for (const item of items) {
    const purchaseItem = await db.select().from(stockPurchaseItems).where(eq(stockPurchaseItems.id, item.itemId)).limit(1);
    if (!purchaseItem[0]) continue;
    
    const product = await getStockProductById(purchaseItem[0].productId);
    if (!product) continue;
    
    const stockBefore = product.currentStock || 0;
    const stockAfter = stockBefore + item.receivedQuantity;
    
    // Update product stock
    await updateStockProduct(product.id, {
      currentStock: stockAfter,
      availableStock: stockAfter - (product.reservedStock || 0),
    });
    
    // Update purchase item received quantity
    await updateStockPurchaseItem(item.itemId, {
      receivedQuantity: (purchaseItem[0].receivedQuantity || 0) + item.receivedQuantity,
    });
    
    // Create stock movement
    await createStockMovement({
      productId: product.id,
      warehouseId: purchase.warehouseId,
      movementType: "purchase_in",
      quantity: item.receivedQuantity,
      stockBefore,
      stockAfter,
      unitCost: purchaseItem[0].unitCost,
      totalCost: String(parseFloat(purchaseItem[0].unitCost) * item.receivedQuantity),
      referenceType: "purchase",
      referenceId: purchaseId,
      referenceCode: purchase.purchaseCode,
      createdById: receivedById,
    });
    
    // Update product cost price (average cost)
    const totalValue = (stockBefore * parseFloat(product.costPrice || "0")) + (item.receivedQuantity * parseFloat(purchaseItem[0].unitCost));
    const newAverageCost = stockAfter > 0 ? totalValue / stockAfter : parseFloat(purchaseItem[0].unitCost);
    await updateStockProduct(product.id, {
      costPrice: newAverageCost.toFixed(2),
    });
  }
  
  // Update purchase status
  await updateStockPurchase(purchaseId, {
    status: "received",
    receivedDate: new Date(),
    receivedById,
  });
}

// Stock Sales
export async function createStockSale(data: InsertStockSale): Promise<StockSale> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(stockSales).values(data);
  const inserted = await db.select().from(stockSales).where(eq(stockSales.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getStockSaleById(id: number): Promise<StockSale | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockSales).where(eq(stockSales.id, id)).limit(1);
  return result[0];
}

export async function getAllStockSales(filters?: {
  saleType?: "account" | "cash";
  status?: string;
  customerId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<StockSale[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.saleType) {
    conditions.push(eq(stockSales.saleType, filters.saleType));
  }
  
  if (filters?.status) {
    conditions.push(eq(stockSales.status, filters.status as never));
  }
  
  if (filters?.customerId) {
    conditions.push(eq(stockSales.customerId, filters.customerId));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(stockSales.saleDate, filters.startDate));
  }
  
  if (filters?.endDate) {
    conditions.push(lte(stockSales.saleDate, filters.endDate));
  }
  
  if (conditions.length > 0) {
    return db.select().from(stockSales).where(and(...conditions)).orderBy(desc(stockSales.saleDate));
  }
  
  return db.select().from(stockSales).orderBy(desc(stockSales.saleDate));
}

export async function updateStockSale(id: number, data: Partial<InsertStockSale>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(stockSales).set(data).where(eq(stockSales.id, id));
}

export async function deleteStockSale(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(stockSaleItems).where(eq(stockSaleItems.saleId, id));
  await db.delete(stockSales).where(eq(stockSales.id, id));
}

// Stock Sale Items
export async function createStockSaleItem(data: InsertStockSaleItem): Promise<StockSaleItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(stockSaleItems).values(data);
  const inserted = await db.select().from(stockSaleItems).where(eq(stockSaleItems.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getStockSaleItems(saleId: number): Promise<StockSaleItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockSaleItems).where(eq(stockSaleItems.saleId, saleId));
}

// Process a complete sale (create sale + items + update stock)
export async function processStockSale(
  saleData: InsertStockSale,
  items: { productId: number; quantity: number; unitPrice: string; discount?: string }[],
  createdById: number
): Promise<StockSale> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let subtotal = 0;
  let totalCost = 0;
  const saleItems: InsertStockSaleItem[] = [];
  
  // Calculate totals and prepare items
  for (const item of items) {
    const product = await getStockProductById(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    
    if (product.trackInventory && !product.allowNegativeStock && (product.availableStock || 0) < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.availableStock}`);
    }
    
    const unitPrice = parseFloat(item.unitPrice);
    const unitCost = parseFloat(product.costPrice || "0");
    const discount = parseFloat(item.discount || "0");
    const itemTotal = (unitPrice * item.quantity) - discount;
    const itemCost = unitCost * item.quantity;
    const itemProfit = itemTotal - itemCost;
    
    subtotal += itemTotal;
    totalCost += itemCost;
    
    saleItems.push({
      saleId: 0, // Will be set after sale is created
      productId: item.productId,
      productName: product.name,
      productSku: product.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: product.costPrice || "0",
      discount: item.discount || "0",
      totalPrice: itemTotal.toFixed(2),
      totalCost: itemCost.toFixed(2),
      profit: itemProfit.toFixed(2),
    });
  }
  
  const discountAmount = parseFloat(saleData.discount || "0");
  const totalAmount = subtotal - discountAmount + parseFloat(saleData.shippingCharge || "0");
  const profit = totalAmount - totalCost;
  const profitMargin = totalAmount > 0 ? (profit / totalAmount) * 100 : 0;
  
  // Create sale
  const sale = await createStockSale({
    ...saleData,
    subtotal: subtotal.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    totalCost: totalCost.toFixed(2),
    profit: profit.toFixed(2),
    profitMargin: profitMargin.toFixed(2),
    createdById,
  });
  
  // Create sale items and update stock
  for (let i = 0; i < saleItems.length; i++) {
    const saleItem = { ...saleItems[i], saleId: sale.id };
    await createStockSaleItem(saleItem);
    
    const product = await getStockProductById(items[i].productId);
    if (product && product.trackInventory) {
      const stockBefore = product.currentStock || 0;
      const stockAfter = stockBefore - items[i].quantity;
      
      // Update product stock
      await updateStockProduct(product.id, {
        currentStock: stockAfter,
        availableStock: stockAfter - (product.reservedStock || 0),
      });
      
      // Create stock movement
      await createStockMovement({
        productId: product.id,
        warehouseId: saleData.warehouseId,
        movementType: "sale_out",
        quantity: -items[i].quantity,
        stockBefore,
        stockAfter,
        unitCost: product.costPrice,
        totalCost: saleItem.totalCost,
        referenceType: "sale",
        referenceId: sale.id,
        referenceCode: sale.saleCode,
        createdById,
      });
    }
  }
  
  return sale;
}

// Stock Movements
export async function createStockMovement(data: InsertStockMovement): Promise<StockMovement> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(stockMovements).values(data);
  const inserted = await db.select().from(stockMovements).where(eq(stockMovements.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getStockMovements(filters?: {
  productId?: number;
  movementType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<StockMovement[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.productId) {
    conditions.push(eq(stockMovements.productId, filters.productId));
  }
  
  if (filters?.movementType) {
    conditions.push(eq(stockMovements.movementType, filters.movementType as never));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(stockMovements.createdAt, filters.startDate));
  }
  
  if (filters?.endDate) {
    conditions.push(lte(stockMovements.createdAt, filters.endDate));
  }
  
  let query = db.select().from(stockMovements);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  query = query.orderBy(desc(stockMovements.createdAt)) as typeof query;
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  
  return query;
}

// Stock adjustment (manual correction)
export async function adjustStock(
  productId: number,
  adjustment: number,
  reason: string,
  createdById: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const product = await getStockProductById(productId);
  if (!product) throw new Error("Product not found");
  
  const stockBefore = product.currentStock || 0;
  const stockAfter = stockBefore + adjustment;
  
  // Update product stock
  await updateStockProduct(productId, {
    currentStock: stockAfter,
    availableStock: stockAfter - (product.reservedStock || 0),
  });
  
  // Create stock movement
  await createStockMovement({
    productId,
    movementType: adjustment > 0 ? "adjustment_in" : "adjustment_out",
    quantity: adjustment,
    stockBefore,
    stockAfter,
    notes: reason,
    createdById,
  });
}

// Stock Summary/Dashboard
export async function getStockSummary(): Promise<{
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalSalesToday: number;
  totalProfitToday: number;
  totalSalesThisMonth: number;
  totalProfitThisMonth: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalProducts: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalSalesToday: 0,
    totalProfitToday: 0,
    totalSalesThisMonth: 0,
    totalProfitThisMonth: 0,
  };
  
  // Get product stats
  const products = await db.select().from(stockProducts).where(eq(stockProducts.isActive, true));
  
  let totalStockValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  
  for (const product of products) {
    const stock = product.currentStock || 0;
    const cost = parseFloat(product.costPrice || "0");
    totalStockValue += stock * cost;
    
    if (stock === 0) {
      outOfStockCount++;
    } else if (stock <= (product.minStockLevel || 0)) {
      lowStockCount++;
    }
  }
  
  // Get today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaySales = await db.select({
    total: sql<number>`COALESCE(SUM(${stockSales.totalAmount}), 0)`,
    profit: sql<number>`COALESCE(SUM(${stockSales.profit}), 0)`,
  }).from(stockSales)
    .where(
      and(
        gte(stockSales.saleDate, today),
        eq(stockSales.status, "confirmed")
      )
    );
  
  // Get this month's sales
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const monthSales = await db.select({
    total: sql<number>`COALESCE(SUM(${stockSales.totalAmount}), 0)`,
    profit: sql<number>`COALESCE(SUM(${stockSales.profit}), 0)`,
  }).from(stockSales)
    .where(
      and(
        gte(stockSales.saleDate, monthStart),
        eq(stockSales.status, "confirmed")
      )
    );
  
  return {
    totalProducts: products.length,
    totalStockValue,
    lowStockCount,
    outOfStockCount,
    totalSalesToday: Number(todaySales[0]?.total || 0),
    totalProfitToday: Number(todaySales[0]?.profit || 0),
    totalSalesThisMonth: Number(monthSales[0]?.total || 0),
    totalProfitThisMonth: Number(monthSales[0]?.profit || 0),
  };
}

// Generate unique codes
export async function generateStockPurchaseCode(): Promise<string> {
  const db = await getDb();
  if (!db) return `PO-${Date.now()}`;
  
  const year = new Date().getFullYear();
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(stockPurchases);
  const count = Number(result[0]?.count || 0) + 1;
  return `PO-${year}-${String(count).padStart(4, '0')}`;
}

export async function generateStockSaleCode(type: "account" | "cash"): Promise<string> {
  const db = await getDb();
  if (!db) return `${type === 'cash' ? 'POS' : 'SO'}-${Date.now()}`;
  
  const year = new Date().getFullYear();
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(stockSales);
  const count = Number(result[0]?.count || 0) + 1;
  const prefix = type === 'cash' ? 'POS' : 'SO';
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
}

export async function generateProductSku(categoryId?: number): Promise<string> {
  const db = await getDb();
  if (!db) return `SKU-${Date.now()}`;
  
  let prefix = 'PRD';
  if (categoryId) {
    const category = await getStockCategoryById(categoryId);
    if (category?.slug) {
      prefix = category.slug.substring(0, 3).toUpperCase();
    }
  }
  
  // Find the highest SKU number with this prefix to avoid duplicates
  const result = await db.select({ sku: stockProducts.sku })
    .from(stockProducts)
    .where(sql`${stockProducts.sku} LIKE ${prefix + '-%'}`)
    .orderBy(desc(stockProducts.sku))
    .limit(1);
  
  let nextNum = 1;
  if (result.length > 0 && result[0].sku) {
    const match = result[0].sku.match(/-(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  
  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

// Best selling products
export async function getBestSellingProducts(limit = 10): Promise<{ productId: number; productName: string; totalSold: number; totalRevenue: number }[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    productId: stockSaleItems.productId,
    productName: stockSaleItems.productName,
    totalSold: sql<number>`SUM(${stockSaleItems.quantity})`,
    totalRevenue: sql<number>`SUM(${stockSaleItems.totalPrice})`,
  }).from(stockSaleItems)
    .groupBy(stockSaleItems.productId, stockSaleItems.productName)
    .orderBy(desc(sql`SUM(${stockSaleItems.quantity})`))
    .limit(limit);
  
  return result.map(r => ({
    productId: r.productId,
    productName: r.productName || '',
    totalSold: Number(r.totalSold),
    totalRevenue: Number(r.totalRevenue),
  }));
}



// ============ ADVANCED DATA MANAGEMENT ============

// Get detailed data counts with additional stats
export async function getDetailedDataCounts(): Promise<{
  customers: { total: number; active: number; withPackages: number };
  packages: { total: number; delivered: number; inTransit: number; pending: number };
  batches: { total: number; active: number; completed: number };
  invoices: { total: number; paid: number; unpaid: number };
  payments: { total: number; totalAmount: number };
  expenses: { total: number; totalAmount: number };
  ledgerTransactions: { total: number; debits: number; credits: number };
  fullPackages: { total: number; delivered: number; pending: number };
  suppliers: { total: number; active: number };
  scans: { total: number; today: number };
  users: { total: number; staff: number; customers: number };
  databaseSize: string;
}> {
  const db = await getDb();
  if (!db) return {
    customers: { total: 0, active: 0, withPackages: 0 },
    packages: { total: 0, delivered: 0, inTransit: 0, pending: 0 },
    batches: { total: 0, active: 0, completed: 0 },
    invoices: { total: 0, paid: 0, unpaid: 0 },
    payments: { total: 0, totalAmount: 0 },
    expenses: { total: 0, totalAmount: 0 },
    ledgerTransactions: { total: 0, debits: 0, credits: 0 },
    fullPackages: { total: 0, delivered: 0, pending: 0 },
    suppliers: { total: 0, active: 0 },
    scans: { total: 0, today: 0 },
    users: { total: 0, staff: 0, customers: 0 },
    databaseSize: '0 MB'
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    customersTotal, customersActive, customersWithPkgs,
    packagesTotal, packagesDelivered, packagesInTransit, packagesPending,
    batchesTotal, batchesActive, batchesCompleted,
    invoicesTotal, invoicesPaid, invoicesUnpaid,
    paymentsTotal, paymentsSum,
    expensesTotal, expensesSum,
    ledgerTotal, ledgerCharges, ledgerPayments,
    fullPkgTotal, fullPkgDelivered, fullPkgPending,
    suppliersTotal, suppliersActive,
    scansTotal, scansToday,
    usersTotal, usersStaff, usersCustomers
  ] = await Promise.all([
    // Customers
    db.select({ count: count() }).from(customers),
    db.select({ count: count() }).from(customers).where(eq(customers.isActive, true)),
    db.select({ count: sql<number>`COUNT(DISTINCT ${customers.id})` }).from(customers)
      .innerJoin(packages, eq(packages.customerId, customers.id)),
    // Packages
    db.select({ count: count() }).from(packages),
    db.select({ count: count() }).from(packages).where(eq(packages.status, 'delivered')),
    db.select({ count: count() }).from(packages).where(eq(packages.status, 'in_transit')),
    db.select({ count: count() }).from(packages).where(eq(packages.status, 'registered')),
    // Batches
    db.select({ count: count() }).from(batches),
    db.select({ count: count() }).from(batches).where(eq(batches.status, 'preparing')),
    db.select({ count: count() }).from(batches).where(eq(batches.status, 'delivered')),
    // Invoices
    db.select({ count: count() }).from(invoices),
    db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'paid')),
    db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'issued')),
    // Payments
    db.select({ count: count() }).from(paymentRecords),
    db.select({ sum: sql<number>`COALESCE(SUM(${paymentRecords.amountUsd} - ${paymentRecords.reversedAmountUsd}), 0)` }).from(paymentRecords),
    // Expenses
    db.select({ count: count() }).from(expenses),
    db.select({ sum: sql<number>`COALESCE(SUM(amount), 0)` }).from(expenses),
    // Ledger - using unified ledgerTransactions
    db.select({ count: count() }).from(ledgerTransactions),
    db.select({ count: count() }).from(ledgerTransactions).where(sql`${ledgerTransactions.transactionType} LIKE 'DEBIT_%'`),
    db.select({ count: count() }).from(ledgerTransactions).where(sql`${ledgerTransactions.transactionType} LIKE 'CREDIT_%'`),
    // Full Packages
    db.select({ count: count() }).from(fullPackageOrders),
    db.select({ count: count() }).from(fullPackageOrders).where(eq(fullPackageOrders.status, 'delivered')),
    db.select({ count: count() }).from(fullPackageOrders).where(eq(fullPackageOrders.status, 'pending')),
    // Suppliers
    db.select({ count: count() }).from(suppliers),
    db.select({ count: count() }).from(suppliers).where(eq(suppliers.isActive, true)),
    // Scans
    db.select({ count: count() }).from(packageScans),
    db.select({ count: count() }).from(packageScans).where(gte(packageScans.scannedAt, today)),
    // Users
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(sql`${users.role} IN ('admin', 'employee', 'accountant')`),
    db.select({ count: count() }).from(customers)
  ]);

  return {
    customers: {
      total: customersTotal[0]?.count || 0,
      active: customersActive[0]?.count || 0,
      withPackages: customersWithPkgs[0]?.count || 0
    },
    packages: {
      total: packagesTotal[0]?.count || 0,
      delivered: packagesDelivered[0]?.count || 0,
      inTransit: packagesInTransit[0]?.count || 0,
      pending: packagesPending[0]?.count || 0
    },
    batches: {
      total: batchesTotal[0]?.count || 0,
      active: batchesActive[0]?.count || 0,
      completed: batchesCompleted[0]?.count || 0
    },
    invoices: {
      total: invoicesTotal[0]?.count || 0,
      paid: invoicesPaid[0]?.count || 0,
      unpaid: invoicesUnpaid[0]?.count || 0
    },
    payments: {
      total: paymentsTotal[0]?.count || 0,
      totalAmount: Number(paymentsSum[0]?.sum) || 0
    },
    expenses: {
      total: expensesTotal[0]?.count || 0,
      totalAmount: Number(expensesSum[0]?.sum) || 0
    },
    ledgerTransactions: {
      total: ledgerTotal[0]?.count || 0,
      debits: ledgerCharges[0]?.count || 0,
      credits: ledgerPayments[0]?.count || 0
    },
    fullPackages: {
      total: fullPkgTotal[0]?.count || 0,
      delivered: fullPkgDelivered[0]?.count || 0,
      pending: fullPkgPending[0]?.count || 0
    },
    suppliers: {
      total: suppliersTotal[0]?.count || 0,
      active: suppliersActive[0]?.count || 0
    },
    scans: {
      total: scansTotal[0]?.count || 0,
      today: scansToday[0]?.count || 0
    },
    users: {
      total: usersTotal[0]?.count || 0,
      staff: usersStaff[0]?.count || 0,
      customers: usersCustomers[0]?.count || 0
    },
    databaseSize: 'Calculating...'
  };
}

// Delete old data (older than X days)
export async function deleteOldData(daysOld: number, dataType: string): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    let deletedCount = 0;
    
    switch (dataType) {
      case 'packages':
        const pkgResult = await db.delete(packages).where(
          and(
            lt(packages.createdAt, cutoffDate),
            eq(packages.status, 'delivered')
          )
        );
        deletedCount = (pkgResult[0] as { affectedRows?: number }).affectedRows || 0;
        break;
      case 'scans':
        const scanResult = await db.delete(packageScans).where(lt(packageScans.scannedAt, cutoffDate));
        deletedCount = (scanResult[0] as { affectedRows?: number }).affectedRows || 0;
        break;
      case 'ledger':
        const ledgerResult = await db.delete(ledgerTransactions).where(lt(ledgerTransactions.createdAt, cutoffDate));
        deletedCount = (ledgerResult[0] as { affectedRows?: number }).affectedRows || 0;
        break;
      case 'invoices':
        const invResult = await db.delete(invoices).where(
          and(
            lt(invoices.createdAt, cutoffDate),
            eq(invoices.status, 'paid')
          )
        );
        deletedCount = (invResult[0] as { affectedRows?: number }).affectedRows || 0;
        break;
      default:
        return { success: false, deletedCount: 0 };
    }

    return { success: true, deletedCount };
  } catch (error) {
    appLogger.error('Error deleting old data', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

// Delete all scans
export async function deleteAllScans(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(packageScans);
    return { success: true, deletedCount: (result[0] as { affectedRows?: number }).affectedRows || 0 };
  } catch (error) {
    appLogger.error('Error deleting scans', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

// Delete all status history
export async function deleteAllStatusHistory(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(packageStatusHistory);
    return { success: true, deletedCount: (result[0] as { affectedRows?: number }).affectedRows || 0 };
  } catch (error) {
    appLogger.error('Error deleting status history', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

// Delete all audit logs
export async function deleteAllAuditLogs(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(auditLogs);
    return { success: true, deletedCount: (result[0] as { affectedRows?: number }).affectedRows || 0 };
  } catch (error) {
    appLogger.error('Error deleting audit logs', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

// Delete all blog posts
export async function deleteAllBlogPosts(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(blogPosts);
    return { success: true, deletedCount: (result[0] as { affectedRows?: number }).affectedRows || 0 };
  } catch (error) {
    appLogger.error('Error deleting blog posts', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

// Get deletion preview (what will be deleted)
export async function getDeletionPreview(dataType: string, daysOld?: number): Promise<{
  count: number;
  sampleItems: Record<string, unknown>[];
  estimatedSize: string;
}> {
  const db = await getDb();
  if (!db) return { count: 0, sampleItems: [], estimatedSize: '0 KB' };

  try {
    let totalCount = 0;
    let sampleItems: Record<string, unknown>[] = [];

    const cutoffDate = daysOld ? new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000) : null;

    switch (dataType) {
      case 'customers':
        const custCount = await db.select({ cnt: count() }).from(customers);
        const custSamples = await db.select({ id: customers.id, name: customers.fullName, code: customers.customerCode })
          .from(customers).limit(5);
        totalCount = custCount[0]?.cnt || 0;
        sampleItems = custSamples;
        break;
      case 'packages':
        if (cutoffDate) {
          const pkgCount = await db.select({ cnt: count() }).from(packages)
            .where(and(lt(packages.createdAt, cutoffDate), eq(packages.status, 'delivered')));
          totalCount = pkgCount[0]?.cnt || 0;
        } else {
          const pkgCount = await db.select({ cnt: count() }).from(packages);
          totalCount = pkgCount[0]?.cnt || 0;
        }
        const pkgSamples = await db.select({ id: packages.id, tracking: packages.trackingNumber, status: packages.status })
          .from(packages).limit(5);
        sampleItems = pkgSamples;
        break;
      case 'scans':
        const scanCount = await db.select({ cnt: count() }).from(packageScans);
        totalCount = scanCount[0]?.cnt || 0;
        break;
      case 'invoices':
        const invCount = await db.select({ cnt: count() }).from(invoices);
        totalCount = invCount[0]?.cnt || 0;
        break;
      default:
        break;
    }

    return {
      count: totalCount,
      sampleItems,
      estimatedSize: `${Math.round(totalCount * 0.5)} KB` // Rough estimate
    };
  } catch (error) {
    appLogger.error('Error getting deletion preview', { error: error instanceof Error ? error.message : String(error) });
    return { count: 0, sampleItems: [], estimatedSize: '0 KB' };
  }
}



// ============ DELETION LOGS ============

// Create a deletion log entry
export async function createDeletionLog(data: {
  category: string;
  deletionType: 'single_category' | 'old_data' | 'test_data' | 'factory_reset';
  recordCount: number;
  details?: Record<string, unknown>;
  backupCreated?: boolean;
  backupFileUrl?: string;
  backupFileName?: string;
  deletedById: number;
  deletedByName?: string;
  ipAddress?: string;
  reason?: string;
}): Promise<{ success: boolean; id?: number }> {
  const db = await getDb();
  if (!db) return { success: false };

  try {
    const result = await db.insert(deletionLogs).values({
      category: data.category,
      deletionType: data.deletionType,
      recordCount: data.recordCount,
      details: data.details || null,
      backupCreated: data.backupCreated || false,
      backupFileUrl: data.backupFileUrl || null,
      backupFileName: data.backupFileName || null,
      deletedById: data.deletedById,
      deletedByName: data.deletedByName || null,
      ipAddress: data.ipAddress || null,
      reason: data.reason || null,
    });
    return { success: true, id: (result[0] as { insertId?: number }).insertId };
  } catch (error) {
    appLogger.error('Error creating deletion log', { error: error instanceof Error ? error.message : String(error) });
    return { success: false };
  }
}

// Get deletion logs with pagination and filters
export async function getDeletionLogs(options?: {
  category?: string;
  deletionType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: DeletionLog[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  try {
    const conditions: SQL[] = [];
    
    if (options?.category) {
      conditions.push(eq(deletionLogs.category, options.category as never));
    }
    if (options?.deletionType) {
      conditions.push(eq(deletionLogs.deletionType, options.deletionType as never));
    }
    if (options?.startDate) {
      conditions.push(gte(deletionLogs.deletedAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(deletionLogs.deletedAt, options.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db.select()
        .from(deletionLogs)
        .where(whereClause)
        .orderBy(desc(deletionLogs.deletedAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0),
      db.select({ cnt: count() })
        .from(deletionLogs)
        .where(whereClause)
    ]);

    return {
      logs,
      total: countResult[0]?.cnt || 0
    };
  } catch (error) {
    appLogger.error('Error getting deletion logs', { error: error instanceof Error ? error.message : String(error) });
    return { logs: [], total: 0 };
  }
}


// ============ DATA EXPORT ============

// Export data for a specific category
export async function exportCategoryData(category: string): Promise<{
  success: boolean;
  data: Record<string, unknown>[];
  count: number;
}> {
  const db = await getDb();
  if (!db) return { success: false, data: [], count: 0 };

  try {
    let data: Record<string, unknown>[] = [];

    switch (category) {
      case 'customers':
        data = await db.select().from(customers);
        break;
      case 'packages':
        data = await db.select().from(packages);
        break;
      case 'batches':
        data = await db.select().from(batches);
        break;
      case 'invoices':
        data = await db.select().from(invoices);
        break;
      case 'payments':
        data = await db.select().from(paymentRecords);
        break;
      case 'expenses':
        data = await db.select().from(expenses);
        break;
      case 'ledgerTransactions':
        data = await db.select().from(ledgerTransactions);
        break;
      case 'fullPackageOrders':
        data = await db.select().from(fullPackageOrders);
        break;
      case 'suppliers':
        data = await db.select().from(suppliers);
        break;
      case 'scans':
        data = await db.select().from(packageScans);
        break;
      case 'statusHistory':
        data = await db.select().from(packageStatusHistory);
        break;
      case 'auditLogs':
        data = await db.select().from(auditLogs);
        break;
      case 'blogPosts':
        data = await db.select().from(blogPosts);
        break;
      case 'customerAccounts':
        data = await db.select().from(customerAccounts);
        break;
      default:
        return { success: false, data: [], count: 0 };
    }

    return { success: true, data, count: data.length };
  } catch (error) {
    appLogger.error('Error exporting category data', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, data: [], count: 0 };
  }
}

// Export all data (for full backup) - COMPLETE DATABASE BACKUP
export async function exportAllData(): Promise<{
  success: boolean;
  data: Record<string, unknown[]>;
  totalRecords: number;
  tableCount: number;
}> {
  const db = await getDb();
  if (!db) return { success: false, data: {}, totalRecords: 0, tableCount: 0 };
  const database = db;

  // Helper function to safely query a table (returns empty array if table doesn't exist)
  // TODO: type this properly — Drizzle .from() accepts table refs; return type is table row[]
  async function safeSelect(table: Parameters<ReturnType<typeof database.select>['from']>[0], tableName: string): Promise<Record<string, unknown>[]> {
    try {
      return (await database.select().from(table)) as Record<string, unknown>[];
    } catch (error: unknown) {
      const err = error as { cause?: { code?: string }; message?: string; code?: string };
      const msg = err?.message ?? String(error);
      const code = err?.cause?.code ?? err?.code;
      // Skip tables that don't exist (MySQL: ER_NO_SUCH_TABLE, SQLite: SQLITE_ERROR + "no such table")
      const isTableMissing =
        code === 'ER_NO_SUCH_TABLE' ||
        (code === 'SQLITE_ERROR' && /no such table/i.test(msg)) ||
        /doesn't exist|no such table/i.test(msg);
      if (isTableMissing) {
        appLogger.info(`[Backup] Table ${tableName} doesn't exist, skipping...`);
        return [];
      }
      throw error;
    }
  }

  try {
    appLogger.info('[Backup] Starting complete database export...');
    
    // Export ALL tables in parallel batches to avoid overwhelming the database
    // Batch 1: Core business data
    const [usersData, customersData, packagesData, batchesData, invoicesData] = await Promise.all([
      safeSelect(users, 'users'),
      safeSelect(customers, 'customers'),
      safeSelect(packages, 'packages'),
      safeSelect(batches, 'batches'),
      safeSelect(invoices, 'invoices'),
    ]);
    appLogger.info('[Backup] Batch 1 complete: users, customers, packages, batches, invoices');

    // Batch 2: Financial data
    const [paymentsData, expensesData, ledgerData, accountsData, creditAdjustmentsData] = await Promise.all([
      safeSelect(paymentRecords, 'paymentRecords'),
      safeSelect(expenses, 'expenses'),
      safeSelect(ledgerTransactions, 'ledgerTransactions'),
      safeSelect(customerAccounts, 'customerAccounts'),
      safeSelect(creditAdjustments, 'creditAdjustments'),
    ]);
    appLogger.info('[Backup] Batch 2 complete: payments, expenses, ledger, accounts, creditAdjustments');

    // Batch 3: Full package and suppliers
    const [fullPackageData, suppliersData, fpStatusHistoryData] = await Promise.all([
      safeSelect(fullPackageOrders, 'fullPackageOrders'),
      safeSelect(suppliers, 'suppliers'),
      safeSelect(fullPackageStatusHistory, 'fullPackageStatusHistory'),
    ]);
    appLogger.info('[Backup] Batch 3 complete: fullPackageOrders, suppliers, fpStatusHistory');

    // Batch 4: Package tracking data
    const [scansData, statusHistoryData, scanHistoryData, scanDevicesData, qrCodesData] = await Promise.all([
      safeSelect(packageScans, 'packageScans'),
      safeSelect(packageStatusHistory, 'packageStatusHistory'),
      safeSelect(scanHistory, 'scanHistory'),
      safeSelect(scanDevices, 'scanDevices'),
      safeSelect(packageQrCodes, 'packageQrCodes'),
    ]);
    appLogger.info('[Backup] Batch 4 complete: scans, statusHistory, scanHistory, scanDevices, qrCodes');

    // Batch 5: Configuration and settings
    const [countriesData, warehousesData, pricingRulesData, exchangeRatesData, systemSettingsData] = await Promise.all([
      safeSelect(countries, 'countries'),
      safeSelect(warehouses, 'warehouses'),
      safeSelect(pricingRules, 'pricingRules'),
      safeSelect(exchangeRates, 'exchangeRates'),
      safeSelect(systemSettings, 'systemSettings'),
    ]);
    appLogger.info('[Backup] Batch 5 complete: countries, warehouses, pricingRules, exchangeRates, systemSettings');

    // Batch 6: Customer related
    const [customerCodePrefixesData, customerAddressesData, customerMessagesData, customerNotifPrefsData, vipCustomersData] = await Promise.all([
      safeSelect(customerCodePrefixes, 'customerCodePrefixes'),
      safeSelect(customerAddresses, 'customerAddresses'),
      safeSelect(customerMessages, 'customerMessages'),
      safeSelect(customerNotificationPrefs, 'customerNotificationPrefs'),
      safeSelect(vipCustomers, 'vipCustomers'),
    ]);
    appLogger.info('[Backup] Batch 6 complete: customerCodePrefixes, addresses, messages, notifPrefs, vipCustomers');

    // Batch 7: Batch pricing
    const [batchPricingTiersData, batchCustomerPricingData] = await Promise.all([
      safeSelect(batchPricingTiers, 'batchPricingTiers'),
      safeSelect(batchCustomerPricing, 'batchCustomerPricing'),
    ]);
    appLogger.info('[Backup] Batch 7 complete: batchPricingTiers, batchCustomerPricing');

    // Batch 8: Services
    const [serviceTypesData, extraServicesData, packageClaimRequestsData] = await Promise.all([
      safeSelect(serviceTypes, 'serviceTypes'),
      safeSelect(extraServices, 'extraServices'),
      safeSelect(packageClaimRequests, 'packageClaimRequests'),
    ]);
    appLogger.info('[Backup] Batch 8 complete: serviceTypes, extraServices, packageClaimRequests');

    // Batch 9: Stock management
    const [stockCategoriesData, stockProductsData, stockPurchasesData, stockPurchaseItemsData] = await Promise.all([
      safeSelect(stockCategories, 'stockCategories'),
      safeSelect(stockProducts, 'stockProducts'),
      safeSelect(stockPurchases, 'stockPurchases'),
      safeSelect(stockPurchaseItems, 'stockPurchaseItems'),
    ]);
    appLogger.info('[Backup] Batch 9 complete: stockCategories, stockProducts, stockPurchases, stockPurchaseItems');

    // Batch 10: Stock sales and movements
    const [stockSalesData, stockSaleItemsData, stockMovementsData] = await Promise.all([
      safeSelect(stockSales, 'stockSales'),
      safeSelect(stockSaleItems, 'stockSaleItems'),
      safeSelect(stockMovements, 'stockMovements'),
    ]);
    appLogger.info('[Backup] Batch 10 complete: stockSales, stockSaleItems, stockMovements');

    // Batch 11: Company financial management
    const [expenseCategoriesData, partnersData, partnerTransactionsData, companyDebtsData, debtPaymentsData] = await Promise.all([
      safeSelect(expenseCategories, 'expenseCategories'),
      safeSelect(partners, 'partners'),
      safeSelect(partnerTransactions, 'partnerTransactions'),
      safeSelect(companyDebts, 'companyDebts'),
      safeSelect(debtPayments, 'debtPayments'),
    ]);
    appLogger.info('[Backup] Batch 11 complete: expenseCategories, partners, partnerTransactions, companyDebts, debtPayments');

    // Batch 12: Cash and finance
    const [cashAccountsData, cashTransactionsData, financialPeriodsData, revenueRecordsData, dailyFinancialSummaryData] = await Promise.all([
      safeSelect(cashAccounts, 'cashAccounts'),
      safeSelect(cashTransactions, 'cashTransactions'),
      safeSelect(financialPeriods, 'financialPeriods'),
      safeSelect(revenueRecords, 'revenueRecords'),
      safeSelect(dailyFinancialSummary, 'dailyFinancialSummary'),
    ]);
    appLogger.info('[Backup] Batch 12 complete: cashAccounts, cashTransactions, financialPeriods, revenueRecords, dailyFinancialSummary');

    // Batch 13: Notifications and templates
    const [notificationLogsData, notificationSettingsData, notificationTemplatesData, customerNotificationsData] = await Promise.all([
      safeSelect(notificationLogs, 'notificationLogs'),
      safeSelect(notificationSettings, 'notificationSettings'),
      safeSelect(notificationTemplates, 'notificationTemplates'),
      safeSelect(customerNotifications, 'customerNotifications'),
    ]);
    appLogger.info('[Backup] Batch 13 complete: notificationLogs, notificationSettings, notificationTemplates, customerNotifications');

    // Batch 14: Templates
    const [labelTemplatesData, invoiceTemplatesData, emailTemplatesData] = await Promise.all([
      safeSelect(labelTemplates, 'labelTemplates'),
      safeSelect(invoiceTemplates, 'invoiceTemplates'),
      safeSelect(emailTemplates, 'emailTemplates'),
    ]);
    appLogger.info('[Backup] Batch 14 complete: labelTemplates, invoiceTemplates, emailTemplates');

    // Batch 15: System and audit
    const [auditData, permissionsData, subPermissionsData, scheduledTasksLogData, paymentRemindersData] = await Promise.all([
      safeSelect(auditLogs, 'auditLogs'),
      safeSelect(permissions, 'permissions'),
      safeSelect(subPermissions, 'subPermissions'),
      safeSelect(scheduledTasksLog, 'scheduledTasksLog'),
      safeSelect(paymentReminders, 'paymentReminders'),
    ]);
    appLogger.info('[Backup] Batch 15 complete: auditLogs, permissions, subPermissions, scheduledTasksLog, paymentReminders');

    // Batch 16: Other tables
    const [currenciesData, taxRatesData, ipWhitelistData, productCategoriesData] = await Promise.all([
      safeSelect(currencies, 'currencies'),
      safeSelect(taxRates, 'taxRates'),
      safeSelect(ipWhitelist, 'ipWhitelist'),
      safeSelect(productCategories, 'productCategories'),
    ]);
    appLogger.info('[Backup] Batch 16 complete: currencies, taxRates, ipWhitelist, productCategories');

    // Batch 17: Blog and activity
    const [blogData, deletionLogsData, activityAlertsData] = await Promise.all([
      safeSelect(blogPosts, 'blogPosts'),
      safeSelect(deletionLogs, 'deletionLogs'),
      safeSelect(activityAlerts, 'activityAlerts'),
    ]);
    appLogger.info('[Backup] Batch 17 complete: blogPosts, deletionLogs, activityAlerts');

    // Batch 18: Support chat
    const [supportChatsData, chatMessagesData] = await Promise.all([
      safeSelect(supportChats, 'supportChats'),
      safeSelect(chatMessages, 'chatMessages'),
    ]);
    appLogger.info('[Backup] Batch 18 complete: supportChats, chatMessages');

    // Compile all data into a single object
    const data = {
      // Core business
      users: usersData,
      customers: customersData,
      packages: packagesData,
      batches: batchesData,
      invoices: invoicesData,
      
      // Financial
      paymentRecords: paymentsData,
      expenses: expensesData,
      ledgerTransactions: ledgerData,
      customerAccounts: accountsData,
      creditAdjustments: creditAdjustmentsData,
      
      // Full package
      fullPackageOrders: fullPackageData,
      suppliers: suppliersData,
      fullPackageStatusHistory: fpStatusHistoryData,
      
      // Package tracking
      packageScans: scansData,
      packageStatusHistory: statusHistoryData,
      scanHistory: scanHistoryData,
      scanDevices: scanDevicesData,
      packageQrCodes: qrCodesData,
      
      // Configuration
      countries: countriesData,
      warehouses: warehousesData,
      pricingRules: pricingRulesData,
      exchangeRates: exchangeRatesData,
      systemSettings: systemSettingsData,
      
      // Customer related
      customerCodePrefixes: customerCodePrefixesData,
      customerAddresses: customerAddressesData,
      customerMessages: customerMessagesData,
      customerNotificationPrefs: customerNotifPrefsData,
      vipCustomers: vipCustomersData,
      
      // Batch pricing
      batchPricingTiers: batchPricingTiersData,
      batchCustomerPricing: batchCustomerPricingData,
      
      // Services
      serviceTypes: serviceTypesData,
      extraServices: extraServicesData,
      packageClaimRequests: packageClaimRequestsData,
      
      // Stock management
      stockCategories: stockCategoriesData,
      stockProducts: stockProductsData,
      stockPurchases: stockPurchasesData,
      stockPurchaseItems: stockPurchaseItemsData,
      stockSales: stockSalesData,
      stockSaleItems: stockSaleItemsData,
      stockMovements: stockMovementsData,
      
      // Company financial
      expenseCategories: expenseCategoriesData,
      partners: partnersData,
      partnerTransactions: partnerTransactionsData,
      companyDebts: companyDebtsData,
      debtPayments: debtPaymentsData,
      
      // Cash and finance
      cashAccounts: cashAccountsData,
      cashTransactions: cashTransactionsData,
      financialPeriods: financialPeriodsData,
      revenueRecords: revenueRecordsData,
      dailyFinancialSummary: dailyFinancialSummaryData,
      
      // Notifications
      notificationLogs: notificationLogsData,
      notificationSettings: notificationSettingsData,
      notificationTemplates: notificationTemplatesData,
      customerNotifications: customerNotificationsData,
      
      // Templates
      labelTemplates: labelTemplatesData,
      invoiceTemplates: invoiceTemplatesData,
      emailTemplates: emailTemplatesData,
      
      // System and audit
      auditLogs: auditData,
      permissions: permissionsData,
      subPermissions: subPermissionsData,
      scheduledTasksLog: scheduledTasksLogData,
      paymentReminders: paymentRemindersData,
      
      // Other
      currencies: currenciesData,
      taxRates: taxRatesData,
      ipWhitelist: ipWhitelistData,
      productCategories: productCategoriesData,
      
      // Blog and activity
      blogPosts: blogData,
      deletionLogs: deletionLogsData,
      activityAlerts: activityAlertsData,
      
      // Support
      supportChats: supportChatsData,
      chatMessages: chatMessagesData,
    };

    const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    const tableCount = Object.keys(data).length;

    appLogger.info(`[Backup] Complete! Exported ${tableCount} tables with ${totalRecords} total records`);

    return { success: true, data, totalRecords, tableCount };
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    appLogger.error('[Backup] Error exporting all data', { error: error instanceof Error ? error.message : String(error) });
    appLogger.error('[Backup] Error message', { message: err?.message });
    appLogger.error('[Backup] Error stack', { stack: err?.stack });
    return { success: false, data: {}, totalRecords: 0, tableCount: 0 };
  }
}



// ============ DATA IMPORT FUNCTIONS ============

// Import category data
export async function importCategoryData(
  category: string,
  data: Record<string, unknown>[],
  overwrite?: boolean
): Promise<{
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { success: false, importedCount: 0, skippedCount: 0, errors: ['Database not available'] };

  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  // Map category names to table objects
  // TODO: type this properly — table refs for db.insert
  const tableMap: Record<string, unknown> = {
    users,
    customers,
    packages,
    batches,
    invoices,
    paymentRecords,
    payments: paymentRecords, // alias
    expenses,
    ledgerTransactions,
    fullPackageOrders,
    suppliers,
    blogPosts,
    countries,
    warehouses,
    pricingRules,
    exchangeRates,
    systemSettings,
    customerCodePrefixes,
    customerAccounts,
    customerAddresses,
    customerMessages,
    customerNotificationPrefs,
    vipCustomers,
    customerNotifications,
    batchPricingTiers,
    batchCustomerPricing,
    packageScans,
    packageStatusHistory,
    scanHistory,
    scanDevices,
    packageQrCodes,
    fullPackageStatusHistory,
    creditAdjustments,
    paymentReminders,
    serviceTypes,
    extraServices,
    packageClaimRequests,
    stockCategories,
    stockProducts,
    stockPurchases,
    stockPurchaseItems,
    stockSales,
    stockSaleItems,
    stockMovements,
    expenseCategories,
    partners,
    partnerTransactions,
    companyDebts,
    debtPayments,
    cashAccounts,
    cashTransactions,
    financialPeriods,
    revenueRecords,
    dailyFinancialSummary,
    notificationLogs,
    notificationSettings,
    notificationTemplates,
    labelTemplates,
    invoiceTemplates,
    emailTemplates,
    auditLogs,
    permissions,
    subPermissions,
    scheduledTasksLog,
    currencies,
    taxRates,
    ipWhitelist,
    productCategories,
    deletionLogs,
    activityAlerts,
    supportChats,
    chatMessages,
  };

  try {
    // If overwrite, delete existing data first
    const table = tableMap[category];
    if (overwrite && table) {
      try {
        await db.delete(table as Parameters<typeof db.delete>[0]);
        appLogger.info(`[Import] Cleared table: ${category}`);
      } catch (deleteError) {
        appLogger.warn(`[Import] Could not clear table ${category}`, { error: deleteError instanceof Error ? deleteError.message : String(deleteError) });
      }
    }

    // Import data based on category
    for (const record of data) {
      try {
        // Remove id field if present (let database generate new ones unless overwrite)
        const cleanRecord: Record<string, unknown> = { ...record };
        if (!overwrite) {
          delete cleanRecord.id;
        }

        // Convert date strings back to Date objects
        for (const key of Object.keys(cleanRecord)) {
          const val = cleanRecord[key];
          if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
            cleanRecord[key] = new Date(val);
          }
        }

        switch (category) {
          case 'customers': {
            // Map CSV fields to customer table fields
            const customerData: Record<string, unknown> = {};
            
            // Name field mapping
            customerData.fullName = cleanRecord.name || cleanRecord.Name || cleanRecord.fullName || cleanRecord.full_name || 'Unknown';
            
            // Phone field mapping - clean phone number
            let phone = String(cleanRecord.phone ?? cleanRecord.Phone ?? cleanRecord['Phone 1'] ?? cleanRecord.phone1 ?? cleanRecord.mobileNumber ?? '');
            phone = phone.replace(/\s+/g, '').replace(/^0+/, ''); // Remove spaces and leading zeros
            if (!phone.startsWith('7') && phone.length > 0) {
              phone = '7' + phone.replace(/^\d*7/, '7'); // Ensure starts with 7 for Iraqi numbers
            }
            customerData.mobileNumber = phone || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            // Secondary phone
            let phone2 = String(cleanRecord.phone2 ?? cleanRecord['Phone 2'] ?? cleanRecord.secondaryMobile ?? '');
            if (phone2) {
              phone2 = phone2.replace(/\s+/g, '').replace(/^0+/, '');
            }
            
            // Customer code - use existing or generate new
            const existingCode = cleanRecord.code || cleanRecord.Code || cleanRecord.customerCode || '';
            if (existingCode) {
              customerData.customerCode = existingCode.toString().trim();
            } else {
              // Generate a unique code
              const randomSuffix = Math.random().toString(36).substr(2, 5).toUpperCase();
              customerData.customerCode = `IMP-${randomSuffix}`;
            }
            
            // Sequence number - generate unique one
            const maxSeqResult = await db.select({ maxSeq: sql`MAX(sequenceNumber)` }).from(customers);
            const maxSeq = maxSeqResult[0]?.maxSeq || 0;
            customerData.sequenceNumber = (maxSeq as number) + importedCount + 1;
            
            // Email
            customerData.email = cleanRecord.email || cleanRecord.Email || null;
            
            // Address
            customerData.address = cleanRecord.address || cleanRecord.Address || null;
            
            // City - extract from address if not provided
            customerData.city = cleanRecord.city || cleanRecord.City || null;
            
            // Notes
            customerData.notes = cleanRecord.notes || cleanRecord.Notes || cleanRecord.note || null;
            
            // Default password (user should change it)
            customerData.passwordHash = '$2b$10$defaultPasswordHashForImportedCustomers123';
            
            // Created by (use admin id 1 as default)
            customerData.createdById = 1;
            
            // Check if customer with same phone already exists
            const existingCustomer = await db.select().from(customers).where(eq(customers.mobileNumber, customerData.mobileNumber as string)).limit(1);
            if (existingCustomer.length > 0) {
              skippedCount++;
              errors.push(`Customer with phone ${customerData.mobileNumber} already exists`);
              continue;
            }
            
            // Check if customer code already exists
            const existingCodeCustomer = await db.select().from(customers).where(eq(customers.customerCode, customerData.customerCode as string)).limit(1);
            if (existingCodeCustomer.length > 0) {
              // Generate new unique code
              const randomSuffix = Math.random().toString(36).substr(2, 8).toUpperCase();
              customerData.customerCode = `IMP-${randomSuffix}`;
            }
            
            await db.insert(customers).values(customerData as InsertCustomer);
            break;
          }
          default: {
            // Use tableMap for all other tables
            const targetTable = tableMap[category];
            if (targetTable) {
              await db.insert(targetTable as Parameters<typeof db.insert>[0]).values(cleanRecord as Record<string, unknown>);
            } else {
              appLogger.warn(`[Import] Unknown category: ${category}`);
              skippedCount++;
              continue;
            }
            break;
          }
        }
        importedCount++;
      } catch (recordError: unknown) {
        errors.push(`Record error: ${recordError instanceof Error ? recordError.message : String(recordError)}`);
        skippedCount++;
      }
    }

    return { success: true, importedCount, skippedCount, errors };
  } catch (error: unknown) {
    appLogger.error('Error importing category data', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, importedCount, skippedCount, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

// Import all data (full restore) - COMPLETE DATABASE RESTORE
export async function importAllData(
  data: Record<string, Record<string, unknown>[]>,
  overwrite?: boolean
): Promise<{
  success: boolean;
  totalImported: number;
  totalSkipped: number;
  categoryResults: Record<string, { imported: number; skipped: number; errors: string[] }>;
}> {
  const categoryResults: Record<string, { imported: number; skipped: number; errors: string[] }> = {};
  let totalImported = 0;
  let totalSkipped = 0;

  appLogger.info('[Restore] Starting complete database restore...');
  appLogger.info('[Restore] Tables to restore', { count: Object.keys(data).length });

  // Import order matters due to foreign key constraints
  // Order: Independent tables first, then dependent tables
  const importOrder = [
    // Level 1: No dependencies
    'users',
    'countries',
    'currencies',
    'taxRates',
    'systemSettings',
    'permissions',
    'subPermissions',
    'customerCodePrefixes',
    'expenseCategories',
    'serviceTypes',
    'stockCategories',
    'productCategories',
    'notificationTemplates',
    'labelTemplates',
    'invoiceTemplates',
    'emailTemplates',
    
    // Level 2: Depends on countries
    'warehouses',
    'pricingRules',
    'exchangeRates',
    
    // Level 3: Core business entities
    'customers',
    'suppliers',
    'partners',
    'scanDevices',
    
    // Level 4: Depends on customers
    'customerAccounts',
    'customerAddresses',
    'customerMessages',
    'customerNotificationPrefs',
    'vipCustomers',
    'customerNotifications',
    'supportChats',
    
    // Level 5: Depends on customers and warehouses
    'batches',
    'fullPackageOrders',
    
    // Level 6: Depends on batches
    'batchPricingTiers',
    'batchCustomerPricing',
    'packages',
    
    // Level 7: Depends on packages
    'packageScans',
    'packageStatusHistory',
    'packageQrCodes',
    'extraServices',
    'packageClaimRequests',
    
    // Level 8: Depends on fullPackageOrders
    'fullPackageStatusHistory',
    
    // Level 9: Financial - depends on customers
    'ledgerTransactions',
    'paymentRecords',
    'creditAdjustments',
    'paymentReminders',
    'invoices',
    
    // Level 10: Company financial
    'expenses',
    'companyDebts',
    'debtPayments',
    'partnerTransactions',
    'cashAccounts',
    'cashTransactions',
    'financialPeriods',
    'revenueRecords',
    'dailyFinancialSummary',
    
    // Level 11: Stock management
    'stockProducts',
    'stockPurchases',
    'stockPurchaseItems',
    'stockSales',
    'stockSaleItems',
    'stockMovements',
    
    // Level 12: Logs and history
    'auditLogs',
    'notificationLogs',
    'notificationSettings',
    'scheduledTasksLog',
    'scanHistory',
    'deletionLogs',
    'activityAlerts',
    
    // Level 13: Other
    'blogPosts',
    'chatMessages',
    'ipWhitelist',
  ];

  // Also import any tables not in the predefined order
  const allTables = new Set(Object.keys(data));
  const orderedTables = new Set(importOrder);
  const remainingTables = Array.from(allTables).filter(t => !orderedTables.has(t));
  
  const finalImportOrder = [...importOrder, ...remainingTables];

  for (const category of finalImportOrder) {
    if (data[category] && data[category].length > 0) {
      appLogger.info(`[Restore] Importing ${category}: ${data[category].length} records...`);
      try {
        const result = await importCategoryData(category, data[category], overwrite);
        categoryResults[category] = {
          imported: result.importedCount,
          skipped: result.skippedCount,
          errors: result.errors
        };
        totalImported += result.importedCount;
        totalSkipped += result.skippedCount;
        appLogger.info(`[Restore] ${category}: imported ${result.importedCount}, skipped ${result.skippedCount}`);
      } catch (error) {
        appLogger.error(`[Restore] Error importing ${category}`, { error: error instanceof Error ? error.message : String(error) });
        categoryResults[category] = {
          imported: 0,
          skipped: data[category].length,
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
    }
  }

  appLogger.info(`[Restore] Complete! Total imported: ${totalImported}, skipped: ${totalSkipped}`);

  return {
    success: totalImported > 0,
    totalImported,
    totalSkipped,
    categoryResults
  };
}



// ============ ACTIVITY ALERTS ============

// Important actions that trigger alerts
const ALERT_TRIGGERS: Record<string, { severity: 'info' | 'warning' | 'critical'; titleKu: string }> = {
  // Critical actions
  'delete_customer': { severity: 'critical', titleKu: 'سڕینەوەی کڕیار' },
  'delete_package': { severity: 'critical', titleKu: 'سڕینەوەی پاکەت' },
  'delete_batch': { severity: 'critical', titleKu: 'سڕینەوەی باچ' },
  'delete_full_package_order': { severity: 'critical', titleKu: 'سڕینەوەی پاکێجی تەواو' },
  'adjust_balance': { severity: 'critical', titleKu: 'ڕێکخستنی بالانس' },
  'reset_balance': { severity: 'critical', titleKu: 'ڕیسێتی بالانس' },
  
  // Warning actions
  'update_customer_status': { severity: 'warning', titleKu: 'گۆڕینی بارودۆخی کڕیار' },
  'charge_customer': { severity: 'warning', titleKu: 'چارج کردنی کڕیار' },
  'deliver_batch': { severity: 'warning', titleKu: 'گەیاندنی باچ' },
  'update_pricing': { severity: 'warning', titleKu: 'گۆڕینی نرخ' },
  'update_settings': { severity: 'warning', titleKu: 'گۆڕینی ڕێکخستنەکان' },
  
  // Info actions
  'create_customer': { severity: 'info', titleKu: 'دروستکردنی کڕیار' },
  'create_package': { severity: 'info', titleKu: 'تۆمارکردنی پاکەت' },
  'create_batch': { severity: 'info', titleKu: 'دروستکردنی باچ' },
  'create_full_package_order': { severity: 'info', titleKu: 'دروستکردنی پاکێجی تەواو' },
  'add_payment': { severity: 'info', titleKu: 'زیادکردنی پارەدان' },
};

export async function createActivityAlert(data: {
  action: string;
  category: string;
  entityType?: string;
  entityId?: number;
  entityCode?: string;
  auditLogId?: number;
  triggeredById?: number;
  triggeredByName?: string;
  customTitle?: string;
  customMessage?: string;
  /** Overrides the ALERT_TRIGGERS severity — lets one action be routine most
   *  of the time but raise its voice when it moved money. */
  severity?: 'info' | 'warning' | 'critical';
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const trigger = ALERT_TRIGGERS[data.action];
  if (!trigger && !data.customTitle) return; // Only create alerts for important actions

  const title = data.customTitle || trigger?.titleKu || data.action;
  const severity = data.severity || trigger?.severity || 'info';
  
  const message = data.customMessage || 
    `${data.triggeredByName || 'بەکارهێنەر'} چالاکی "${title}" ئەنجامدا${data.entityCode ? ` بۆ ${data.entityCode}` : ''}`;
  
  try {
    await db.insert(activityAlerts).values({
      title,
      message,
      category: data.category as string,
      severity,
      entityType: data.entityType as string,
      entityId: data.entityId,
      entityCode: data.entityCode as string | null,
      auditLogId: data.auditLogId ?? null,
      action: data.action as string | null,
      triggeredById: data.triggeredById,
      triggeredByName: data.triggeredByName as string | null,
    } as InsertActivityAlert);
  } catch (error) {
    appLogger.error('Error creating activity alert', { error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getActivityAlerts(options: {
  category?: string;
  severity?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: ActivityAlert[]; total: number; unreadCount: number }> {
  const db = await getDb();
  if (!db) return { alerts: [], total: 0, unreadCount: 0 };
  
  const conditions: SQL[] = [];
  if (options.category) conditions.push(eq(activityAlerts.category, options.category as never));
  if (options.severity) conditions.push(eq(activityAlerts.severity, options.severity as never));
  if (options.isRead !== undefined) conditions.push(eq(activityAlerts.isRead, options.isRead));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [alerts, countResult, unreadResult] = await Promise.all([
    db.select()
      .from(activityAlerts)
      .where(whereClause)
      .orderBy(desc(activityAlerts.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(activityAlerts)
      .where(whereClause),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(activityAlerts)
      .where(eq(activityAlerts.isRead, false)),
  ]);
  
  return {
    alerts,
    total: Number(countResult[0]?.count || 0),
    unreadCount: Number(unreadResult[0]?.count || 0),
  };
}

export async function markAlertAsRead(alertId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(activityAlerts)
    .set({ isRead: true, readAt: new Date(), readById: userId })
    .where(eq(activityAlerts.id, alertId));
}

export async function markAllAlertsAsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(activityAlerts)
    .set({ isRead: true, readAt: new Date(), readById: userId })
    .where(eq(activityAlerts.isRead, false));
}

export async function getAlertStats(): Promise<{
  total: number;
  unread: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0, bySeverity: {}, byCategory: {} };
  
  const [totalResult, unreadResult, severityResult, categoryResult] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(activityAlerts),
    db.select({ count: sql<number>`COUNT(*)` }).from(activityAlerts).where(eq(activityAlerts.isRead, false)),
    db.select({ severity: activityAlerts.severity, count: sql<number>`COUNT(*)` })
      .from(activityAlerts)
      .groupBy(activityAlerts.severity),
    db.select({ category: activityAlerts.category, count: sql<number>`COUNT(*)` })
      .from(activityAlerts)
      .groupBy(activityAlerts.category),
  ]);
  
  return {
    total: Number(totalResult[0]?.count || 0),
    unread: Number(unreadResult[0]?.count || 0),
    bySeverity: Object.fromEntries(severityResult.map(r => [r.severity, Number(r.count)])),
    byCategory: Object.fromEntries(categoryResult.map(r => [r.category, Number(r.count)])),
  };
}



// ============ SUPPORT CHAT OPERATIONS ============

export async function createSupportChat(data: {
  customerId: number;
  customerName?: string;
  customerCode?: string;
  subject?: string;
  category?: 'order_status' | 'pricing' | 'payment' | 'general' | 'complaint' | 'other';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(supportChats).values({
    customerId: data.customerId,
    customerName: data.customerName,
    customerCode: data.customerCode,
    subject: data.subject,
    category: data.category || 'general',
    priority: data.priority || 'normal',
    status: 'open',
    lastMessageAt: new Date(),
  });
  
  return result[0].insertId;
}

export async function getSupportChats(options: {
  customerId?: number;
  status?: 'open' | 'pending' | 'resolved' | 'closed';
  assignedToId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ chats: SupportChat[]; total: number }> {
  const db = await getDb();
  if (!db) return { chats: [], total: 0 };
  
  const conditions: SQL[] = [];
  if (options.customerId) conditions.push(eq(supportChats.customerId, options.customerId));
  if (options.status) conditions.push(eq(supportChats.status, options.status));
  if (options.assignedToId) conditions.push(eq(supportChats.assignedToId, options.assignedToId));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [chats, countResult] = await Promise.all([
    db.select()
      .from(supportChats)
      .where(whereClause)
      .orderBy(desc(supportChats.lastMessageAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(supportChats)
      .where(whereClause),
  ]);
  
  return {
    chats,
    total: Number(countResult[0]?.count || 0),
  };
}

export async function getSupportChatById(chatId: number): Promise<SupportChat | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(supportChats)
    .where(eq(supportChats.id, chatId))
    .limit(1);
  
  return result[0] || null;
}

export async function updateSupportChat(chatId: number, data: {
  status?: 'open' | 'pending' | 'resolved' | 'closed';
  assignedToId?: number;
  assignedToName?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Record<string, unknown> = { ...data };
  if (data.status === 'resolved') updateData.resolvedAt = new Date();
  if (data.status === 'closed') updateData.closedAt = new Date();
  
  await db.update(supportChats)
    .set(updateData)
    .where(eq(supportChats.id, chatId));
}

export async function getOrCreateCustomerChat(customerId: number, customerName?: string, customerCode?: string): Promise<SupportChat | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Check for existing open chat
  const existingChat = await db.select()
    .from(supportChats)
    .where(and(
      eq(supportChats.customerId, customerId),
      eq(supportChats.status, 'open')
    ))
    .orderBy(desc(supportChats.createdAt))
    .limit(1);
  
  if (existingChat.length > 0) {
    return existingChat[0];
  }
  
  // Create new chat
  const chatId = await createSupportChat({
    customerId,
    customerName,
    customerCode,
    category: 'general',
  });
  
  if (!chatId) return null;
  
  return getSupportChatById(chatId);
}


// ============ CHAT MESSAGE OPERATIONS ============

export async function createChatMessage(data: {
  chatId: number;
  senderType: 'customer' | 'staff' | 'system' | 'bot';
  senderId?: number;
  senderName?: string;
  content: string;
  // Mirrors the messageType column, which gained 'voice' when voice notes
  // shipped. Leaving it out here made every voice note a type error at the
  // call site and silently invited an 'as any' instead.
  messageType?: 'text' | 'image' | 'file' | 'system' | 'voice';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(chatMessages).values({
    chatId: data.chatId,
    senderType: data.senderType,
    senderId: data.senderId,
    senderName: data.senderName,
    content: data.content,
    messageType: data.messageType || 'text',
    attachmentUrl: data.attachmentUrl,
    attachmentName: data.attachmentName,
    attachmentType: data.attachmentType,
    metadata: data.metadata,
  });
  
  // Update chat's last message time and message count
  await db.update(supportChats)
    .set({
      lastMessageAt: new Date(),
      totalMessages: sql`${supportChats.totalMessages} + 1`,
      ...(data.senderType === 'customer' 
        ? { unreadByStaff: sql`${supportChats.unreadByStaff} + 1` }
        : { unreadByCustomer: sql`${supportChats.unreadByCustomer} + 1` }
      ),
    })
    .where(eq(supportChats.id, data.chatId));
  
  return result[0].insertId;
}

export async function getChatMessages(chatId: number, options?: {
  limit?: number;
  offset?: number;
  beforeId?: number;
}): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [eq(chatMessages.chatId, chatId)];
  if (options?.beforeId) conditions.push(sql`${chatMessages.id} < ${options.beforeId}`);
  
  const messages = await db.select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
  
  return messages.reverse(); // Return in chronological order
}

export async function markMessagesAsRead(chatId: number, senderType: 'customer' | 'staff'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Mark messages as read
  await db.update(chatMessages)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(chatMessages.chatId, chatId),
      eq(chatMessages.isRead, false),
      senderType === 'customer' 
        ? sql`${chatMessages.senderType} != 'customer'`
        : eq(chatMessages.senderType, 'customer')
    ));
  
  // Reset unread count
  await db.update(supportChats)
    .set(senderType === 'customer' 
      ? { unreadByCustomer: 0 }
      : { unreadByStaff: 0 }
    )
    .where(eq(supportChats.id, chatId));
}

export async function getUnreadChatCount(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`SUM(${supportChats.unreadByCustomer})` })
    .from(supportChats)
    .where(eq(supportChats.customerId, customerId));
  
  return Number(result[0]?.count || 0);
}

export async function getStaffUnreadChatCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`SUM(${supportChats.unreadByStaff})` })
    .from(supportChats)
    .where(eq(supportChats.status, 'open'));
  
  return Number(result[0]?.count || 0);
}



// ============ PRE-RESET BACKUP FUNCTIONS ============

export async function createPreResetBackup(data: {
  filename: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  recordsCount: number;
  createdById: number;
  createdByName: string;
}): Promise<{ success: boolean; id?: number }> {
  const db = await getDb();
  if (!db) return { success: false };

  try {
    const result = await db.insert(backups).values({
      filename: data.filename,
      fileKey: data.fileKey,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      backupType: 'manual',
      backupContent: 'database_only',
      status: 'completed',
      recordsCount: data.recordsCount,
      createdById: data.createdById,
      createdByName: data.createdByName,
      completedAt: new Date(),
    });
    return { success: true, id: result[0].insertId };
  } catch (error) {
    appLogger.error('Error creating pre-reset backup', { error: error instanceof Error ? error.message : String(error) });
    return { success: false };
  }
}

// Get reset history from deletion logs
export async function getResetHistory(options?: {
  limit?: number;
  offset?: number;
}): Promise<{
  resets: DeletionLog[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { resets: [], total: 0 };

  try {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [resets, countResult] = await Promise.all([
      db.select()
        .from(deletionLogs)
        .where(eq(deletionLogs.deletionType, 'factory_reset'))
        .orderBy(desc(deletionLogs.deletedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(deletionLogs)
        .where(eq(deletionLogs.deletionType, 'factory_reset'))
    ]);

    return {
      resets,
      total: countResult[0]?.count || 0
    };
  } catch (error) {
    appLogger.error('Error getting reset history', { error: error instanceof Error ? error.message : String(error) });
    return { resets: [], total: 0 };
  }
}

// ============ DATA MANAGEMENT / RESET FUNCTIONS ============

export async function deleteAllCustomers(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    await db.delete(ledgerTransactions);
    await db.delete(customerAccounts);
    await db.delete(paymentRecords);
    const result = await db.delete(customers);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting customers', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllPackages(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(packages);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting packages', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllBatches(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    await db.update(packages).set({ batchId: null });
    const result = await db.delete(batches);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting batches', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllInvoices(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(invoices);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting invoices', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllPayments(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(paymentRecords);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting payments', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllExpenses(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(expenses);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting expenses', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllLedgerTransactions(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(ledgerTransactions);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting ledger transactions', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllFullPackages(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(fullPackageOrders);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting full packages', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function deleteAllSuppliers(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };
  try {
    const result = await db.delete(suppliers);
    return { success: true, deletedCount: (result as { rowsAffected?: number }).rowsAffected || 0 };
  } catch (error) {
    appLogger.error('Error deleting suppliers', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, deletedCount: 0 };
  }
}

export async function resetAllData(): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: 'Database connection failed' };
  const safeDelete = async (table: Parameters<typeof db.delete>[0]) => {
    try {
      await db.delete(table);
    } catch (error: unknown) {
      const e = error as { sqlMessage?: string; message?: string; cause?: { message?: string; sqlMessage?: string } };
      const errorMsg = e?.sqlMessage || e?.message || e?.cause?.message || e?.cause?.sqlMessage || '';
      if (errorMsg.includes("doesn't exist") || JSON.stringify(error).includes("doesn't exist")) return;
      appLogger.error('Error deleting table', { error: errorMsg });
      throw error;
    }
  };
  try {
    await safeDelete(chatMessages);
    await safeDelete(supportChats);
    await safeDelete(customerNotifications);
    await safeDelete(customerMessages);
    await safeDelete(customerAddresses);
    await safeDelete(packageClaimRequests);
    await safeDelete(extraServices);
    await safeDelete(scanHistory);
    await safeDelete(packageScans);
    await safeDelete(packageStatusHistory);
    await safeDelete(packageQrCodes);
    await safeDelete(fullPackageStatusHistory);
    await safeDelete(stockSaleItems);
    await safeDelete(stockSales);
    await safeDelete(stockPurchaseItems);
    await safeDelete(stockPurchases);
    await safeDelete(stockMovements);
    await safeDelete(stockProducts);
    await safeDelete(stockCategories);
    await safeDelete(debtPayments);
    await safeDelete(companyDebts);
    await safeDelete(partnerTransactions);
    await safeDelete(partners);
    await safeDelete(cashTransactions);
    await safeDelete(cashAccounts);
    await safeDelete(paymentReminders);
    await safeDelete(creditAdjustments);
    await safeDelete(paymentRecords);
    await safeDelete(ledgerTransactions);
    await safeDelete(customerAccounts);
    await safeDelete(batchCustomerPricing);
    await safeDelete(batchPricingTiers);
    await safeDelete(vipCustomers);
    await safeDelete(customerNotificationPrefs);
    await safeDelete(invoices);
    await safeDelete(revenueRecords);
    await safeDelete(expenses);
    await safeDelete(dailyFinancialSummary);
    await safeDelete(packages);
    await safeDelete(batches);
    await safeDelete(fullPackageOrders);
    await safeDelete(customers);
    await safeDelete(suppliers);
    await safeDelete(paymentRecords);
    await safeDelete(backups);
    await safeDelete(deletionLogs);
    await safeDelete(auditLogs);
    await safeDelete(notificationLogs);
    await safeDelete(scheduledTasksLog);
    await safeDelete(permissions);
    await safeDelete(subPermissions);
    return { success: true, message: 'All data has been deleted successfully' };
  } catch (error) {
    appLogger.error('Error resetting all data', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: 'Error occurred while deleting data' };
  }
}

export async function getDataCounts(): Promise<{
  customers: number;
  packages: number;
  batches: number;
  invoices: number;
  payments: number;
  expenses: number;
  ledgerTransactions: number;
  fullPackages: number;
  suppliers: number;
}> {
  const db = await getDb();
  if (!db) return {
    customers: 0, packages: 0, batches: 0, invoices: 0,
    payments: 0, expenses: 0, ledgerTransactions: 0, fullPackages: 0, suppliers: 0
  };
  const [
    customersCount, packagesCount, batchesCount, invoicesCount,
    paymentsCount, expensesCount, ledgerCount, fullPkgCount, suppliersCount
  ] = await Promise.all([
    db.select({ count: count() }).from(customers),
    db.select({ count: count() }).from(packages),
    db.select({ count: count() }).from(batches),
    db.select({ count: count() }).from(invoices),
    db.select({ count: count() }).from(paymentRecords),
    db.select({ count: count() }).from(expenses),
    db.select({ count: count() }).from(ledgerTransactions),
    db.select({ count: count() }).from(fullPackageOrders),
    db.select({ count: count() }).from(suppliers)
  ]);
  return {
    customers: customersCount[0]?.count || 0,
    packages: packagesCount[0]?.count || 0,
    batches: batchesCount[0]?.count || 0,
    invoices: invoicesCount[0]?.count || 0,
    payments: paymentsCount[0]?.count || 0,
    expenses: expensesCount[0]?.count || 0,
    ledgerTransactions: ledgerCount[0]?.count || 0,
    fullPackages: fullPkgCount[0]?.count || 0,
    suppliers: suppliersCount[0]?.count || 0
  };
}

// ============ PERMISSIONS MANAGEMENT ============

export async function getUserPermissions(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  return await database.select().from(permissions).where(eq(permissions.userId, userId));
}

export async function getUserSubPermissions(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  return await database.select().from(subPermissions).where(eq(subPermissions.userId, userId));
}

export async function checkUserPermission(
  userId: number,
  module: string,
  action: "view" | "create" | "edit" | "delete"
): Promise<boolean> {
  const user = await getUserById(userId);
  if (user?.role === "super_admin") return true;
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  const perm = await database.select().from(permissions)
    .where(and(eq(permissions.userId, userId), eq(permissions.module, module)))
    .limit(1);
  if (perm.length === 0) return false;
  const permission = perm[0];
  switch (action) {
    case "view": return permission.canView;
    case "create": return permission.canCreate;
    case "edit": return permission.canEdit;
    case "delete": return permission.canDelete;
    default: return false;
  }
}

export async function checkUserSubPermission(
  userId: number,
  module: string,
  permissionKey: string
): Promise<boolean> {
  const user = await getUserById(userId);
  if (user?.role === "super_admin") return true;
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  const subPerm = await database.select().from(subPermissions)
    .where(and(
      eq(subPermissions.userId, userId),
      eq(subPermissions.module, module),
      eq(subPermissions.permissionKey, permissionKey)
    ))
    .limit(1);
  return subPerm.length > 0 && subPerm[0].isAllowed;
}

export async function setUserPermission(input: {
  userId: number;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  const existing = await database.select().from(permissions)
    .where(and(eq(permissions.userId, input.userId), eq(permissions.module, input.module)))
    .limit(1);
  if (existing.length > 0) {
    await database.update(permissions).set({
      canView: input.canView, canCreate: input.canCreate, canEdit: input.canEdit, canDelete: input.canDelete,
      updatedAt: new Date(),
    }).where(eq(permissions.id, existing[0].id));
    return (await database.select().from(permissions).where(eq(permissions.id, existing[0].id)).limit(1))[0];
  } else {
    await database.insert(permissions).values({
      userId: input.userId, module: input.module,
      canView: input.canView, canCreate: input.canCreate, canEdit: input.canEdit, canDelete: input.canDelete,
    });
    const inserted = await database.select().from(permissions)
      .where(and(eq(permissions.userId, input.userId), eq(permissions.module, input.module)))
      .limit(1);
    return inserted[0];
  }
}

export async function setUserSubPermission(input: {
  userId: number;
  module: string;
  permissionKey: string;
  isAllowed: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  const existing = await database.select().from(subPermissions)
    .where(and(
      eq(subPermissions.userId, input.userId),
      eq(subPermissions.module, input.module),
      eq(subPermissions.permissionKey, input.permissionKey)
    ))
    .limit(1);
  if (existing.length > 0) {
    await database.update(subPermissions).set({ isAllowed: input.isAllowed, updatedAt: new Date() }).where(eq(subPermissions.id, existing[0].id));
    return (await database.select().from(subPermissions).where(eq(subPermissions.id, existing[0].id)).limit(1))[0];
  } else {
    await database.insert(subPermissions).values({
      userId: input.userId, module: input.module, permissionKey: input.permissionKey, isAllowed: input.isAllowed,
    });
    const inserted = await database.select().from(subPermissions)
      .where(and(
        eq(subPermissions.userId, input.userId),
        eq(subPermissions.module, input.module),
        eq(subPermissions.permissionKey, input.permissionKey)
      ))
      .limit(1);
    return inserted[0];
  }
}

export async function bulkUpdateUserPermissions(input: {
  userId: number;
  permissions: Array<{ module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
  subPermissions: Array<{ module: string; permissionKey: string; isAllowed: boolean }>;
}) {
  for (const perm of input.permissions) {
    await setUserPermission({ userId: input.userId, ...perm });
  }
  for (const subPerm of input.subPermissions) {
    await setUserSubPermission({ userId: input.userId, ...subPerm });
  }
  return { success: true };
}

export async function deleteUserPermissions(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  await database.delete(permissions).where(eq(permissions.userId, userId));
  await database.delete(subPermissions).where(eq(subPermissions.userId, userId));
  return { success: true };
}

// ============ DELETE STAFF USER ============
export async function deleteStaffUser(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  try {
    await deleteUserPermissions(userId);
  } catch (e) {
    // Permissions may not exist, that's ok
  }
  
  await database.delete(users).where(eq(users.id, userId));
  return { success: true };
}


/**
 * Where a member of staff works.
 *
 * Read once when they create something, and the answer is copied onto that
 * record. Never read again for a record that already carries a stamp — if
 * somebody moves office, last year's shipments must still say where they
 * were actually handled.
 */
export async function getUserWorkLocation(
  userId: number
): Promise<{ countryId: number | null; city: string | null }> {
  const db = await getDb();
  if (!db) return { countryId: null, city: null };
  const [row] = await db
    .select({ countryId: users.workCountryId, city: users.workCity })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { countryId: row?.countryId ?? null, city: row?.city ?? null };
}

/** Set or change where a member of staff works, from now on. */
export async function setUserWorkLocation(
  userId: number,
  location: { countryId: number | null; city: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ workCountryId: location.countryId, workCity: location.city })
    .where(eq(users.id, userId));
}
