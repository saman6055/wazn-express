import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { generatePackageInvoice, generatePaymentReceipt } from './invoiceGenerator';
import { storagePut } from './storage';
import { 
  InsertUser, users, 
  customers, InsertCustomer, Customer,
  customerCodePrefixes, InsertCustomerCodePrefix, CustomerCodePrefix,
  countries, InsertCountry, Country,
  warehouses, InsertWarehouse, Warehouse,
  pricingRules, InsertPricingRule, PricingRule,
  batches, InsertBatch, Batch,
  packages, InsertPackage, Package,
  // ledgerEntries removed - using unified ledgerTransactions
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
  // Company Financial Management
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
  // Stock Management
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
  // Finance Integration
  revenueRecords, InsertRevenueRecord, RevenueRecord,
  dailyFinancialSummary, InsertDailyFinancialSummary, DailyFinancialSummary,
  // Blog
  blogPosts, InsertBlogPost, BlogPost,
  // Deletion Logs
  deletionLogs, InsertDeletionLog, DeletionLog,
  // Purchase Requests
  // purchaseRequests removed
  // Activity Alerts
  activityAlerts, InsertActivityAlert, ActivityAlert,
  // Support Chat
  supportChats, InsertSupportChat, SupportChat,
  chatMessages, InsertChatMessage, ChatMessage,
  // Backups
  backups, InsertBackup, Backup,
  // Expense Alerts
  expenseAlerts, InsertExpenseAlert, ExpenseAlert,
  expenseAlertLogs, InsertExpenseAlertLog, ExpenseAlertLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER OPERATIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
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
    console.error("[Database] Failed to upsert user:", error);
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
    console.warn("[Database] Cannot get user: database not available");
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
  const db = await getDb();
  if (!db) return undefined;
  // Use raw SQL query to avoid Drizzle ORM quoting issues with MySQL
  const result = await db.execute(
    sql`SELECT id, openId, username, name, email, loginMethod, role, mobileNumber, passwordHash, isActive, notes, createdById, createdAt, updatedAt, lastSignedIn FROM users WHERE username = ${usernameOrEmail} OR email = ${usernameOrEmail} OR name = ${usernameOrEmail} LIMIT 1`
  );
  // MySQL2 returns [rows, fields], we need rows
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return rows.length > 0 ? rows[0] as typeof users.$inferSelect : undefined;
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
      console.log(`[Customer] Created account ${accountNumber} for customer ${data.customerCode}`);
    } catch (err) {
      console.error(`[Customer] Failed to create account for ${data.customerCode}:`, err);
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(users).values({
    openId: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    username: data.username || null,
    name: data.name,
    email: data.email || null,
    mobileNumber: data.mobileNumber || null,
    passwordHash: data.passwordHash,
    role: data.role,
    loginMethod: "username",
    isActive: true,
  });
  
  const insertId = result[0].insertId;
  const newUser = await db.select().from(users).where(eq(users.id, insertId)).limit(1);
  return newUser[0];
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

// ============ COUNTRY OPERATIONS ============

export async function createCountry(data: InsertCountry): Promise<Country> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(countries).values(data);
  const inserted = await db.select().from(countries).where(eq(countries.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getAllCountries(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(countries).where(eq(countries.isActive, true)).orderBy(countries.nameEn);
  }
  return db.select().from(countries).orderBy(countries.nameEn);
}

export async function getCountryById(id: number): Promise<Country | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(countries).where(eq(countries.id, id)).limit(1);
  return result[0];
}

export async function updateCountry(id: number, data: Partial<InsertCountry>) {
  const db = await getDb();
  if (!db) return;
  await db.update(countries).set(data).where(eq(countries.id, id));
}

export async function getOriginCountries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(countries).where(and(eq(countries.isActive, true), eq(countries.isOrigin, true)));
}

export async function getDestinationCountries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(countries).where(and(eq(countries.isActive, true), eq(countries.isDestination, true)));
}

// ============ WAREHOUSE OPERATIONS ============

export async function createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(warehouses).values(data);
  const inserted = await db.select().from(warehouses).where(eq(warehouses.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getAllWarehouses(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(warehouses).where(eq(warehouses.isActive, true)).orderBy(warehouses.nameEn);
  }
  return db.select().from(warehouses).orderBy(warehouses.nameEn);
}

export async function getWarehouseById(id: number): Promise<Warehouse | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
  return result[0];
}

export async function getWarehousesByCountry(countryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(warehouses).where(and(eq(warehouses.countryId, countryId), eq(warehouses.isActive, true)));
}

export async function updateWarehouse(id: number, data: Partial<InsertWarehouse>) {
  const db = await getDb();
  if (!db) return;
  await db.update(warehouses).set(data).where(eq(warehouses.id, id));
}

// ============ PRICING OPERATIONS ============

export async function createPricingRule(data: InsertPricingRule): Promise<PricingRule> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pricingRules).values(data);
  const inserted = await db.select().from(pricingRules).where(eq(pricingRules.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getAllPricingRules(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(pricingRules).where(eq(pricingRules.isActive, true)).orderBy(desc(pricingRules.effectiveFrom));
  }
  return db.select().from(pricingRules).orderBy(desc(pricingRules.effectiveFrom));
}

export async function getApplicablePricingRule(
  originCountryId: number,
  destinationCountryId: number,
  shippingType: "air_regular" | "air_irregular" | "sea",
  date: Date = new Date()
): Promise<PricingRule | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(pricingRules).where(
    and(
      eq(pricingRules.originCountryId, originCountryId),
      eq(pricingRules.destinationCountryId, destinationCountryId),
      eq(pricingRules.shippingType, shippingType),
      eq(pricingRules.isActive, true),
      lte(pricingRules.effectiveFrom, date),
      or(isNull(pricingRules.effectiveTo), gte(pricingRules.effectiveTo, date))
    )
  ).orderBy(desc(pricingRules.effectiveFrom)).limit(1);
  
  return result[0];
}

export async function updatePricingRule(id: number, data: Partial<InsertPricingRule>) {
  const db = await getDb();
  if (!db) return;
  await db.update(pricingRules).set(data).where(eq(pricingRules.id, id));
}

// ============ BATCH OPERATIONS ============

export async function createBatch(data: InsertBatch): Promise<Batch> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(batches).values(data);
  const inserted = await db.select().from(batches).where(eq(batches.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
}

export async function getAllBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batches).orderBy(desc(batches.createdAt));
}

export async function getBatchById(id: number): Promise<Batch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
  return result[0];
}

export async function updateBatch(id: number, data: Partial<InsertBatch>) {
  const db = await getDb();
  if (!db) return;
  await db.update(batches).set(data).where(eq(batches.id, id));
}

export async function getActiveBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batches).where(
    or(
      eq(batches.status, "preparing"),
      eq(batches.status, "in_transit"),
      eq(batches.status, "arrived"),
      eq(batches.status, "customs")
    )
  ).orderBy(desc(batches.createdAt));
}

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
  
  const result = await db.insert(packages).values(data);
  const inserted = await db.select().from(packages).where(eq(packages.id, Number(result[0].insertId))).limit(1);
  return inserted[0];
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

export async function getAllPackages(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  shippingType?: string;
  batchId?: number;
  customerId?: number;
  dateFrom?: Date;
  dateTo?: Date;
} = {}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  
  const { page = 1, pageSize = 50, search, status, shippingType, batchId, customerId, dateFrom, dateTo } = options;
  const offset = (page - 1) * pageSize;
  
  // Build where conditions
  const conditions = [];
  
  if (search) {
    conditions.push(
      or(
        like(packages.trackingNumber, `%${search}%`),
        like(packages.packageCode, `%${search}%`)
      )
    );
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
  
  // Get total count
  const countResult = await db.select({ count: count() }).from(packages).where(whereClause);
  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);
  
  // Get paginated data with full package order info
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
    .where(whereClause)
    .orderBy(desc(packages.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  return { data, total, page, pageSize, totalPages };
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

export async function updatePackage(id: number, data: Partial<InsertPackage>) {
  const db = await getDb();
  if (!db) return;
  
  // Get package before update to check tracking number
  const pkg = await getPackageById(id);
  
  await db.update(packages).set(data).where(eq(packages.id, id));
  
  // Sync batchId to fullPackageOrder when package is added to/removed from a batch
  if (data.batchId !== undefined && pkg?.trackingNumber) {
    try {
      const fullPackageOrder = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
      if (fullPackageOrder) {
        await updateFullPackageOrder(fullPackageOrder.id, { batchId: data.batchId });
        console.log(`[FullPackage] Synced batchId ${data.batchId} from package ${pkg.packageCode} to order ${fullPackageOrder.id}`);
      }
    } catch (e) {
      console.error('[FullPackage] Failed to sync batchId to fullPackageOrder:', e);
    }
  }

  // Sync status to fullPackageOrder if status changed and package has tracking number
  if (data.status && pkg?.trackingNumber) {
    try {
      const fullPackageOrder = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
      if (fullPackageOrder) {
        // Map package status to fullPackageOrder status
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
        if (newStatus && newStatus !== fullPackageOrder.status) {
          const updateData: any = { status: newStatus };
          
          // If delivered, update shipping cost and recalculate profit
          if (data.status === 'delivered' && (data.calculatedCostUsd || pkg.calculatedCostUsd)) {
            const shippingCost = parseFloat(data.calculatedCostUsd || pkg.calculatedCostUsd || '0');
            updateData.shippingCostUsd = shippingCost.toFixed(2);
            console.log(`[FullPackage] Updating order ${fullPackageOrder.id} with shipping cost: $${shippingCost}`);
            
            // Notify customer about shipping cost
            try {
              await createCustomerNotification({
                customerId: fullPackageOrder.customerId,
                type: 'package',
                title: 'Package Delivered',
                titleKu: 'پاکەت گەیشت',
                titleAr: 'تم تسليم الطرد',
                message: `Your order ${fullPackageOrder.orderCode} (${fullPackageOrder.productName}) has been delivered. Shipping cost: $${shippingCost}`,
                messageKu: `سفارشەکەت ${fullPackageOrder.orderCode} (${fullPackageOrder.productName}) گەیشت. کۆستی هێنانەوە: $${shippingCost}`,
                messageAr: `تم تسليم طلبك ${fullPackageOrder.orderCode} (${fullPackageOrder.productName}). تكلفة الشحن: $${shippingCost}`,
                relatedType: 'full_package',
                relatedId: fullPackageOrder.id,
              });
              console.log(`[Notification] Sent shipping cost notification to customer ${fullPackageOrder.customerId}`);
            } catch (e) {
              console.error('[Notification] Failed to send shipping cost notification:', e);
            }
          }
          
          await updateFullPackageOrder(fullPackageOrder.id, updateData);
          console.log(`[FullPackage] Synced status from package ${pkg.packageCode} to order ${fullPackageOrder.id}: ${newStatus}`);
        }
      }
    } catch (e) {
      console.error('[FullPackage] Failed to sync status to fullPackageOrder:', e);
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
  const db = await getDb();
  if (!db) return [];
  // Return from unified ledgerTransactions table
  return db.select().from(ledgerTransactions).orderBy(desc(ledgerTransactions.createdAt)).limit(limit);
}

// Get all ledger transactions from unified system
export async function getAllLedgerTransactions(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ledgerTransactions).orderBy(desc(ledgerTransactions.createdAt)).limit(limit);
}

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

// ============ AUDIT LOG OPERATIONS (ADVANCED) ============

// Category mapping for entity types
const entityCategoryMap: Record<string, 'customer' | 'package' | 'batch' | 'full_package' | 'purchase_request' | 'commission' | 'finance' | 'settings' | 'user' | 'system'> = {
  'Customer': 'customer',
  'User': 'user',
  'Package': 'package',
  'Batch': 'batch',
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
  'Country': 'settings',
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
  'create_full_package_order': 'دروستکردنی فول پاکیج',
  'update_full_package_order': 'نوێکردنەوەی فول پاکیج',
  'create_purchase_request': 'دروستکردنی داواکاری کڕین',
  'update_purchase_request': 'نوێکردنەوەی داواکاری کڕین',
  'create_commission_order': 'دروستکردنی کڕین بە عمولە',
  'update_commission_order': 'نوێکردنەوەی کڕین بە عمولە',
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
function getChangedFields(oldValues: Record<string, any> | null, newValues: Record<string, any> | null): string[] {
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
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any>;
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
  
  const conditions: any[] = [];
  
  if (filters.category) {
    conditions.push(eq(auditLogs.category, filters.category as any));
  }
  if (filters.entityType) {
    conditions.push(eq(auditLogs.entityType, filters.entityType));
  }
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
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
    conditions.push(
      or(
        like(auditLogs.entityCode, `%${filters.search}%`),
        like(auditLogs.description, `%${filters.search}%`),
        like(auditLogs.userName, `%${filters.search}%`)
      )
    );
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

// ============ SYSTEM SETTINGS OPERATIONS ============

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
  return result[0]?.settingValue ?? null;
}

export async function setSetting(key: string, value: string, updatedById?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemSettings).values({ settingKey: key, settingValue: value, updatedById })
    .onDuplicateKeyUpdate({ set: { settingValue: value, updatedById } });
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings);
}

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
  return db.select({
    status: packages.status,
    count: sql<number>`COUNT(*)`,
  }).from(packages).groupBy(packages.status);
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
  
  const result = await db.select().from(fullPackageOrders)
    .where(eq(fullPackageOrders.trackingNumber, trackingNumber))
    .limit(1);
  
  return result[0];
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
        // Customer pays ONLY the final selling price
        chargeAmount = parseFloat(data.sellingPriceUsd as string ?? existing.sellingPriceUsd ?? '0');
      } else if (orderType === 'commission') {
        // Commission: Customer pays itemPrice + commissionFee (prepaid)
        const itemPrice = parseFloat(data.itemPriceUsd as string ?? existing.itemPriceUsd ?? '0');
        const commissionFee = parseFloat(data.commissionFeeUsd as string ?? existing.commissionFeeUsd ?? '0');
        chargeAmount = itemPrice + commissionFee;
      }
      
      if (chargeAmount > 0) {
        const chargeType = orderType === 'full_package' ? 'FULL_PACKAGE' :
                          orderType === 'purchase_request' ? 'PURCHASE_REQUEST' :
                          orderType === 'commission' ? 'COMMISSION' : 'SERVICE';
        
        await applyCharge(
          existing.customerId!,
          customer.customerCode,
          chargeType as any,
          existing.id,
          chargeAmount,
          `${orderType === 'full_package' ? 'Full Package' : 
             orderType === 'purchase_request' ? 'Purchase Request' : 
             'Commission'} Order ${existing.orderCode} delivered - Final Price: $${chargeAmount.toFixed(2)}`,
          userId
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
export async function getOrdersPendingTracking() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all orders that should have tracking but don't
  // Exclude cancelled, refunded, returned orders
  const excludedStatuses: ("cancelled" | "refunded" | "returned" | "delivered")[] = ["cancelled", "refunded", "returned", "delivered"];
  
  return db.select().from(fullPackageOrders).where(
    and(
      notInArray(fullPackageOrders.status, excludedStatuses),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      )
    )
  ).orderBy(fullPackageOrders.createdAt);
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

// Get tracking alert statistics
export async function getTrackingAlertStats() {
  const db = await getDb();
  if (!db) return { warning: 0, urgent: 0, critical: 0, total: 0 };
  
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Get all orders without tracking (exclude cancelled, refunded, returned, delivered)
  const excludedStatuses: ("cancelled" | "refunded" | "returned" | "delivered")[] = ["cancelled", "refunded", "returned", "delivered"];
  
  const orders = await db.select().from(fullPackageOrders).where(
    and(
      notInArray(fullPackageOrders.status, excludedStatuses),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      )
    )
  );
  
  let warning = 0, urgent = 0, critical = 0;
  
  for (const order of orders) {
    // Use createdAt if orderDate is not set
    const dateToCheck = order.orderDate || order.createdAt;
    if (!dateToCheck) continue;
    const orderDate = new Date(dateToCheck);
    
    if (orderDate <= sevenDaysAgo) {
      critical++;
    } else if (orderDate <= fiveDaysAgo) {
      urgent++;
    } else if (orderDate <= threeDaysAgo) {
      warning++;
    }
  }
  
  return { warning, urgent, critical, total: orders.length };
}

// Process and update all alert levels
export async function processTrackingAlerts() {
  const db = await getDb();
  if (!db) return { updated: 0 };
  
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Get all orders without tracking
  const orders = await db.select().from(fullPackageOrders).where(
    and(
      eq(fullPackageOrders.status, "ordered"),
      or(
        isNull(fullPackageOrders.trackingNumber),
        eq(fullPackageOrders.trackingNumber, "")
      )
    )
  );
  
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

// ============ QR CODE OPERATIONS ============

export async function createPackageQrCode(data: InsertPackageQrCode): Promise<PackageQrCode> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(packageQrCodes).values(data);
  const inserted = await db.select().from(packageQrCodes).where(eq(packageQrCodes.id, Number(result[0].insertId)));
  return inserted[0];
}

export async function getQrCodeByPackage(packageId: number, packageType: 'regular' | 'full_package' = 'regular') {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packageQrCodes)
    .where(and(eq(packageQrCodes.packageId, packageId), eq(packageQrCodes.packageType, packageType)))
    .limit(1);
  return result[0];
}

export async function getQrCodeByCode(qrCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packageQrCodes).where(eq(packageQrCodes.qrCode, qrCode)).limit(1);
  return result[0];
}

export async function updateQrCodeScan(qrCode: string, scannedById: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(packageQrCodes).set({
    lastScannedAt: new Date(),
    lastScannedById: scannedById,
    scanCount: sql`${packageQrCodes.scanCount} + 1`,
  }).where(eq(packageQrCodes.qrCode, qrCode));
}

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


// ============ BARCODE SCANNING FUNCTIONS ============

// Search package by tracking number
export async function searchPackageByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  // Search by tracking number first
  let results = await db.select().from(packages).where(eq(packages.trackingNumber, trackingNumber)).limit(1);
  if (results[0]) return results[0];
  // If not found, search by package code
  results = await db.select().from(packages).where(eq(packages.packageCode, trackingNumber)).limit(1);
  return results[0] || null;
}

// Get package with customer info by tracking
export async function getPackageWithCustomerByTracking(trackingNumber: string) {
  const db = await getDb();
  const pkg = await searchPackageByTracking(trackingNumber);
  if (!pkg) return null;
  
  const customer = pkg.customerId ? await getCustomerById(pkg.customerId) : null;
  return { package: pkg, customer };
}

// Create package scan
export async function createPackageScan(data: InsertPackageScan) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(packageScans).values(data);
  return { id: Number(result[0].insertId) };
}

// Get scans for package
export async function getPackageScans(packageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageScans).where(eq(packageScans.packageId, packageId)).orderBy(desc(packageScans.scannedAt));
}

// Get scans by tracking number
export async function getScansByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageScans).where(eq(packageScans.trackingNumber, trackingNumber)).orderBy(desc(packageScans.scannedAt));
}

// Get recent scans by user
export async function getRecentScansByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageScans).where(eq(packageScans.scannedById, userId)).orderBy(desc(packageScans.scannedAt)).limit(limit);
}

// Get today's scans by warehouse
export async function getTodayScansByWarehouse(warehouseId: number) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.select().from(packageScans)
    .where(and(
      eq(packageScans.warehouseId, warehouseId),
      gte(packageScans.scannedAt, today)
    ))
    .orderBy(desc(packageScans.scannedAt));
}

// Create status history entry
export async function createStatusHistory(data: InsertPackageStatusHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(packageStatusHistory).values(data);
  return { id: Number(result[0].insertId) };
}

// Get status history for package
export async function getPackageStatusHistory(packageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageStatusHistory).where(eq(packageStatusHistory.packageId, packageId)).orderBy(desc(packageStatusHistory.changedAt));
}

// Register scan device
export async function registerScanDevice(data: InsertScanDevice) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(scanDevices).values(data);
  return { id: Number(result[0].insertId) };
}

// Get scan device by identifier
export async function getScanDeviceByIdentifier(identifier: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(scanDevices).where(eq(scanDevices.deviceIdentifier, identifier)).limit(1);
  return results[0] || null;
}

// Update device last active
export async function updateDeviceLastActive(deviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanDevices).set({ 
    lastActiveAt: new Date(),
    totalScans: sql`${scanDevices.totalScans} + 1`
  }).where(eq(scanDevices.id, deviceId));
}

// Get all active devices
export async function getActiveDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanDevices).where(eq(scanDevices.isActive, true)).orderBy(desc(scanDevices.lastActiveAt));
}

// Get scan statistics for today
export async function getTodayScanStats(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (userId) {
    return db.select({
      scanType: packageScans.scanType,
      count: sql<number>`COUNT(*)`
    }).from(packageScans)
      .where(and(
        gte(packageScans.scannedAt, today),
        eq(packageScans.scannedById, userId)
      ))
      .groupBy(packageScans.scanType);
  }
  
  return db.select({
    scanType: packageScans.scanType,
    count: sql<number>`COUNT(*)`
  }).from(packageScans)
    .where(gte(packageScans.scannedAt, today))
    .groupBy(packageScans.scanType);
}

// Update package status via scan
export async function updatePackageStatusViaScan(
  packageId: number, 
  newStatus: string, 
  userId: number,
  scanId: number,
  metadata?: any
) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  // Get current status
  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error("Package not found");
  
  const oldStatus = pkg.status;
  
  // Update package status
  await db.update(packages).set({ 
    status: newStatus as any,
    updatedAt: new Date()
  }).where(eq(packages.id, packageId));
  
  // Create status history
  await createStatusHistory({
    packageId,
    fromStatus: oldStatus,
    toStatus: newStatus,
    changedById: userId,
    changeMethod: "scan",
    scanId,
    metadata
  });
  
  return { oldStatus, newStatus };
}


// Get today's scans (all or by warehouse)
export async function getTodayScans(warehouseId?: number) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (warehouseId) {
    return db.select().from(packageScans)
      .where(and(
        eq(packageScans.warehouseId, warehouseId),
        gte(packageScans.scannedAt, today)
      ))
      .orderBy(desc(packageScans.scannedAt))
      .limit(200);
  }
  
  return db.select().from(packageScans)
    .where(gte(packageScans.scannedAt, today))
    .orderBy(desc(packageScans.scannedAt))
    .limit(200);
}

// Get packages with missing info
export async function getPackagesMissingInfo() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packages)
    .where(or(
      isNull(packages.weightKg),
      eq(packages.weightKg, ''),
      isNull(packages.lengthCm),
      isNull(packages.widthCm),
      isNull(packages.heightCm)
    ))
    .orderBy(desc(packages.createdAt))
    .limit(100);
}



// ============ CUSTOMER LEDGER SYSTEM ============

// Generate unique account number
export function generateAccountNumber(customerCode: string): string {
  const year = new Date().getFullYear();
  return `ACC-${customerCode}-${year}`;
}

// Generate unique transaction number
export function generateTransactionNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN-${date}-${random}`;
}

// Generate unique payment number
export function generatePaymentNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PAY-${date}-${random}`;
}

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

// Get ledger transactions for account
export async function getAccountLedgerTransactions(accountId: number, limit = 50): Promise<LedgerTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, accountId))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(limit);
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
    total: sql<number>`SUM(${paymentRecords.amountUsd})`
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


// ============ SMART SCANNER FUNCTIONS ============

// Get full package order by tracking number
export async function getFullPackageOrderByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(fullPackageOrders)
    .where(eq(fullPackageOrders.trackingNumber, trackingNumber))
    .limit(1);
  
  return result[0] || null;
}

// Update package fields (for inline editing)
export async function updatePackageFields(packageId: number, data: {
  weightKg?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
  volumeCbm?: string;
  notes?: string;
  batchId?: number | null;
  shippingType?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Filter out undefined values
  const updateData: Record<string, any> = {};
  if (data.weightKg !== undefined) updateData.weightKg = data.weightKg;
  if (data.lengthCm !== undefined) updateData.lengthCm = data.lengthCm;
  if (data.widthCm !== undefined) updateData.widthCm = data.widthCm;
  if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
  if (data.volumeCbm !== undefined) updateData.volumeCbm = data.volumeCbm;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.batchId !== undefined) updateData.batchId = data.batchId;
  if (data.shippingType !== undefined) updateData.shippingType = data.shippingType;
  
  if (Object.keys(updateData).length === 0) {
    return getPackageById(packageId);
  }
  
  await db.update(packages).set(updateData).where(eq(packages.id, packageId));
  
  // Sync batchId to fullPackageOrder if batchId changed
  if (data.batchId !== undefined) {
    try {
      const pkg = await getPackageById(packageId);
      if (pkg?.trackingNumber) {
        const fullPackageOrder = await getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
        if (fullPackageOrder) {
          await updateFullPackageOrder(fullPackageOrder.id, { batchId: data.batchId });
          console.log(`[FullPackage] Synced batchId ${data.batchId} from package fields update to order ${fullPackageOrder.id}`);
        }
      }
    } catch (e) {
      console.error('[FullPackage] Failed to sync batchId from updatePackageFields:', e);
    }
  }
  
  return getPackageById(packageId);
}

// Update package status only
export async function updatePackageStatus(packageId: number, status: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(packages).set({ status: status as any }).where(eq(packages.id, packageId));
  return getPackageById(packageId);
}


// Get ledger transaction by ID
export async function getLedgerTransactionById(transactionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(ledgerTransactions)
    .where(eq(ledgerTransactions.id, transactionId))
    .limit(1);
  
  return result[0] || null;
}

// ============ PRODUCT CATEGORIES (جۆرەکانی کاڵا) ============

export async function getAllProductCategories(): Promise<ProductCategory[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(productCategories)
    .orderBy(productCategories.sortOrder);
}

export async function getActiveProductCategories(): Promise<ProductCategory[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(productCategories)
    .where(eq(productCategories.isActive, true))
    .orderBy(productCategories.sortOrder);
}

export async function getProductCategoryById(id: number): Promise<ProductCategory | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [category] = await db.select()
    .from(productCategories)
    .where(eq(productCategories.id, id));
  return category || null;
}

export async function createProductCategory(data: InsertProductCategory): Promise<ProductCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(productCategories).values(data);
  const insertId = Number(result[0].insertId);
  const [category] = await db.select().from(productCategories).where(eq(productCategories.id, insertId));
  return category;
}

export async function updateProductCategory(id: number, data: Partial<InsertProductCategory>): Promise<ProductCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(productCategories)
    .set(data)
    .where(eq(productCategories.id, id));
  
  // Return updated category
  const [updated] = await db.select().from(productCategories).where(eq(productCategories.id, id));
  return updated;
}

export async function deleteProductCategory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(productCategories).where(eq(productCategories.id, id));
}

// ============ BATCH HELPERS ============

export async function getBatchesByShippingType(shippingType: string): Promise<Batch[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(batches)
    .where(and(
      eq(batches.shippingType, shippingType as any),
      eq(batches.status, 'preparing')
    ))
    .orderBy(desc(batches.createdAt));
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


// ============ BATCH PRICING TIERS ============

export async function getBatchPricingTiers(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId)).orderBy(batchPricingTiers.sortOrder);
}

export async function createBatchPricingTier(data: InsertBatchPricingTier) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(batchPricingTiers).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function updateBatchPricingTier(id: number, data: Partial<InsertBatchPricingTier>) {
  const db = await getDb();
  if (!db) return;
  await db.update(batchPricingTiers).set(data).where(eq(batchPricingTiers.id, id));
}

export async function deleteBatchPricingTier(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.id, id));
}

export async function deleteBatchPricingTiersByBatch(batchId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId));
}

export async function setBatchPricingTiers(batchId: number, tiers: Omit<InsertBatchPricingTier, 'batchId'>[]) {
  const db = await getDb();
  if (!db) return;
  
  // Delete existing tiers
  await db.delete(batchPricingTiers).where(eq(batchPricingTiers.batchId, batchId));
  
  // Insert new tiers
  if (tiers.length > 0) {
    const tiersWithBatchId = tiers.map((tier, index) => ({
      ...tier,
      batchId,
      sortOrder: index
    }));
    await db.insert(batchPricingTiers).values(tiersWithBatchId);
  }
}

// Get the applicable price for a customer based on their total weight/CBM in a batch
export async function getApplicableTierPrice(batchId: number, customerTotalValue: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const tiers = await db.select().from(batchPricingTiers)
    .where(eq(batchPricingTiers.batchId, batchId))
    .orderBy(batchPricingTiers.sortOrder);
  
  if (tiers.length === 0) return null;
  
  // Find the matching tier
  for (const tier of tiers) {
    const minVal = Number(tier.minValue);
    const maxVal = tier.maxValue ? Number(tier.maxValue) : Infinity;
    
    if (customerTotalValue >= minVal && customerTotalValue < maxVal) {
      return Number(tier.pricePerUnit);
    }
  }
  
  // If no tier matches, return the last tier's price (for values above all tiers)
  return Number(tiers[tiers.length - 1].pricePerUnit);
}

// Calculate customer's total weight/CBM in a batch
// For kg unit, uses chargeable weight (max of actual weight and volumetric weight)
export async function getCustomerTotalInBatch(batchId: number, customerId: number, unit: 'kg' | 'cbm'): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const customerPackages = await db.select().from(packages)
    .where(and(
      eq(packages.batchId, batchId),
      eq(packages.customerId, customerId)
    ));
  
  if (unit === 'kg') {
    // Use chargeable weight (max of actual weight and volumetric weight)
    return customerPackages.reduce((sum, pkg) => {
      const actualKg = Number(pkg.weightKg) || 0;
      const lengthCm = Number(pkg.lengthCm) || 0;
      const widthCm = Number(pkg.widthCm) || 0;
      const heightCm = Number(pkg.heightCm) || 0;
      // Volumetric weight = (L × W × H) / 6000 for air shipping
      const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
      // Chargeable weight is the higher of actual weight and volumetric weight
      const chargeableKg = Math.max(actualKg, volumetricKg);
      return sum + chargeableKg;
    }, 0);
  } else {
    return customerPackages.reduce((sum, pkg) => sum + (Number(pkg.volumeCbm) || 0), 0);
  }
}

// ============ BATCH CUSTOMER PRICING FUNCTIONS ============

export async function getBatchCustomerPricing(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
}

export async function getCustomerPricingInBatch(batchId: number, customerId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(batchCustomerPricing)
    .where(and(
      eq(batchCustomerPricing.batchId, batchId),
      eq(batchCustomerPricing.customerId, customerId)
    ))
    .limit(1);
  return result[0] || null;
}

export async function createBatchCustomerPricing(data: InsertBatchCustomerPricing) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(batchCustomerPricing).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function updateBatchCustomerPricing(id: number, data: Partial<InsertBatchCustomerPricing>) {
  const db = await getDb();
  if (!db) return;
  await db.update(batchCustomerPricing).set(data).where(eq(batchCustomerPricing.id, id));
}

export async function deleteBatchCustomerPricing(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.id, id));
}

export async function deleteBatchCustomerPricingByBatch(batchId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
}

export async function setBatchCustomerPricing(batchId: number, customerPricing: Omit<InsertBatchCustomerPricing, 'batchId'>[]) {
  const db = await getDb();
  if (!db) return;
  
  // Delete existing customer pricing for this batch
  await db.delete(batchCustomerPricing).where(eq(batchCustomerPricing.batchId, batchId));
  
  // Insert new customer pricing
  if (customerPricing.length > 0) {
    const pricingWithBatchId = customerPricing.map(pricing => ({
      ...pricing,
      batchId
    }));
    await db.insert(batchCustomerPricing).values(pricingWithBatchId);
  }
}

// Get the applicable price for a customer in a batch (checks customer-specific price first, then default)
export async function getCustomerPriceInBatch(batchId: number, customerId: number, unit: 'kg' | 'cbm'): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // First check for customer-specific pricing
  const customerPricing = await getCustomerPricingInBatch(batchId, customerId);
  if (customerPricing) {
    if (unit === 'kg' && customerPricing.pricePerKg) {
      return Number(customerPricing.pricePerKg);
    } else if (unit === 'cbm' && customerPricing.pricePerCbm) {
      return Number(customerPricing.pricePerCbm);
    }
  }
  
  // Fall back to batch default price
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  
  if (unit === 'kg' && batch.pricePerKg) {
    return Number(batch.pricePerKg);
  } else if (unit === 'cbm' && batch.pricePerCbm) {
    return Number(batch.pricePerCbm);
  }
  
  return null;
}

// Get batch financial summary
export async function getBatchFinancialSummary(batchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const batch = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch[0]) return null;
  
  const batchData = batch[0];
  const batchPackages = await db.select().from(packages).where(eq(packages.batchId, batchId));
  
  // Calculate totals from packages if batch fields are not set
  let packageTotalWeight = 0;
  let packageTotalCbm = 0;
  for (const pkg of batchPackages) {
    packageTotalWeight += Number(pkg.weightKg) || 0;
    packageTotalCbm += Number(pkg.volumeCbm) || 0;
  }
  
  // Calculate chargeable weight for each package (max of actual vs volumetric)
  let totalChargeableWeight = 0;
  for (const pkg of batchPackages) {
    const actualKg = Number(pkg.weightKg) || 0;
    const lengthCm = Number(pkg.lengthCm) || 0;
    const widthCm = Number(pkg.widthCm) || 0;
    const heightCm = Number(pkg.heightCm) || 0;
    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
    const chargeableKg = Math.max(actualKg, volumetricKg);
    totalChargeableWeight += chargeableKg;
  }
  
  // Use batch values if set, otherwise use calculated values from packages
  const actualWeight = Number(batchData.actualWeightKg) || packageTotalWeight;
  const actualCbm = Number(batchData.actualCbm) || packageTotalCbm;
  const chargedWeight = Number(batchData.chargedWeightKg) || totalChargeableWeight;
  const chargedCbm = Number(batchData.chargedCbm) || packageTotalCbm;
  
  // Calculate total cost using chargeable weight (from packages) × cost per KG
  let totalCost = 0;
  if (batchData.shippingType === 'sea') {
    const costPerCbm = Number(batchData.costPerCbm) || 0;
    totalCost = chargedCbm * costPerCbm;
  } else {
    const costPerKg = Number(batchData.costPerKg) || 0;
    // Use totalChargeableWeight (sum of max(actual, volumetric) for each package)
    totalCost = totalChargeableWeight * costPerKg;
  }
  
  // Calculate total revenue from packages
  const totalRevenue = batchPackages.reduce((sum, pkg) => sum + (Number(pkg.calculatedCostUsd) || 0), 0);
  
  // Get per-customer breakdown
  const customerBreakdown: Record<number, { customerId: number; packages: number; weight: number; chargeableWeight: number; cbm: number; revenue: number }> = {};
  
  for (const pkg of batchPackages) {
    if (!pkg.customerId) continue;
    
    if (!customerBreakdown[pkg.customerId]) {
      customerBreakdown[pkg.customerId] = {
        customerId: pkg.customerId,
        packages: 0,
        weight: 0,
        chargeableWeight: 0,
        cbm: 0,
        revenue: 0
      };
    }
    
    // Calculate chargeable weight for this package
    const actualKg = Number(pkg.weightKg) || 0;
    const lengthCm = Number(pkg.lengthCm) || 0;
    const widthCm = Number(pkg.widthCm) || 0;
    const heightCm = Number(pkg.heightCm) || 0;
    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
    const chargeableKg = Math.max(actualKg, volumetricKg);
    
    customerBreakdown[pkg.customerId].packages++;
    customerBreakdown[pkg.customerId].weight += actualKg;
    customerBreakdown[pkg.customerId].chargeableWeight += chargeableKg;
    customerBreakdown[pkg.customerId].cbm += Number(pkg.volumeCbm) || 0;
    customerBreakdown[pkg.customerId].revenue += Number(pkg.calculatedCostUsd) || 0;
  }
  
  return {
    batchId,
    shippingType: batchData.shippingType,
    actualWeight,
    actualCbm,
    chargedWeight,
    chargedCbm,
    totalChargeableWeight, // Sum of max(actual, volumetric) for each package
    costPerKg: Number(batchData.costPerKg) || 0,
    costPerCbm: Number(batchData.costPerCbm) || 0,
    totalCost,
    totalRevenue,
    profit: totalRevenue - totalCost,
    profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0,
    totalPackages: batchPackages.length,
    customerBreakdown: Object.values(customerBreakdown)
  };
}


// ============ NOTIFICATION SETTINGS ============

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notificationSettings);
}

export async function upsertNotificationSetting(data: {
  eventType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  customSubject?: string;
  customBody?: string;
  updatedById: number;
}): Promise<NotificationSetting | null> {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await db.select().from(notificationSettings)
    .where(eq(notificationSettings.eventType, data.eventType))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(notificationSettings)
      .set({
        emailEnabled: data.emailEnabled,
        smsEnabled: data.smsEnabled,
        whatsappEnabled: data.whatsappEnabled,
        customSubject: data.customSubject || null,
        customBody: data.customBody || null,
        updatedById: data.updatedById,
      })
      .where(eq(notificationSettings.eventType, data.eventType));
    
    const updated = await db.select().from(notificationSettings)
      .where(eq(notificationSettings.eventType, data.eventType))
      .limit(1);
    return updated[0] || null;
  } else {
    await db.insert(notificationSettings).values({
      eventType: data.eventType,
      emailEnabled: data.emailEnabled,
      smsEnabled: data.smsEnabled,
      whatsappEnabled: data.whatsappEnabled,
      customSubject: data.customSubject || null,
      customBody: data.customBody || null,
      updatedById: data.updatedById,
    });
    
    const created = await db.select().from(notificationSettings)
      .where(eq(notificationSettings.eventType, data.eventType))
      .limit(1);
    return created[0] || null;
  }
}

export async function updateWhatsappConfig(
  apiKey: string, 
  phoneNumberId: string, 
  updatedById: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Update all notification settings with WhatsApp config
  await db.update(notificationSettings)
    .set({
      whatsappApiKey: apiKey,
      whatsappPhoneNumberId: phoneNumberId,
      updatedById,
    });
}

export async function getNotificationSettingByEvent(eventType: string): Promise<NotificationSetting | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(notificationSettings)
    .where(eq(notificationSettings.eventType, eventType))
    .limit(1);
  
  return result[0] || null;
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


// ============ SCAN HISTORY FUNCTIONS ============

export async function createScanRecord(data: Omit<InsertScanHistory, 'id' | 'scannedAt'>): Promise<ScanHistory> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [result] = await db.insert(scanHistory).values({
    ...data,
    scannedAt: new Date()
  });
  const [record] = await db.select().from(scanHistory).where(eq(scanHistory.id, result.insertId));
  return record;
}

export async function getScanHistory(options: {
  startDate?: Date;
  endDate?: Date;
  scanType?: string;
  customerId?: number;
  scannedById?: number;
  status?: string;
  trackingNumber?: string;
  limit?: number;
  offset?: number;
}): Promise<{ scans: ScanHistory[]; total: number }> {
  const db = await getDb();
  if (!db) return { scans: [], total: 0 };
  
  const conditions = [];
  
  if (options.startDate) {
    conditions.push(gte(scanHistory.scannedAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(scanHistory.scannedAt, options.endDate));
  }
  if (options.scanType) {
    conditions.push(eq(scanHistory.scanType, options.scanType as any));
  }
  if (options.customerId) {
    conditions.push(eq(scanHistory.customerId, options.customerId));
  }
  if (options.scannedById) {
    conditions.push(eq(scanHistory.scannedById, options.scannedById));
  }
  if (options.status) {
    conditions.push(eq(scanHistory.status, options.status as any));
  }
  if (options.trackingNumber) {
    conditions.push(like(scanHistory.trackingNumber, `%${options.trackingNumber}%`));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(scanHistory)
    .where(whereClause);
  
  const scans = await db.select()
    .from(scanHistory)
    .where(whereClause)
    .orderBy(desc(scanHistory.scannedAt))
    .limit(options.limit || 100)
    .offset(options.offset || 0);
  
  return { scans, total: totalResult?.count || 0 };
}

export async function getScanStatistics(startDate: Date, endDate: Date): Promise<{
  totalScans: number;
  successScans: number;
  errorScans: number;
  byType: { type: string; count: number }[];
  byUser: { userId: number; userName: string; count: number }[];
  byHour: { hour: number; count: number }[];
}> {
  const db = await getDb();
  if (!db) return { totalScans: 0, successScans: 0, errorScans: 0, byType: [], byUser: [], byHour: [] };
  
  const conditions = [
    gte(scanHistory.scannedAt, startDate),
    lte(scanHistory.scannedAt, endDate)
  ];
  
  // Total counts
  const [totals] = await db.select({
    total: sql<number>`count(*)`,
    success: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
    error: sql<number>`sum(case when status != 'success' then 1 else 0 end)`
  }).from(scanHistory).where(and(...conditions));
  
  // By type
  const byType = await db.select({
    type: scanHistory.scanType,
    count: sql<number>`count(*)`
  }).from(scanHistory)
    .where(and(...conditions))
    .groupBy(scanHistory.scanType);
  
  // By user
  const byUser = await db.select({
    userId: scanHistory.scannedById,
    userName: scanHistory.scannedByName,
    count: sql<number>`count(*)`
  }).from(scanHistory)
    .where(and(...conditions))
    .groupBy(scanHistory.scannedById, scanHistory.scannedByName);
  
  // By hour
  const byHour = await db.select({
    hour: sql<number>`HOUR(scannedAt)`,
    count: sql<number>`count(*)`
  }).from(scanHistory)
    .where(and(...conditions))
    .groupBy(sql`HOUR(scannedAt)`);
  
  return {
    totalScans: totals?.total || 0,
    successScans: totals?.success || 0,
    errorScans: totals?.error || 0,
    byType: byType.map(t => ({ type: t.type, count: t.count })),
    byUser: byUser.map(u => ({ userId: u.userId, userName: u.userName || 'Unknown', count: u.count })),
    byHour: byHour.map(h => ({ hour: h.hour, count: h.count }))
  };
}

export async function getTodayScanSummary(userId?: number): Promise<{
  total: number;
  register: number;
  receive: number;
  ship: number;
  arrive: number;
  deliver: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, register: 0, receive: 0, ship: 0, arrive: 0, deliver: 0, errors: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const conditions = [
    gte(scanHistory.scannedAt, today),
    lt(scanHistory.scannedAt, tomorrow)
  ];
  
  if (userId) {
    conditions.push(eq(scanHistory.scannedById, userId));
  }
  
  const [result] = await db.select({
    total: sql<number>`count(*)`,
    register: sql<number>`sum(case when scanType = 'register' then 1 else 0 end)`,
    receive: sql<number>`sum(case when scanType = 'receive' then 1 else 0 end)`,
    ship: sql<number>`sum(case when scanType = 'ship' then 1 else 0 end)`,
    arrive: sql<number>`sum(case when scanType = 'arrive' then 1 else 0 end)`,
    deliver: sql<number>`sum(case when scanType = 'deliver' then 1 else 0 end)`,
    errors: sql<number>`sum(case when status != 'success' then 1 else 0 end)`
  }).from(scanHistory).where(and(...conditions));
  
  return {
    total: result?.total || 0,
    register: result?.register || 0,
    receive: result?.receive || 0,
    ship: result?.ship || 0,
    arrive: result?.arrive || 0,
    deliver: result?.deliver || 0,
    errors: result?.errors || 0
  };
}


// ============ SCAN REPORTS ============

// Get scans by date range
export async function getScansByDateRange(startDate: Date, endDate: Date, scanType?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    gte(packageScans.scannedAt, startDate),
    lte(packageScans.scannedAt, endDate)
  ];
  
  if (scanType && scanType !== 'all') {
    conditions.push(eq(packageScans.scanType, scanType as any));
  }
  
  return db.select({
    scan: packageScans,
    scannedBy: users
  })
    .from(packageScans)
    .leftJoin(users, eq(packageScans.scannedById, users.id))
    .where(and(...conditions))
    .orderBy(desc(packageScans.scannedAt));
}

// Get scan statistics by date range
export async function getScanStatsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Use raw SQL to avoid GROUP BY issues with MySQL strict mode
  const results = await db.execute(sql`
    SELECT 
      scanType,
      COUNT(*) as count,
      DATE(scannedAt) as date
    FROM packageScans
    WHERE scannedAt >= ${startDate} AND scannedAt <= ${endDate}
    GROUP BY scanType, DATE(scannedAt)
    ORDER BY DATE(scannedAt)
  `);
  
  return ((results[0] as unknown) as any[]).map(row => ({
    scanType: row.scanType,
    count: Number(row.count),
    date: row.date
  }));
}

// Get daily scan summary
export async function getDailyScanSummary(date: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Use raw SQL to avoid GROUP BY issues with MySQL strict mode
  const results = await db.execute(sql`
    SELECT 
      scanType,
      COUNT(*) as count,
      HOUR(scannedAt) as hour
    FROM packageScans
    WHERE scannedAt >= ${startOfDay} AND scannedAt <= ${endOfDay}
    GROUP BY scanType, HOUR(scannedAt)
    ORDER BY HOUR(scannedAt)
  `);
  
  return ((results[0] as unknown) as any[]).map(row => ({
    scanType: row.scanType,
    count: Number(row.count),
    hour: Number(row.hour)
  }));
}

// Get monthly scan summary
export async function getMonthlyScanSummary(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  
  // Use raw SQL to avoid GROUP BY issues with MySQL strict mode
  const results = await db.execute(sql`
    SELECT 
      scanType,
      COUNT(*) as count,
      DAY(scannedAt) as day
    FROM packageScans
    WHERE scannedAt >= ${startOfMonth} AND scannedAt <= ${endOfMonth}
    GROUP BY scanType, DAY(scannedAt)
    ORDER BY DAY(scannedAt)
  `);
  
  return ((results[0] as unknown) as any[]).map(row => ({
    scanType: row.scanType,
    count: Number(row.count),
    day: Number(row.day)
  }));
}

// Get scan totals by type for date range
export async function getScanTotalsByType(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    scanType: packageScans.scanType,
    count: sql<number>`COUNT(*)`
  })
    .from(packageScans)
    .where(and(
      gte(packageScans.scannedAt, startDate),
      lte(packageScans.scannedAt, endDate)
    ))
    .groupBy(packageScans.scanType);
}

// Get scans by employee for date range
export async function getScansByEmployee(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    userId: packageScans.scannedById,
    userName: users.name,
    scanType: packageScans.scanType,
    count: sql<number>`COUNT(*)`
  })
    .from(packageScans)
    .leftJoin(users, eq(packageScans.scannedById, users.id))
    .where(and(
      gte(packageScans.scannedAt, startDate),
      lte(packageScans.scannedAt, endDate)
    ))
    .groupBy(packageScans.scannedById, users.name, packageScans.scanType)
    .orderBy(users.name);
}


// ============ SERVICE TYPES (جۆرەکانی خزمەتگوزاری) ============

export async function getAllServiceTypes(): Promise<ServiceType[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceTypes).orderBy(serviceTypes.sortOrder);
}

export async function getActiveServiceTypes(): Promise<ServiceType[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceTypes)
    .where(eq(serviceTypes.isActive, true))
    .orderBy(serviceTypes.sortOrder);
}

export async function getServiceTypeById(id: number): Promise<ServiceType | null> {
  const db = await getDb();
  if (!db) return null;
  const [type] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
  return type || null;
}

export async function createServiceType(data: InsertServiceType): Promise<ServiceType> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(serviceTypes).values(data);
  const insertId = Number(result[0].insertId);
  const [type] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, insertId));
  return type;
}

export async function updateServiceType(id: number, data: Partial<InsertServiceType>): Promise<ServiceType | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(serviceTypes).set(data).where(eq(serviceTypes.id, id));
  const [updated] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
  return updated || null;
}

export async function deleteServiceType(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(serviceTypes).where(eq(serviceTypes.id, id));
}


// ============ EXTRA SERVICES (خزمەتگوزاری زیادە) ============

// Generate service number
export async function generateServiceNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const year = new Date().getFullYear();
  const prefix = `SRV-${year}-`;
  
  // Get the last service number for this year
  const [lastService] = await db.select({ serviceNumber: extraServices.serviceNumber })
    .from(extraServices)
    .where(like(extraServices.serviceNumber, `${prefix}%`))
    .orderBy(desc(extraServices.id))
    .limit(1);
  
  let nextNum = 1;
  if (lastService?.serviceNumber) {
    const lastNum = parseInt(lastService.serviceNumber.replace(prefix, ''), 10);
    nextNum = lastNum + 1;
  }
  
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

export async function createExtraService(data: Omit<InsertExtraService, 'serviceNumber' | 'profitAmount'>): Promise<ExtraService> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const serviceNumber = await generateServiceNumber();
  const profitAmount = (Number(data.priceAmount) - Number(data.costAmount)).toFixed(2);
  
  const result = await db.insert(extraServices).values({
    ...data,
    serviceNumber,
    profitAmount
  });
  
  const insertId = Number(result[0].insertId);
  const [service] = await db.select().from(extraServices).where(eq(extraServices.id, insertId));
  return service;
}

export async function getExtraServiceById(id: number): Promise<ExtraService | null> {
  const db = await getDb();
  if (!db) return null;
  const [service] = await db.select().from(extraServices).where(eq(extraServices.id, id));
  return service || null;
}

export async function getExtraServicesByCustomer(customerId: number): Promise<ExtraService[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(extraServices)
    .where(eq(extraServices.customerId, customerId))
    .orderBy(desc(extraServices.createdAt));
}

export async function getExtraServicesWithDetails(customerId?: number): Promise<(ExtraService & { serviceType?: ServiceType; customer?: Customer })[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(extraServices);
  if (customerId) {
    query = query.where(eq(extraServices.customerId, customerId)) as any;
  }
  
  const services = await query.orderBy(desc(extraServices.createdAt));
  const types = await db.select().from(serviceTypes);
  const customersList = await db.select().from(customers);
  
  return services.map(service => ({
    ...service,
    serviceType: types.find(t => t.id === service.serviceTypeId),
    customer: customersList.find(c => c.id === service.customerId)
  }));
}

export async function updateExtraService(id: number, data: Partial<InsertExtraService>): Promise<ExtraService | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Recalculate profit if cost or price changed
  const updateData: any = { ...data };
  if (data.costAmount !== undefined || data.priceAmount !== undefined) {
    const existing = await getExtraServiceById(id);
    if (existing) {
      const cost = data.costAmount !== undefined ? Number(data.costAmount) : Number(existing.costAmount);
      const price = data.priceAmount !== undefined ? Number(data.priceAmount) : Number(existing.priceAmount);
      updateData.profitAmount = (price - cost).toFixed(2);
    }
  }
  
  await db.update(extraServices).set(updateData).where(eq(extraServices.id, id));
  const [updated] = await db.select().from(extraServices).where(eq(extraServices.id, id));
  return updated || null;
}

export async function deleteExtraService(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(extraServices).where(eq(extraServices.id, id));
}

export async function markExtraServiceAsPaid(id: number, paymentMethod: string, paidAmount: string): Promise<ExtraService | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(extraServices).set({
    isPaid: true,
    paidAt: new Date(),
    paidAmount,
    paymentMethod: paymentMethod as any
  }).where(eq(extraServices.id, id));
  
  const [updated] = await db.select().from(extraServices).where(eq(extraServices.id, id));
  return updated || null;
}

// Get all extra services with filters
export async function getAllExtraServices(filters?: {
  customerId?: number;
  serviceTypeId?: number;
  isPaid?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ services: ExtraService[]; total: number }> {
  const db = await getDb();
  if (!db) return { services: [], total: 0 };
  
  const conditions = [];
  
  if (filters?.customerId) {
    conditions.push(eq(extraServices.customerId, filters.customerId));
  }
  if (filters?.serviceTypeId) {
    conditions.push(eq(extraServices.serviceTypeId, filters.serviceTypeId));
  }
  if (filters?.isPaid !== undefined) {
    conditions.push(eq(extraServices.isPaid, filters.isPaid));
  }
  if (filters?.startDate) {
    conditions.push(gte(extraServices.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(extraServices.createdAt, filters.endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(extraServices)
    .where(whereClause);
  
  let query = db.select().from(extraServices).where(whereClause).orderBy(desc(extraServices.createdAt));
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  const services = await query;
  
  return { services, total: totalResult?.count || 0 };
}

// Get extra services summary for reports
export async function getExtraServicesSummary(startDate?: Date, endDate?: Date): Promise<{
  totalServices: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  byType: { typeId: number; typeName: string; count: number; cost: number; revenue: number; profit: number }[];
}> {
  const db = await getDb();
  if (!db) return { totalServices: 0, totalCost: 0, totalRevenue: 0, totalProfit: 0, byType: [] };
  
  const conditions = [];
  if (startDate) conditions.push(gte(extraServices.createdAt, startDate));
  if (endDate) conditions.push(lte(extraServices.createdAt, endDate));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Get totals
  const [totals] = await db.select({
    count: sql<number>`count(*)`,
    cost: sql<number>`COALESCE(SUM(CAST(costAmount AS DECIMAL(10,2))), 0)`,
    revenue: sql<number>`COALESCE(SUM(CAST(priceAmount AS DECIMAL(10,2))), 0)`,
    profit: sql<number>`COALESCE(SUM(CAST(profitAmount AS DECIMAL(10,2))), 0)`
  }).from(extraServices).where(whereClause);
  
  // Get by type
  const byTypeResults = await db.select({
    typeId: extraServices.serviceTypeId,
    count: sql<number>`count(*)`,
    cost: sql<number>`COALESCE(SUM(CAST(costAmount AS DECIMAL(10,2))), 0)`,
    revenue: sql<number>`COALESCE(SUM(CAST(priceAmount AS DECIMAL(10,2))), 0)`,
    profit: sql<number>`COALESCE(SUM(CAST(profitAmount AS DECIMAL(10,2))), 0)`
  }).from(extraServices)
    .where(whereClause)
    .groupBy(extraServices.serviceTypeId);
  
  // Get type names
  const types = await db.select().from(serviceTypes);
  
  return {
    totalServices: totals?.count || 0,
    totalCost: Number(totals?.cost) || 0,
    totalRevenue: Number(totals?.revenue) || 0,
    totalProfit: Number(totals?.profit) || 0,
    byType: byTypeResults.map(r => ({
      typeId: r.typeId,
      typeName: types.find(t => t.id === r.typeId)?.nameEn || 'Unknown',
      count: r.count,
      cost: Number(r.cost),
      revenue: Number(r.revenue),
      profit: Number(r.profit)
    }))
  };
}

// Get unpaid extra services for a customer
export async function getUnpaidExtraServices(customerId: number): Promise<ExtraService[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(extraServices)
    .where(and(
      eq(extraServices.customerId, customerId),
      eq(extraServices.isPaid, false)
    ))
    .orderBy(desc(extraServices.createdAt));
}

// Link extra service to an invoice
export async function linkExtraServiceToInvoice(serviceId: number, invoiceId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(extraServices).set({
    invoiceId,
  }).where(eq(extraServices.id, serviceId));
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
  const db = await getDb();
  if (!db) return {
    todayRevenue: 0, weekRevenue: 0, monthRevenue: 0,
    todayChange: 0, weekChange: 0, monthChange: 0,
    todayPackages: 0, weekPackages: 0, monthPackages: 0,
    totalDebt: 0
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart.getTime() - 1);

  // Today's revenue from payments
  const todayPayments = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(gte(paymentRecords.createdAt, todayStart));
  const todayRevenue = parseFloat(todayPayments[0]?.total || '0');

  // Yesterday's revenue for comparison
  const yesterdayPayments = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(and(
    gte(paymentRecords.createdAt, yesterdayStart),
    lt(paymentRecords.createdAt, todayStart)
  ));
  const yesterdayRevenue = parseFloat(yesterdayPayments[0]?.total || '0');
  const todayChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

  // This week's revenue
  const weekPayments = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(gte(paymentRecords.createdAt, weekStart));
  const weekRevenue = parseFloat(weekPayments[0]?.total || '0');

  // Last week's revenue for comparison
  const lastWeekPayments = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(and(
    gte(paymentRecords.createdAt, lastWeekStart),
    lt(paymentRecords.createdAt, weekStart)
  ));
  const lastWeekRevenue = parseFloat(lastWeekPayments[0]?.total || '0');
  const weekChange = lastWeekRevenue > 0 ? ((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;

  // This month's revenue
  const monthPayments = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(gte(paymentRecords.createdAt, monthStart));
  const monthRevenue = parseFloat(monthPayments[0]?.total || '0');

  // Last month's revenue for comparison
  const lastMonthPayments = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(and(
    gte(paymentRecords.createdAt, lastMonthStart),
    lt(paymentRecords.createdAt, monthStart)
  ));
  const lastMonthRevenue = parseFloat(lastMonthPayments[0]?.total || '0');
  const monthChange = lastMonthRevenue > 0 ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  // Package counts
  const todayPkgCount = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, todayStart));
  const weekPkgCount = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, weekStart));
  const monthPkgCount = await db.select({ count: count() }).from(packages).where(gte(packages.createdAt, monthStart));

  // Total debt - use unified debt calculation
  const debtInfo = await getTotalDebtAmount();
  const totalDebt = debtInfo.totalUsd;

  return {
    todayRevenue,
    weekRevenue,
    monthRevenue,
    todayChange: Math.round(todayChange * 10) / 10,
    weekChange: Math.round(weekChange * 10) / 10,
    monthChange: Math.round(monthChange * 10) / 10,
    todayPackages: todayPkgCount[0]?.count || 0,
    weekPackages: weekPkgCount[0]?.count || 0,
    monthPackages: monthPkgCount[0]?.count || 0,
    totalDebt
  };
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
      revenueData = (Array.isArray(revenueResult) ? revenueResult[0] : revenueResult) as unknown as { date: string; revenue: string }[];
    } catch (e) {
      console.error('Error fetching revenue data:', e);
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
      packageData = (Array.isArray(packageResult) ? packageResult[0] : packageResult) as unknown as { date: string; count: number }[];
    } catch (e) {
      console.error('Error fetching package data:', e);
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
    console.error('Error in getDashboardRevenueChart:', error);
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

  // Get package stats for each batch
  const result = await Promise.all(activeBatches.map(async (batch) => {
    const stats = await db.select({
      count: count(),
      totalWeight: sql<string>`COALESCE(SUM(CAST(${packages.weightKg} AS DECIMAL(10,2))), 0)`
    }).from(packages).where(eq(packages.batchId, batch.id));

    return {
      ...batch,
      packageCount: stats[0]?.count || 0,
      totalWeight: parseFloat(stats[0]?.totalWeight || '0')
    };
  }));

  return result;
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

  const debtors = await db.select({
    customerId: customerAccounts.customerId,
    debtUsd: sql<string>`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`
  }).from(customerAccounts)
    .where(gt(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`, 0))
    .orderBy(desc(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`))
    .limit(limit);

  // Get customer info and last payment for each debtor (from customers table)
  const result = await Promise.all(debtors.map(async (debtor) => {
    const [customer] = await db.select({
      fullName: customers.fullName,
      customerCode: customers.customerCode
    }).from(customers).where(eq(customers.id, debtor.customerId));

    const [lastPayment] = await db.select({
      paymentDate: paymentRecords.createdAt
    }).from(paymentRecords)
      .where(eq(paymentRecords.accountId, debtor.customerId))
      .orderBy(desc(paymentRecords.createdAt))
      .limit(1);

    return {
      customerId: debtor.customerId,
      customerName: customer?.fullName || 'Unknown',
      customerCode: customer?.customerCode || '',
      debtUsd: parseFloat(debtor.debtUsd),
      lastPaymentDate: lastPayment?.paymentDate || null
    };
  }));

  return result;
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

  // Recent payments
  const recentPayments = await db.select({
    id: paymentRecords.id,
    amountUsd: paymentRecords.amountUsd,
    customerId: paymentRecords.accountId,
    paymentDate: paymentRecords.createdAt
  }).from(paymentRecords).orderBy(desc(paymentRecords.createdAt)).limit(5);

  for (const payment of recentPayments) {
    const [customer] = await db.select({ fullName: customers.fullName }).from(customers).where(eq(customers.id, payment.customerId));
    activities.push({
      id: `pay-${payment.id}`,
      type: 'payment',
      title: `$${payment.amountUsd} وەرگیرا`,
      description: customer?.fullName || 'Unknown',
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

  const alerts: {
    id: string;
    type: 'warning' | 'info' | 'error' | 'success';
    title: string;
    description: string;
    count?: number;
    link?: string;
  }[] = [];

  // High debt customers (> $500)
  const highDebtors = await db.select({ count: count() })
    .from(customerAccounts)
    .where(gt(sql`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`, 500));
  
  if (highDebtors[0]?.count > 0) {
    alerts.push({
      id: 'high-debt',
      type: 'warning',
      title: 'کڕیارە قەرزدارەکان',
      description: `${highDebtors[0].count} کڕیار قەرزیان لە $500 زیاترە`,
      count: highDebtors[0].count,
      link: '/finance/debtors'
    });
  }

  // Batches at customs
  const customsBatches = await db.select({ count: count() })
    .from(batches)
    .where(eq(batches.status, 'customs'));
  
  if (customsBatches[0]?.count > 0) {
    alerts.push({
      id: 'customs',
      type: 'info',
      title: 'باچ لە گومرگ',
      description: `${customsBatches[0].count} باچ لە گومرگدا`,
      count: customsBatches[0].count,
      link: '/batches'
    });
  }

  // Unclaimed packages
  const unclaimedPkgs = await db.select({ count: count() })
    .from(packages)
    .where(eq(packages.isUnclaimed, true));
  
  if (unclaimedPkgs[0]?.count > 0) {
    alerts.push({
      id: 'unclaimed',
      type: 'warning',
      title: 'پاکەتی بێ خاوەن',
      description: `${unclaimedPkgs[0].count} پاکەت بێ خاوەنە`,
      count: unclaimedPkgs[0].count,
      link: '/packages/unclaimed'
    });
  }

  // Pending Full Package orders
  const pendingFP = await db.select({ count: count() })
    .from(fullPackageOrders)
    .where(eq(fullPackageOrders.status, 'pending'));
  
  if (pendingFP[0]?.count > 0) {
    alerts.push({
      id: 'pending-fp',
      type: 'info',
      title: 'داواکاری Full Package',
      description: `${pendingFP[0].count} داواکاری چاوەڕوانە`,
      count: pendingFP[0].count,
      link: '/full-package'
    });
  }

  // Today's deliveries
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayDeliveries = await db.select({ count: count() })
    .from(packages)
    .where(and(
      eq(packages.status, 'delivered'),
      gte(packages.updatedAt, todayStart)
    ));
  
  if (todayDeliveries[0]?.count > 0) {
    alerts.push({
      id: 'today-deliveries',
      type: 'success',
      title: 'گەیاندنی ئەمڕۆ',
      description: `${todayDeliveries[0].count} پاکەت گەیاندرا ئەمڕۆ`,
      count: todayDeliveries[0].count
    });
  }

  // New payments today
  const todayPayments = await db.select({ count: count() })
    .from(paymentRecords)
    .where(gte(paymentRecords.createdAt, todayStart));
  
  if (todayPayments[0]?.count > 0) {
    alerts.push({
      id: 'today-payments',
      type: 'success',
      title: 'پارەدانی ئەمڕۆ',
      description: `${todayPayments[0].count} پارەدان وەرگیرا`,
      count: todayPayments[0].count,
      link: '/finance'
    });
  }

  return alerts;
}

export async function getDashboardNewCustomers(days: number = 7): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get new customers from customers table
  const result = await db.select({ count: count() })
    .from(customers)
    .where(gte(customers.createdAt, startDate));

  return result[0]?.count || 0;
}


// ============ INVOICE TEMPLATES ============

export async function getInvoiceTemplates(): Promise<InvoiceTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceTemplates).orderBy(desc(invoiceTemplates.createdAt));
}

export async function getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select()
    .from(invoiceTemplates)
    .where(eq(invoiceTemplates.isDefault, true))
    .limit(1);
  return result[0] || null;
}

export async function getInvoiceTemplateById(id: number): Promise<InvoiceTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select()
    .from(invoiceTemplates)
    .where(eq(invoiceTemplates.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createInvoiceTemplate(data: InsertInvoiceTemplate): Promise<InvoiceTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // If this is set as default, unset other defaults
  if (data.isDefault) {
    await db.update(invoiceTemplates)
      .set({ isDefault: false })
      .where(eq(invoiceTemplates.isDefault, true));
  }
  
  const result = await db.insert(invoiceTemplates).values(data);
  const insertId = result[0].insertId;
  const created = await getInvoiceTemplateById(insertId);
  if (!created) throw new Error("Failed to create invoice template");
  return created;
}

export async function updateInvoiceTemplate(id: number, data: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await db.update(invoiceTemplates)
      .set({ isDefault: false })
      .where(and(
        eq(invoiceTemplates.isDefault, true),
        sql`${invoiceTemplates.id} != ${id}`
      ));
  }
  
  await db.update(invoiceTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(invoiceTemplates.id, id));
  
  return getInvoiceTemplateById(id);
}

export async function deleteInvoiceTemplate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Don't delete if it's the only template
  const templates = await getInvoiceTemplates();
  if (templates.length <= 1) {
    throw new Error("Cannot delete the only invoice template");
  }
  
  // If deleting default, make another one default
  const template = await getInvoiceTemplateById(id);
  if (template?.isDefault) {
    const otherTemplate = templates.find(t => t.id !== id);
    if (otherTemplate) {
      await db.update(invoiceTemplates)
        .set({ isDefault: true })
        .where(eq(invoiceTemplates.id, otherTemplate.id));
    }
  }
  
  await db.delete(invoiceTemplates).where(eq(invoiceTemplates.id, id));
  return true;
}

export async function setDefaultInvoiceTemplate(id: number): Promise<InvoiceTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Unset all defaults
  await db.update(invoiceTemplates)
    .set({ isDefault: false })
    .where(eq(invoiceTemplates.isDefault, true));
  
  // Set new default
  await db.update(invoiceTemplates)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(invoiceTemplates.id, id));
  
  return getInvoiceTemplateById(id);
}

// Initialize default template if none exists
export async function ensureDefaultInvoiceTemplate(): Promise<InvoiceTemplate> {
  const existing = await getDefaultInvoiceTemplate();
  if (existing) return existing;
  
  // Create default template
  return createInvoiceTemplate({
    name: "Default",
    isDefault: true,
    style: "modern",
    companyName: "Wazn Express",
    companyNameKu: "وازن ئێکسپرێس",
    companyNameAr: "وزن اكسبرس",
    companyPhone: "+964 750 000 0000",
    companyEmail: "info@waznexpress.com",
    primaryColor: "#3b82f6",
    secondaryColor: "#10b981",
    accentColor: "#f59e0b",
    textColor: "#1f2937",
    backgroundColor: "#ffffff",
    fontFamily: "Arial",
    fontSize: 10,
    showQrCode: true,
    showWatermark: false,
    invoicePrefix: "INV",
    invoiceNumberDigits: 6,
    footerText: "Thank you for your business!",
    footerTextKu: "سوپاس بۆ کارکردنتان لەگەڵمان!",
    footerTextAr: "شكراً لتعاملكم معنا!",
  });
}


// ============ NOTIFICATION TEMPLATES ============
export async function getNotificationTemplates(): Promise<NotificationTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationTemplates).orderBy(notificationTemplates.eventType);
}

export async function getNotificationTemplateById(id: number): Promise<NotificationTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationTemplates).where(eq(notificationTemplates.id, id));
  return result[0] || null;
}

export async function getNotificationTemplateByEvent(eventType: string): Promise<NotificationTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(notificationTemplates).where(eq(notificationTemplates.eventType, eventType as any));
  return result[0] || null;
}

export async function createNotificationTemplate(data: InsertNotificationTemplate): Promise<NotificationTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(notificationTemplates).values(data);
  return getNotificationTemplateById(result.insertId) as Promise<NotificationTemplate>;
}

export async function updateNotificationTemplate(id: number, data: Partial<InsertNotificationTemplate>): Promise<NotificationTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(notificationTemplates).set({ ...data, updatedAt: new Date() }).where(eq(notificationTemplates.id, id));
  return getNotificationTemplateById(id);
}

export async function deleteNotificationTemplate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id));
  return true;
}

// Initialize default notification templates
export async function ensureDefaultNotificationTemplates(): Promise<void> {
  const existing = await getNotificationTemplates();
  if (existing.length > 0) return;
  
  const defaultTemplates: InsertNotificationTemplate[] = [
    {
      eventType: "package_received",
      name: "Package Received",
      isActive: true,
      smsTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} وەرگیرا. وازن ئێکسپرێس",
      smsTemplateKu: "پاکەتەکەت بە ژمارەی {trackingNumber} وەرگیرا. وازن ئێکسپرێس",
      smsTemplateAr: "تم استلام طردك رقم {trackingNumber}. وزن اكسبرس",
      pushTitle: "پاکەت وەرگیرا",
      pushTitleKu: "پاکەت وەرگیرا",
      pushTitleAr: "تم استلام الطرد",
      pushTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} وەرگیرا",
    },
    {
      eventType: "package_shipped",
      name: "Package Shipped",
      isActive: true,
      smsTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} ڕەوانە کرا بۆ عێراق. وازن ئێکسپرێس",
      smsTemplateKu: "پاکەتەکەت بە ژمارەی {trackingNumber} ڕەوانە کرا بۆ عێراق. وازن ئێکسپرێس",
      smsTemplateAr: "تم شحن طردك رقم {trackingNumber} الى العراق. وزن اكسبرس",
      pushTitle: "پاکەت ڕەوانە کرا",
      pushTitleKu: "پاکەت ڕەوانە کرا",
      pushTitleAr: "تم شحن الطرد",
      pushTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} ڕەوانە کرا",
    },
    {
      eventType: "package_arrived",
      name: "Package Arrived",
      isActive: true,
      smsTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} گەیشتە کۆگای سلێمانی. وازن ئێکسپرێس",
      smsTemplateKu: "پاکەتەکەت بە ژمارەی {trackingNumber} گەیشتە کۆگای سلێمانی. وازن ئێکسپرێس",
      smsTemplateAr: "وصل طردك رقم {trackingNumber} الى مخزن السليمانية. وزن اكسبرس",
      pushTitle: "پاکەت گەیشت",
      pushTitleKu: "پاکەت گەیشت",
      pushTitleAr: "وصل الطرد",
      pushTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} گەیشتە کۆگا",
    },
    {
      eventType: "package_delivered",
      name: "Package Delivered",
      isActive: true,
      smsTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} گەیاندرا. سوپاس بۆ متمانەت! وازن ئێکسپرێس",
      smsTemplateKu: "پاکەتەکەت بە ژمارەی {trackingNumber} گەیاندرا. سوپاس بۆ متمانەت! وازن ئێکسپرێس",
      smsTemplateAr: "تم توصيل طردك رقم {trackingNumber}. شكراً لثقتك! وزن اكسبرس",
      pushTitle: "پاکەت گەیاندرا",
      pushTitleKu: "پاکەت گەیاندرا",
      pushTitleAr: "تم التوصيل",
      pushTemplate: "پاکەتەکەت بە ژمارەی {trackingNumber} گەیاندرا",
    },
    {
      eventType: "payment_received",
      name: "Payment Received",
      isActive: true,
      smsTemplate: "پارەدانی ${amount} وەرگیرا. باڵانسی نوێ: ${balance}. وازن ئێکسپرێس",
      smsTemplateKu: "پارەدانی ${amount} وەرگیرا. باڵانسی نوێ: ${balance}. وازن ئێکسپرێس",
      smsTemplateAr: "تم استلام دفعة ${amount}. الرصيد الجديد: ${balance}. وزن اكسبرس",
      pushTitle: "پارەدان وەرگیرا",
      pushTitleKu: "پارەدان وەرگیرا",
      pushTitleAr: "تم استلام الدفعة",
      pushTemplate: "پارەدانی ${amount} وەرگیرا",
    },
    {
      eventType: "batch_shipped",
      name: "Batch Shipped",
      isActive: true,
      smsTemplate: "باچی {batchNumber} ڕەوانە کرا. {packageCount} پاکەتت تێدایە. وازن ئێکسپرێس",
      smsTemplateKu: "باچی {batchNumber} ڕەوانە کرا. {packageCount} پاکەتت تێدایە. وازن ئێکسپرێس",
      smsTemplateAr: "تم شحن الدفعة {batchNumber}. لديك {packageCount} طرود. وزن اكسبرس",
      pushTitle: "باچ ڕەوانە کرا",
      pushTitleKu: "باچ ڕەوانە کرا",
      pushTitleAr: "تم شحن الدفعة",
      pushTemplate: "باچی {batchNumber} ڕەوانە کرا",
    },
    {
      eventType: "batch_arrived",
      name: "Batch Arrived",
      isActive: true,
      smsTemplate: "باچی {batchNumber} گەیشت. {packageCount} پاکەتت ئامادەیە بۆ وەرگرتن. وازن ئێکسپرێس",
      smsTemplateKu: "باچی {batchNumber} گەیشت. {packageCount} پاکەتت ئامادەیە بۆ وەرگرتن. وازن ئێکسپرێس",
      smsTemplateAr: "وصلت الدفعة {batchNumber}. لديك {packageCount} طرود جاهزة للاستلام. وزن اكسبرس",
      pushTitle: "باچ گەیشت",
      pushTitleKu: "باچ گەیشت",
      pushTitleAr: "وصلت الدفعة",
      pushTemplate: "باچی {batchNumber} گەیشت",
    },
  ];
  
  for (const template of defaultTemplates) {
    await createNotificationTemplate(template);
  }
}

// ============ LABEL TEMPLATES ============
export async function getLabelTemplates(): Promise<LabelTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(labelTemplates).orderBy(labelTemplates.name);
}

export async function getLabelTemplateById(id: number): Promise<LabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(labelTemplates).where(eq(labelTemplates.id, id));
  return result[0] || null;
}

export async function getDefaultLabelTemplate(): Promise<LabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(labelTemplates).where(eq(labelTemplates.isDefault, true));
  return result[0] || null;
}

export async function createLabelTemplate(data: InsertLabelTemplate): Promise<LabelTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(labelTemplates).values(data);
  return getLabelTemplateById(result.insertId) as Promise<LabelTemplate>;
}

export async function updateLabelTemplate(id: number, data: Partial<InsertLabelTemplate>): Promise<LabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(labelTemplates).set({ ...data, updatedAt: new Date() }).where(eq(labelTemplates.id, id));
  return getLabelTemplateById(id);
}

export async function deleteLabelTemplate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(labelTemplates).where(eq(labelTemplates.id, id));
  return true;
}

export async function setDefaultLabelTemplate(id: number): Promise<LabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Unset all defaults
  await db.update(labelTemplates)
    .set({ isDefault: false })
    .where(eq(labelTemplates.isDefault, true));
  
  // Set new default
  await db.update(labelTemplates)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(labelTemplates.id, id));
  
  return getLabelTemplateById(id);
}

// Initialize default label template
export async function ensureDefaultLabelTemplate(): Promise<LabelTemplate> {
  const existing = await getDefaultLabelTemplate();
  if (existing) return existing;
  
  return createLabelTemplate({
    name: "Standard Label",
    isDefault: true,
    size: "10x15",
    widthMm: 100,
    heightMm: 150,
    showQrCode: true,
    qrCodeSize: 80,
    qrCodePosition: "top-right",
    showBarcode: true,
    barcodeType: "code128",
    showLogo: true,
    logoWidth: 60,
    showTrackingNumber: true,
    showCustomerName: true,
    showCustomerCode: true,
    showCustomerPhone: true,
    showDestinationCity: true,
    showWeight: true,
    showDimensions: false,
    showShippingType: true,
    showBatchNumber: true,
    showDate: true,
    showPrice: false,
    primaryColor: "#000000",
    fontFamily: "Arial",
    fontSize: 12,
  });
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
  
  console.log('[DB DEBUG] Input data.barcode:', JSON.stringify(data.barcode), 'Type:', typeof data.barcode);
  
  // Set available stock = current stock initially
  // Handle empty barcode as null to avoid unique constraint issues
  // Must explicitly check for empty string since empty string is falsy but still sent to DB
  const barcodeValue = (data.barcode && typeof data.barcode === 'string' && data.barcode.trim() !== '') ? data.barcode.trim() : null;
  
  console.log('[DB DEBUG] Processed barcodeValue:', JSON.stringify(barcodeValue));
  
  // Create productData without barcode first, then add it only if it has a value
  const { barcode: _ignoredBarcode, ...dataWithoutBarcode } = data;
  const productData: any = {
    ...dataWithoutBarcode,
    availableStock: data.currentStock || 0,
  };
  // Only add barcode if it has a real value (not empty string, not null)
  if (barcodeValue) {
    productData.barcode = barcodeValue;
  }
  
  console.log('[DB DEBUG] Final productData.barcode:', JSON.stringify(productData.barcode));
  
  const result = await db.insert(stockProducts).values(productData);
  const inserted = await db.select().from(stockProducts).where(eq(stockProducts.id, Number(result[0].insertId)));
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
  const updateData: any = { ...data };
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
    conditions.push(eq(stockPurchases.status, filters.status as any));
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
    conditions.push(eq(stockSales.status, filters.status as any));
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
    conditions.push(eq(stockMovements.movementType, filters.movementType as any));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(stockMovements.createdAt, filters.startDate));
  }
  
  if (filters?.endDate) {
    conditions.push(lte(stockMovements.createdAt, filters.endDate));
  }
  
  let query = db.select().from(stockMovements);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  query = query.orderBy(desc(stockMovements.createdAt)) as any;
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
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


// ============================================
// DATA MANAGEMENT / RESET FUNCTIONS
// ============================================

// Delete all customers and related data
export async function deleteAllCustomers(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    // Delete related data first
    await db.delete(ledgerTransactions);
    await db.delete(customerAccounts);
    await db.delete(paymentRecords);
    
    // Delete customers
    const result = await db.delete(customers);
    
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting customers:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all packages
export async function deleteAllPackages(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(packages);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting packages:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all batches
export async function deleteAllBatches(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    // First update packages to remove batch references
    await db.update(packages).set({ batchId: null });
    
    const result = await db.delete(batches);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting batches:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all invoices
export async function deleteAllInvoices(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(invoices);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting invoices:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all payment records
export async function deleteAllPayments(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(paymentRecords);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting payments:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all expenses
export async function deleteAllExpenses(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(expenses);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting expenses:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all ledger transactions (unified ledger system)
export async function deleteAllLedgerTransactions(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(ledgerTransactions);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting ledger transactions:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all full packages
export async function deleteAllFullPackages(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(fullPackageOrders);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting full packages:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all suppliers
export async function deleteAllSuppliers(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(suppliers);
    return { success: true, deletedCount: (result as any).rowsAffected || 0 };
  } catch (error) {
    console.error('Error deleting suppliers:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Full system reset - delete all data
export async function resetAllData(): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: 'Database connection failed' };

  // Helper function to safely delete from a table (ignores if table doesn't exist)
  const safeDelete = async (table: any) => {
    try {
      await db.delete(table);
    } catch (error: any) {
      // Check all possible error message locations for "table doesn't exist"
      const errorStr = JSON.stringify(error);
      const errorMsg = error?.sqlMessage || error?.message || error?.cause?.message || error?.cause?.sqlMessage || '';
      
      // If error contains "doesn't exist" anywhere, skip silently
      if (errorMsg.includes("doesn't exist") || errorStr.includes("doesn't exist")) {
        // Table doesn't exist, skip silently
        return;
      }
      
      console.error('Error deleting table:', errorMsg);
      throw error;
    }
  };

  try {
    // Delete in order to respect foreign key constraints
    // 1. First delete all child tables that reference other tables
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
    // purchaseRequests removed
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
    // ledgerEntries removed - using unified ledgerTransactions only
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
    
    // Delete permissions first (they reference users)
    await safeDelete(permissions);
    await safeDelete(subPermissions);
    
    // Delete customers from customers table (not users)
    await safeDelete(customers);
    
    return { success: true, message: 'All data has been deleted successfully' };
  } catch (error) {
    console.error('Error resetting all data:', error);
    return { success: false, message: 'Error occurred while deleting data' };
  }
}

// Get data counts for display
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
    customersCount,
    packagesCount,
    batchesCount,
    invoicesCount,
    paymentsCount,
    expensesCount,
    ledgerCount,
    fullPkgCount,
    suppliersCount
  ] = await Promise.all([
    // Count customers from customers table
    db.select({ count: count() }).from(customers),
    db.select({ count: count() }).from(packages),
    db.select({ count: count() }).from(batches),
    db.select({ count: count() }).from(invoices),
    db.select({ count: count() }).from(paymentRecords),
    db.select({ count: count() }).from(expenses),
    // Use ledgerTransactions as the main ledger table (ledgerEntries is empty)
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



// ============ BLOG POSTS (بلۆگ و ڕاگەیاندنەکان) ============

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select().from(blogPosts)
    .where(and(
      eq(blogPosts.status, 'published'),
      or(
        isNull(blogPosts.expiresAt),
        gt(blogPosts.expiresAt, now)
      )
    ))
    .orderBy(desc(blogPosts.publishedAt));
}

export async function getFeaturedBlogPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select().from(blogPosts)
    .where(and(
      eq(blogPosts.status, 'published'),
      eq(blogPosts.isFeatured, true),
      or(
        isNull(blogPosts.expiresAt),
        gt(blogPosts.expiresAt, now)
      )
    ))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(5);
}

export async function getBlogPostById(id: number): Promise<BlogPost | null> {
  const db = await getDb();
  if (!db) return null;
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return post || null;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = await getDb();
  if (!db) return null;
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
  return post || null;
}

export async function createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate slug from title if not provided
  if (!data.slug) {
    data.slug = data.titleEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
  }
  
  const result = await db.insert(blogPosts).values(data);
  const insertId = Number(result[0].insertId);
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, insertId));
  return post;
}

export async function updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(blogPosts).set(data).where(eq(blogPosts.id, id));
  return getBlogPostById(id);
}

export async function deleteBlogPost(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(blogPosts).where(eq(blogPosts.id, id));
  return (result[0] as any).affectedRows > 0;
}

export async function incrementBlogViewCount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(blogPosts)
    .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
    .where(eq(blogPosts.id, id));
}

export async function getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select().from(blogPosts)
    .where(and(
      eq(blogPosts.status, 'published'),
      eq(blogPosts.category, category as any),
      or(
        isNull(blogPosts.expiresAt),
        gt(blogPosts.expiresAt, now)
      )
    ))
    .orderBy(desc(blogPosts.publishedAt));
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
    db.select({ sum: sql<number>`COALESCE(SUM(${paymentRecords.amountUsd}), 0)` }).from(paymentRecords),
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
        deletedCount = (pkgResult[0] as any).affectedRows || 0;
        break;
      case 'scans':
        const scanResult = await db.delete(packageScans).where(lt(packageScans.scannedAt, cutoffDate));
        deletedCount = (scanResult[0] as any).affectedRows || 0;
        break;
      case 'ledger':
        const ledgerResult = await db.delete(ledgerTransactions).where(lt(ledgerTransactions.createdAt, cutoffDate));
        deletedCount = (ledgerResult[0] as any).affectedRows || 0;
        break;
      case 'invoices':
        const invResult = await db.delete(invoices).where(
          and(
            lt(invoices.createdAt, cutoffDate),
            eq(invoices.status, 'paid')
          )
        );
        deletedCount = (invResult[0] as any).affectedRows || 0;
        break;
      default:
        return { success: false, deletedCount: 0 };
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error deleting old data:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all scans
export async function deleteAllScans(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(packageScans);
    return { success: true, deletedCount: (result[0] as any).affectedRows || 0 };
  } catch (error) {
    console.error('Error deleting scans:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all status history
export async function deleteAllStatusHistory(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(packageStatusHistory);
    return { success: true, deletedCount: (result[0] as any).affectedRows || 0 };
  } catch (error) {
    console.error('Error deleting status history:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all audit logs
export async function deleteAllAuditLogs(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(auditLogs);
    return { success: true, deletedCount: (result[0] as any).affectedRows || 0 };
  } catch (error) {
    console.error('Error deleting audit logs:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Delete all blog posts
export async function deleteAllBlogPosts(): Promise<{ success: boolean; deletedCount: number }> {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const result = await db.delete(blogPosts);
    return { success: true, deletedCount: (result[0] as any).affectedRows || 0 };
  } catch (error) {
    console.error('Error deleting blog posts:', error);
    return { success: false, deletedCount: 0 };
  }
}

// Get deletion preview (what will be deleted)
export async function getDeletionPreview(dataType: string, daysOld?: number): Promise<{
  count: number;
  sampleItems: any[];
  estimatedSize: string;
}> {
  const db = await getDb();
  if (!db) return { count: 0, sampleItems: [], estimatedSize: '0 KB' };

  try {
    let totalCount = 0;
    let sampleItems: any[] = [];

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
    console.error('Error getting deletion preview:', error);
    return { count: 0, sampleItems: [], estimatedSize: '0 KB' };
  }
}


// ============ DELETION LOGS ============

// Create a deletion log entry
export async function createDeletionLog(data: {
  category: string;
  deletionType: 'single_category' | 'old_data' | 'test_data' | 'factory_reset';
  recordCount: number;
  details?: Record<string, any>;
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
    return { success: true, id: (result[0] as any).insertId };
  } catch (error) {
    console.error('Error creating deletion log:', error);
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
  logs: any[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  try {
    const conditions: SQL[] = [];
    
    if (options?.category) {
      conditions.push(eq(deletionLogs.category, options.category));
    }
    if (options?.deletionType) {
      conditions.push(eq(deletionLogs.deletionType, options.deletionType as any));
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
    console.error('Error getting deletion logs:', error);
    return { logs: [], total: 0 };
  }
}

// ============ DATA EXPORT ============

// Export data for a specific category
export async function exportCategoryData(category: string): Promise<{
  success: boolean;
  data: any[];
  count: number;
}> {
  const db = await getDb();
  if (!db) return { success: false, data: [], count: 0 };

  try {
    let data: any[] = [];

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
    console.error('Error exporting category data:', error);
    return { success: false, data: [], count: 0 };
  }
}

// Export all data (for full backup) - COMPLETE DATABASE BACKUP
export async function exportAllData(): Promise<{
  success: boolean;
  data: Record<string, any[]>;
  totalRecords: number;
  tableCount: number;
}> {
  const db = await getDb();
  if (!db) return { success: false, data: {}, totalRecords: 0, tableCount: 0 };

  // Helper function to safely query a table (returns empty array if table doesn't exist)
  async function safeSelect(table: any, tableName: string): Promise<any[]> {
    try {
      return await db!.select().from(table);
    } catch (error: any) {
      if (error?.cause?.code === 'ER_NO_SUCH_TABLE' || error?.message?.includes("doesn't exist")) {
        console.log(`[Backup] Table ${tableName} doesn't exist, skipping...`);
        return [];
      }
      throw error;
    }
  }

  try {
    console.log('[Backup] Starting complete database export...');
    
    // Export ALL tables in parallel batches to avoid overwhelming the database
    // Batch 1: Core business data
    const [usersData, customersData, packagesData, batchesData, invoicesData] = await Promise.all([
      safeSelect(users, 'users'),
      safeSelect(customers, 'customers'),
      safeSelect(packages, 'packages'),
      safeSelect(batches, 'batches'),
      safeSelect(invoices, 'invoices'),
    ]);
    console.log('[Backup] Batch 1 complete: users, customers, packages, batches, invoices');

    // Batch 2: Financial data
    const [paymentsData, expensesData, ledgerData, accountsData, creditAdjustmentsData] = await Promise.all([
      safeSelect(paymentRecords, 'paymentRecords'),
      safeSelect(expenses, 'expenses'),
      safeSelect(ledgerTransactions, 'ledgerTransactions'),
      safeSelect(customerAccounts, 'customerAccounts'),
      safeSelect(creditAdjustments, 'creditAdjustments'),
    ]);
    console.log('[Backup] Batch 2 complete: payments, expenses, ledger, accounts, creditAdjustments');

    // Batch 3: Full package and suppliers
    const [fullPackageData, suppliersData, fpStatusHistoryData] = await Promise.all([
      safeSelect(fullPackageOrders, 'fullPackageOrders'),
      safeSelect(suppliers, 'suppliers'),
      safeSelect(fullPackageStatusHistory, 'fullPackageStatusHistory'),
    ]);
    console.log('[Backup] Batch 3 complete: fullPackageOrders, suppliers, fpStatusHistory');

    // Batch 4: Package tracking data
    const [scansData, statusHistoryData, scanHistoryData, scanDevicesData, qrCodesData] = await Promise.all([
      safeSelect(packageScans, 'packageScans'),
      safeSelect(packageStatusHistory, 'packageStatusHistory'),
      safeSelect(scanHistory, 'scanHistory'),
      safeSelect(scanDevices, 'scanDevices'),
      safeSelect(packageQrCodes, 'packageQrCodes'),
    ]);
    console.log('[Backup] Batch 4 complete: scans, statusHistory, scanHistory, scanDevices, qrCodes');

    // Batch 5: Configuration and settings
    const [countriesData, warehousesData, pricingRulesData, exchangeRatesData, systemSettingsData] = await Promise.all([
      safeSelect(countries, 'countries'),
      safeSelect(warehouses, 'warehouses'),
      safeSelect(pricingRules, 'pricingRules'),
      safeSelect(exchangeRates, 'exchangeRates'),
      safeSelect(systemSettings, 'systemSettings'),
    ]);
    console.log('[Backup] Batch 5 complete: countries, warehouses, pricingRules, exchangeRates, systemSettings');

    // Batch 6: Customer related
    const [customerCodePrefixesData, customerAddressesData, customerMessagesData, customerNotifPrefsData, vipCustomersData] = await Promise.all([
      safeSelect(customerCodePrefixes, 'customerCodePrefixes'),
      safeSelect(customerAddresses, 'customerAddresses'),
      safeSelect(customerMessages, 'customerMessages'),
      safeSelect(customerNotificationPrefs, 'customerNotificationPrefs'),
      safeSelect(vipCustomers, 'vipCustomers'),
    ]);
    console.log('[Backup] Batch 6 complete: customerCodePrefixes, addresses, messages, notifPrefs, vipCustomers');

    // Batch 7: Batch pricing
    const [batchPricingTiersData, batchCustomerPricingData] = await Promise.all([
      safeSelect(batchPricingTiers, 'batchPricingTiers'),
      safeSelect(batchCustomerPricing, 'batchCustomerPricing'),
    ]);
    console.log('[Backup] Batch 7 complete: batchPricingTiers, batchCustomerPricing');

    // Batch 8: Services
    const [serviceTypesData, extraServicesData, packageClaimRequestsData] = await Promise.all([
      safeSelect(serviceTypes, 'serviceTypes'),
      safeSelect(extraServices, 'extraServices'),
      safeSelect(packageClaimRequests, 'packageClaimRequests'),
    ]);
    console.log('[Backup] Batch 8 complete: serviceTypes, extraServices, packageClaimRequests');

    // Batch 9: Stock management
    const [stockCategoriesData, stockProductsData, stockPurchasesData, stockPurchaseItemsData] = await Promise.all([
      safeSelect(stockCategories, 'stockCategories'),
      safeSelect(stockProducts, 'stockProducts'),
      safeSelect(stockPurchases, 'stockPurchases'),
      safeSelect(stockPurchaseItems, 'stockPurchaseItems'),
    ]);
    console.log('[Backup] Batch 9 complete: stockCategories, stockProducts, stockPurchases, stockPurchaseItems');

    // Batch 10: Stock sales and movements
    const [stockSalesData, stockSaleItemsData, stockMovementsData] = await Promise.all([
      safeSelect(stockSales, 'stockSales'),
      safeSelect(stockSaleItems, 'stockSaleItems'),
      safeSelect(stockMovements, 'stockMovements'),
    ]);
    console.log('[Backup] Batch 10 complete: stockSales, stockSaleItems, stockMovements');

    // Batch 11: Company financial management
    const [expenseCategoriesData, partnersData, partnerTransactionsData, companyDebtsData, debtPaymentsData] = await Promise.all([
      safeSelect(expenseCategories, 'expenseCategories'),
      safeSelect(partners, 'partners'),
      safeSelect(partnerTransactions, 'partnerTransactions'),
      safeSelect(companyDebts, 'companyDebts'),
      safeSelect(debtPayments, 'debtPayments'),
    ]);
    console.log('[Backup] Batch 11 complete: expenseCategories, partners, partnerTransactions, companyDebts, debtPayments');

    // Batch 12: Cash and finance
    const [cashAccountsData, cashTransactionsData, financialPeriodsData, revenueRecordsData, dailyFinancialSummaryData] = await Promise.all([
      safeSelect(cashAccounts, 'cashAccounts'),
      safeSelect(cashTransactions, 'cashTransactions'),
      safeSelect(financialPeriods, 'financialPeriods'),
      safeSelect(revenueRecords, 'revenueRecords'),
      safeSelect(dailyFinancialSummary, 'dailyFinancialSummary'),
    ]);
    console.log('[Backup] Batch 12 complete: cashAccounts, cashTransactions, financialPeriods, revenueRecords, dailyFinancialSummary');

    // Batch 13: Notifications and templates
    const [notificationLogsData, notificationSettingsData, notificationTemplatesData, customerNotificationsData] = await Promise.all([
      safeSelect(notificationLogs, 'notificationLogs'),
      safeSelect(notificationSettings, 'notificationSettings'),
      safeSelect(notificationTemplates, 'notificationTemplates'),
      safeSelect(customerNotifications, 'customerNotifications'),
    ]);
    console.log('[Backup] Batch 13 complete: notificationLogs, notificationSettings, notificationTemplates, customerNotifications');

    // Batch 14: Templates
    const [labelTemplatesData, invoiceTemplatesData, emailTemplatesData] = await Promise.all([
      safeSelect(labelTemplates, 'labelTemplates'),
      safeSelect(invoiceTemplates, 'invoiceTemplates'),
      safeSelect(emailTemplates, 'emailTemplates'),
    ]);
    console.log('[Backup] Batch 14 complete: labelTemplates, invoiceTemplates, emailTemplates');

    // Batch 15: System and audit
    const [auditData, permissionsData, subPermissionsData, scheduledTasksLogData, paymentRemindersData] = await Promise.all([
      safeSelect(auditLogs, 'auditLogs'),
      safeSelect(permissions, 'permissions'),
      safeSelect(subPermissions, 'subPermissions'),
      safeSelect(scheduledTasksLog, 'scheduledTasksLog'),
      safeSelect(paymentReminders, 'paymentReminders'),
    ]);
    console.log('[Backup] Batch 15 complete: auditLogs, permissions, subPermissions, scheduledTasksLog, paymentReminders');

    // Batch 16: Other tables
    const [currenciesData, taxRatesData, ipWhitelistData, productCategoriesData] = await Promise.all([
      safeSelect(currencies, 'currencies'),
      safeSelect(taxRates, 'taxRates'),
      safeSelect(ipWhitelist, 'ipWhitelist'),
      safeSelect(productCategories, 'productCategories'),
    ]);
    console.log('[Backup] Batch 16 complete: currencies, taxRates, ipWhitelist, productCategories');

    // Batch 17: Blog and activity
    const [blogData, deletionLogsData, activityAlertsData] = await Promise.all([
      safeSelect(blogPosts, 'blogPosts'),
      safeSelect(deletionLogs, 'deletionLogs'),
      safeSelect(activityAlerts, 'activityAlerts'),
    ]);
    console.log('[Backup] Batch 17 complete: blogPosts, deletionLogs, activityAlerts');

    // Batch 18: Support chat
    const [supportChatsData, chatMessagesData] = await Promise.all([
      safeSelect(supportChats, 'supportChats'),
      safeSelect(chatMessages, 'chatMessages'),
    ]);
    console.log('[Backup] Batch 18 complete: supportChats, chatMessages');

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

    console.log(`[Backup] Complete! Exported ${tableCount} tables with ${totalRecords} total records`);

    return { success: true, data, totalRecords, tableCount };
  } catch (error: any) {
    console.error('[Backup] Error exporting all data:', error);
    console.error('[Backup] Error message:', error?.message);
    console.error('[Backup] Error stack:', error?.stack);
    return { success: false, data: {}, totalRecords: 0, tableCount: 0 };
  }
}


// ============ DATA IMPORT FUNCTIONS ============

// Import category data
export async function importCategoryData(
  category: string,
  data: Record<string, any>[],
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
  const tableMap: Record<string, any> = {
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
        await db.delete(table);
        console.log(`[Import] Cleared table: ${category}`);
      } catch (deleteError) {
        console.warn(`[Import] Could not clear table ${category}:`, deleteError);
      }
    }

    // Import data based on category
    for (const record of data) {
      try {
        // Remove id field if present (let database generate new ones unless overwrite)
        const cleanRecord = { ...record };
        if (!overwrite) {
          delete cleanRecord.id;
        }

        // Convert date strings back to Date objects
        for (const key of Object.keys(cleanRecord)) {
          if (typeof cleanRecord[key] === 'string' && cleanRecord[key].match(/^\d{4}-\d{2}-\d{2}T/)) {
            cleanRecord[key] = new Date(cleanRecord[key]);
          }
        }

        switch (category) {
          case 'customers': {
            // Map CSV fields to customer table fields
            const customerData: any = {};
            
            // Name field mapping
            customerData.fullName = cleanRecord.name || cleanRecord.Name || cleanRecord.fullName || cleanRecord.full_name || 'Unknown';
            
            // Phone field mapping - clean phone number
            let phone = cleanRecord.phone || cleanRecord.Phone || cleanRecord['Phone 1'] || cleanRecord.phone1 || cleanRecord.mobileNumber || '';
            phone = phone.toString().replace(/\s+/g, '').replace(/^0+/, ''); // Remove spaces and leading zeros
            if (!phone.startsWith('7') && phone.length > 0) {
              phone = '7' + phone.replace(/^\d*7/, '7'); // Ensure starts with 7 for Iraqi numbers
            }
            customerData.mobileNumber = phone || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            // Secondary phone
            let phone2 = cleanRecord.phone2 || cleanRecord['Phone 2'] || cleanRecord.secondaryMobile || '';
            if (phone2) {
              phone2 = phone2.toString().replace(/\s+/g, '').replace(/^0+/, '');
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
            const existingCustomer = await db.select().from(customers).where(eq(customers.mobileNumber, customerData.mobileNumber)).limit(1);
            if (existingCustomer.length > 0) {
              skippedCount++;
              errors.push(`Customer with phone ${customerData.mobileNumber} already exists`);
              continue;
            }
            
            // Check if customer code already exists
            const existingCodeCustomer = await db.select().from(customers).where(eq(customers.customerCode, customerData.customerCode)).limit(1);
            if (existingCodeCustomer.length > 0) {
              // Generate new unique code
              const randomSuffix = Math.random().toString(36).substr(2, 8).toUpperCase();
              customerData.customerCode = `IMP-${randomSuffix}`;
            }
            
            await db.insert(customers).values(customerData);
            break;
          }
          default: {
            // Use tableMap for all other tables
            const targetTable = tableMap[category];
            if (targetTable) {
              await db.insert(targetTable).values(cleanRecord as any);
            } else {
              console.warn(`[Import] Unknown category: ${category}`);
              skippedCount++;
              continue;
            }
            break;
          }
        }
        importedCount++;
      } catch (recordError: any) {
        errors.push(`Record error: ${recordError.message}`);
        skippedCount++;
      }
    }

    return { success: true, importedCount, skippedCount, errors };
  } catch (error: any) {
    console.error('Error importing category data:', error);
    return { success: false, importedCount, skippedCount, errors: [error.message] };
  }
}

// Import all data (full restore) - COMPLETE DATABASE RESTORE
export async function importAllData(
  data: Record<string, Record<string, any>[]>,
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

  console.log('[Restore] Starting complete database restore...');
  console.log('[Restore] Tables to restore:', Object.keys(data).length);

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
      console.log(`[Restore] Importing ${category}: ${data[category].length} records...`);
      try {
        const result = await importCategoryData(category, data[category], overwrite);
        categoryResults[category] = {
          imported: result.importedCount,
          skipped: result.skippedCount,
          errors: result.errors
        };
        totalImported += result.importedCount;
        totalSkipped += result.skippedCount;
        console.log(`[Restore] ${category}: imported ${result.importedCount}, skipped ${result.skippedCount}`);
      } catch (error) {
        console.error(`[Restore] Error importing ${category}:`, error);
        categoryResults[category] = {
          imported: 0,
          skipped: data[category].length,
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
    }
  }

  console.log(`[Restore] Complete! Total imported: ${totalImported}, skipped: ${totalSkipped}`);

  return {
    success: totalImported > 0,
    totalImported,
    totalSkipped,
    categoryResults
  };
}


// ============ PURCHASE REQUESTS (Full Package Orders from Customer Portal) ============

// Generate unique request code


// Search tracking number in all order types (full_package, purchase_request, commission)
export async function searchTrackingInAllOrderTypes(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  // First check in fullPackageOrders (includes all three types) - use customers table
  const order = await db.select({
    order: fullPackageOrders,
    customer: customers
  })
    .from(fullPackageOrders)
    .leftJoin(customers, eq(fullPackageOrders.customerId, customers.id))
    .where(eq(fullPackageOrders.trackingNumber, trackingNumber))
    .limit(1);
  
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

// ============================================
// PERMISSIONS MANAGEMENT
// ============================================

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  return await database.select().from(permissions).where(eq(permissions.userId, userId));
}

/**
 * Get all sub-permissions for a user
 */
export async function getUserSubPermissions(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  return await database.select().from(subPermissions).where(eq(subPermissions.userId, userId));
}

/**
 * Check if user has a specific permission
 */
export async function checkUserPermission(
  userId: number,
  module: string,
  action: "view" | "create" | "edit" | "delete"
): Promise<boolean> {
  // Super admin has all permissions
  const user = await getUserById(userId);
  if (user?.role === "super_admin") {
    return true;
  }

  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const perm = await database
    .select()
    .from(permissions)
    .where(and(eq(permissions.userId, userId), eq(permissions.module, module)))
    .limit(1);

  if (perm.length === 0) {
    return false;
  }

  const permission = perm[0];
  switch (action) {
    case "view":
      return permission.canView;
    case "create":
      return permission.canCreate;
    case "edit":
      return permission.canEdit;
    case "delete":
      return permission.canDelete;
    default:
      return false;
  }
}

/**
 * Check if user has a specific sub-permission
 */
export async function checkUserSubPermission(
  userId: number,
  module: string,
  permissionKey: string
): Promise<boolean> {
  // Super admin has all permissions
  const user = await getUserById(userId);
  if (user?.role === "super_admin") {
    return true;
  }

  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const subPerm = await database
    .select()
    .from(subPermissions)
    .where(
      and(
        eq(subPermissions.userId, userId),
        eq(subPermissions.module, module),
        eq(subPermissions.permissionKey, permissionKey)
      )
    )
    .limit(1);

  return subPerm.length > 0 && subPerm[0].isAllowed;
}

/**
 * Set or update a user's permission for a module
 */
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
  
  const existing = await database
    .select()
    .from(permissions)
    .where(and(eq(permissions.userId, input.userId), eq(permissions.module, input.module)))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await database
      .update(permissions)
      .set({
        canView: input.canView,
        canCreate: input.canCreate,
        canEdit: input.canEdit,
        canDelete: input.canDelete,
        updatedAt: new Date(),
      })
      .where(eq(permissions.id, existing[0].id));

    return (await database.select().from(permissions).where(eq(permissions.id, existing[0].id)).limit(1))[0];
  } else {
    // Insert new
    await database.insert(permissions).values({
      userId: input.userId,
      module: input.module,
      canView: input.canView,
      canCreate: input.canCreate,
      canEdit: input.canEdit,
      canDelete: input.canDelete,
    });

    // Fetch the newly inserted record
    const inserted = await database
      .select()
      .from(permissions)
      .where(and(eq(permissions.userId, input.userId), eq(permissions.module, input.module)))
      .limit(1);
    
    return inserted[0];
  }
}

/**
 * Set or update a user's sub-permission
 */
export async function setUserSubPermission(input: {
  userId: number;
  module: string;
  permissionKey: string;
  isAllowed: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const existing = await database
    .select()
    .from(subPermissions)
    .where(
      and(
        eq(subPermissions.userId, input.userId),
        eq(subPermissions.module, input.module),
        eq(subPermissions.permissionKey, input.permissionKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await database
      .update(subPermissions)
      .set({
        isAllowed: input.isAllowed,
        updatedAt: new Date(),
      })
      .where(eq(subPermissions.id, existing[0].id));

    return (await database.select().from(subPermissions).where(eq(subPermissions.id, existing[0].id)).limit(1))[0];
  } else {
    // Insert new
    await database.insert(subPermissions).values({
      userId: input.userId,
      module: input.module,
      permissionKey: input.permissionKey,
      isAllowed: input.isAllowed,
    });

    // Fetch the newly inserted record
    const inserted = await database
      .select()
      .from(subPermissions)
      .where(
        and(
          eq(subPermissions.userId, input.userId),
          eq(subPermissions.module, input.module),
          eq(subPermissions.permissionKey, input.permissionKey)
        )
      )
      .limit(1);
    
    return inserted[0];
  }
}

/**
 * Bulk update user permissions
 */
export async function bulkUpdateUserPermissions(input: {
  userId: number;
  permissions: Array<{
    module: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
  subPermissions: Array<{
    module: string;
    permissionKey: string;
    isAllowed: boolean;
  }>;
}) {
  // Update all permissions
  for (const perm of input.permissions) {
    await setUserPermission({
      userId: input.userId,
      ...perm,
    });
  }

  // Update all sub-permissions
  for (const subPerm of input.subPermissions) {
    await setUserSubPermission({
      userId: input.userId,
      ...subPerm,
    });
  }

  return { success: true };
}

/**
 * Delete all permissions for a user
 */
export async function deleteUserPermissions(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.delete(permissions).where(eq(permissions.userId, userId));
  await database.delete(subPermissions).where(eq(subPermissions.userId, userId));
  return { success: true };
}


// ============ ADVANCED SETTINGS MANAGEMENT ============

/**
 * Get system setting by key
 */
export async function getSystemSetting(key: string) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [setting] = await database
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, key))
    .limit(1);
  
  return setting;
}

/**
 * Set system setting
 */
export async function setSystemSetting(data: {
  key: string;
  value: string;
  type?: string;
  description?: string;
  updatedById?: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const existing = await getSystemSetting(data.key);
  
  if (existing) {
    await database
      .update(systemSettings)
      .set({
        settingValue: data.value,
        settingType: data.type || existing.settingType,
        description: data.description || existing.description,
        updatedById: data.updatedById,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.settingKey, data.key));
  } else {
    await database.insert(systemSettings).values({
      settingKey: data.key,
      settingValue: data.value,
      settingType: data.type || "string",
      description: data.description,
      updatedById: data.updatedById,
    });
  }
  
  return await getSystemSetting(data.key);
}

/**
 * Get all system settings
 */
export async function getAllSystemSettings() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database.select().from(systemSettings);
}

// ============ CURRENCY MANAGEMENT ============

/**
 * Get all currencies
 */
export async function getAllCurrencies() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database.select().from(currencies).orderBy(desc(currencies.isBaseCurrency), currencies.name);
}

/**
 * Get active currencies
 */
export async function getActiveCurrencies() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database
    .select()
    .from(currencies)
    .where(eq(currencies.isActive, true))
    .orderBy(desc(currencies.isBaseCurrency), currencies.name);
}

/**
 * Create currency
 */
export async function createCurrency(data: {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: string;
  isBaseCurrency?: boolean;
  createdById?: number;
  createdByName?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [result] = await database.insert(currencies).values(data);
  return await database.select().from(currencies).where(eq(currencies.id, Number(result.insertId))).limit(1);
}

/**
 * Update currency
 */
export async function updateCurrency(id: number, data: Partial<{
  name: string;
  symbol: string;
  exchangeRate: string;
  isBaseCurrency: boolean;
  isActive: boolean;
}>) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.update(currencies).set(data).where(eq(currencies.id, id));
  return await database.select().from(currencies).where(eq(currencies.id, id)).limit(1);
}

/**
 * Delete currency
 */
export async function deleteCurrency(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.delete(currencies).where(eq(currencies.id, id));
  return { success: true };
}

// ============ TAX RATE MANAGEMENT ============

/**
 * Get all tax rates
 */
export async function getAllTaxRates() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database.select().from(taxRates).orderBy(desc(taxRates.isDefault), taxRates.name);
}

/**
 * Get active tax rates
 */
export async function getActiveTaxRates() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database
    .select()
    .from(taxRates)
    .where(eq(taxRates.isActive, true))
    .orderBy(desc(taxRates.isDefault), taxRates.name);
}

/**
 * Create tax rate
 */
export async function createTaxRate(data: {
  name: string;
  rate: string;
  isDefault?: boolean;
  description?: string;
  createdById?: number;
  createdByName?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [result] = await database.insert(taxRates).values(data);
  return await database.select().from(taxRates).where(eq(taxRates.id, Number(result.insertId))).limit(1);
}

/**
 * Update tax rate
 */
export async function updateTaxRate(id: number, data: Partial<{
  name: string;
  rate: string;
  isDefault: boolean;
  isActive: boolean;
  description: string;
}>) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.update(taxRates).set(data).where(eq(taxRates.id, id));
  return await database.select().from(taxRates).where(eq(taxRates.id, id)).limit(1);
}

/**
 * Delete tax rate
 */
export async function deleteTaxRate(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.delete(taxRates).where(eq(taxRates.id, id));
  return { success: true };
}

// ============ IP WHITELIST MANAGEMENT ============

/**
 * Get all IP whitelist entries
 */
export async function getAllIpWhitelist() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database.select().from(ipWhitelist).orderBy(desc(ipWhitelist.createdAt));
}

/**
 * Get active IP whitelist entries
 */
export async function getActiveIpWhitelist() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database
    .select()
    .from(ipWhitelist)
    .where(eq(ipWhitelist.isActive, true));
}

/**
 * Check if IP is whitelisted
 */
export async function isIpWhitelisted(ip: string) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [entry] = await database
    .select()
    .from(ipWhitelist)
    .where(and(eq(ipWhitelist.ipAddress, ip), eq(ipWhitelist.isActive, true)))
    .limit(1);
  
  return !!entry;
}

/**
 * Add IP to whitelist
 */
export async function addIpToWhitelist(data: {
  ipAddress: string;
  description?: string;
  createdById?: number;
  createdByName?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [result] = await database.insert(ipWhitelist).values(data);
  return await database.select().from(ipWhitelist).where(eq(ipWhitelist.id, Number(result.insertId))).limit(1);
}

/**
 * Remove IP from whitelist
 */
export async function removeIpFromWhitelist(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.delete(ipWhitelist).where(eq(ipWhitelist.id, id));
  return { success: true };
}

// ============ EMAIL TEMPLATE MANAGEMENT ============

/**
 * Get all email templates
 */
export async function getAllEmailTemplates() {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  return await database.select().from(emailTemplates).orderBy(emailTemplates.category, emailTemplates.name);
}

/**
 * Get email template by name
 */
export async function getEmailTemplateByName(name: string) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [template] = await database
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.name, name))
    .limit(1);
  
  return template;
}

/**
 * Create email template
 */
export async function createEmailTemplate(data: {
  name: string;
  subject: string;
  body: string;
  variables?: string;
  category: "notification" | "invoice" | "report" | "alert";
  createdById?: number;
  createdByName?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  const [result] = await database.insert(emailTemplates).values(data);
  return await database.select().from(emailTemplates).where(eq(emailTemplates.id, Number(result.insertId))).limit(1);
}

/**
 * Update email template
 */
export async function updateEmailTemplate(id: number, data: Partial<{
  subject: string;
  body: string;
  variables: string;
  isActive: boolean;
}>) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.update(emailTemplates).set(data).where(eq(emailTemplates.id, id));
  return await database.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
}

/**
 * Delete email template
 */
export async function deleteEmailTemplate(id: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  await database.delete(emailTemplates).where(eq(emailTemplates.id, id));
  return { success: true };
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
  
  const accounts = await db.select().from(customerAccounts);
  const issues: any[] = [];
  let validCount = 0;
  let invalidCount = 0;
  
  for (const account of accounts) {
    const validation = await validateAccountBalance(account.id);
    
    if (validation.isValid) {
      validCount++;
    } else {
      invalidCount++;
      
      // Get customer code
      const [customer] = await db.select().from(customers).where(eq(customers.id, account.customerId));
      
      issues.push({
        accountId: account.id,
        accountNumber: account.accountNumber,
        customerCode: customer?.customerCode || 'Unknown',
        storedBalance: validation.storedBalance,
        calculatedBalance: validation.calculatedBalance,
        difference: validation.difference
      });
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
      revenue: sql<number>`COALESCE(SUM(itemPriceUsd + commissionFeeUsd), 0)`,
      cost: sql<number>`COALESCE(SUM(itemPriceUsd), 0)`,
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
  
  const dateConditions: any[] = [];
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


// ============ ACTIVITY ALERTS ============

// Important actions that trigger alerts
const ALERT_TRIGGERS: Record<string, { severity: 'info' | 'warning' | 'critical'; titleKu: string }> = {
  // Critical actions
  'delete_customer': { severity: 'critical', titleKu: 'سڕینەوەی کڕیار' },
  'delete_package': { severity: 'critical', titleKu: 'سڕینەوەی پاکەت' },
  'delete_batch': { severity: 'critical', titleKu: 'سڕینەوەی باچ' },
  'delete_full_package_order': { severity: 'critical', titleKu: 'سڕینەوەی فول پاکیج' },
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
  'create_full_package_order': { severity: 'info', titleKu: 'دروستکردنی فول پاکیج' },
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
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const trigger = ALERT_TRIGGERS[data.action];
  if (!trigger && !data.customTitle) return; // Only create alerts for important actions
  
  const title = data.customTitle || trigger?.titleKu || data.action;
  const severity = trigger?.severity || 'info';
  
  const message = data.customMessage || 
    `${data.triggeredByName || 'بەکارهێنەر'} چالاکی "${title}" ئەنجامدا${data.entityCode ? ` بۆ ${data.entityCode}` : ''}`;
  
  try {
    await db.insert(activityAlerts).values({
      title,
      message,
      category: data.category as any,
      severity,
      entityType: data.entityType,
      entityId: data.entityId,
      entityCode: data.entityCode,
      auditLogId: data.auditLogId,
      action: data.action,
      triggeredById: data.triggeredById,
      triggeredByName: data.triggeredByName,
    });
  } catch (error) {
    console.error('Error creating activity alert:', error);
  }
}

export async function getActivityAlerts(options: {
  category?: string;
  severity?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: any[]; total: number; unreadCount: number }> {
  const db = await getDb();
  if (!db) return { alerts: [], total: 0, unreadCount: 0 };
  
  const conditions: any[] = [];
  if (options.category) conditions.push(eq(activityAlerts.category, options.category as any));
  if (options.severity) conditions.push(eq(activityAlerts.severity, options.severity as any));
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
  
  const conditions: any[] = [];
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
  
  const updateData: any = { ...data };
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
  messageType?: 'text' | 'image' | 'file' | 'system';
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
  
  const conditions: any[] = [eq(chatMessages.chatId, chatId)];
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
    console.error('Error creating pre-reset backup:', error);
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
    console.error('Error getting reset history:', error);
    return { resets: [], total: 0 };
  }
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


// ============================================
// Purchase Request Workflow Functions
// ============================================

// Get purchase request by tracking number
export async function getPurchaseRequestByTrackingNumber(trackingNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select()
    .from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.trackingNumber, trackingNumber),
      eq(fullPackageOrders.orderType, 'purchase_request')
    ))
    .limit(1);
  
  return result[0];
}

// Link purchase request to a package
export async function linkPurchaseRequestToPackage(purchaseRequestId: number, packageId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(fullPackageOrders)
    .set({
      notes: `Linked to package ${packageId}`,
      updatedAt: new Date()
    } as any)
    .where(eq(fullPackageOrders.id, purchaseRequestId));
}

// Update purchase request shipping and profit
export async function updatePurchaseRequestShippingAndProfit(
  purchaseRequestId: number, 
  shippingCostUsd: string, 
  profitUsd: string,
  userId: number
) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(fullPackageOrders)
    .set({
      shippingCostUsd,
      profitUsd,
      updatedAt: new Date()
    } as any)
    .where(eq(fullPackageOrders.id, purchaseRequestId));
}

// Respond to purchase request quote (customer approval/rejection)
export async function respondToPurchaseRequestQuote(
  purchaseRequestId: number,
  response: 'approved' | 'rejected',
  userId: number
) {
  const db = await getDb();
  if (!db) return;
  
  const newStatus = response === 'approved' ? 'approved' : 'cancelled';
  
  await db.update(fullPackageOrders)
    .set({
      status: newStatus as any,
      updatedAt: new Date()
    } as any)
    .where(eq(fullPackageOrders.id, purchaseRequestId));
}

// Update purchase request status
export async function updatePurchaseRequestStatus(
  purchaseRequestId: number,
  status: string,
  trackingNumber?: string,
  userId?: number
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: any = {
    status,
    updatedAt: new Date()
  };
  
  if (trackingNumber) {
    updateData.trackingNumber = trackingNumber;
  }
  
  if (userId) {
    updateData.updatedById = userId;
  }
  
  await db.update(fullPackageOrders)
    .set(updateData)
    .where(eq(fullPackageOrders.id, purchaseRequestId));
}

// Get purchase requests with filters
export async function getPurchaseRequests(filters?: {
  status?: string;
  customerId?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [eq(fullPackageOrders.orderType, 'purchase_request')];
  
  if (filters?.status) {
    conditions.push(eq(fullPackageOrders.status, filters.status as any));
  }
  
  if (filters?.customerId) {
    conditions.push(eq(fullPackageOrders.customerId, filters.customerId));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(fullPackageOrders.createdAt, filters.startDate));
  }
  
  if (filters?.endDate) {
    conditions.push(lte(fullPackageOrders.createdAt, filters.endDate));
  }
  
  const result = await db.select()
    .from(fullPackageOrders)
    .where(and(...conditions))
    .orderBy(desc(fullPackageOrders.createdAt));
  
  return result;
}

// Delete all ledger entries (alias for deleteAllLedgerTransactions)
export async function deleteAllLedgerEntries(): Promise<{ success: boolean; deletedCount: number }> {
  return deleteAllLedgerTransactions();
}


// ============================================
// COMPREHENSIVE P&L DASHBOARD FUNCTIONS
// ============================================

// Get batch profit breakdown by shipping type
export async function getBatchProfitByShippingType(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { air_regular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, air_irregular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 }, sea: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 } };
  
  // Get all batches in the period that have arrived or are closed
  const batchList = await db.select()
    .from(batches)
    .where(and(
      gte(batches.createdAt, startDate),
      lte(batches.createdAt, endDate)
    ));
  
  const result: Record<string, { revenue: number; cost: number; profit: number; count: number; totalWeight: number; totalCbm: number; batchCount: number }> = {
    air_regular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 },
    air_irregular: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 },
    sea: { revenue: 0, cost: 0, profit: 0, count: 0, totalWeight: 0, totalCbm: 0, batchCount: 0 },
  };
  
  for (const batch of batchList) {
    const type = batch.shippingType || 'air_regular';
    if (!result[type]) continue;
    
    result[type].batchCount++;
    result[type].cost += Number(batch.shippingCost || 0);
    result[type].totalWeight += Number(batch.actualWeightKg || batch.chargedWeightKg || batch.totalWeight || 0);
    result[type].totalCbm += Number(batch.actualCbm || batch.chargedCbm || 0);
    
    // Get all packages in this batch to calculate revenue (what customers paid)
    const batchPackages = await db.select()
      .from(packages)
      .where(eq(packages.batchId, batch.id));
    
    for (const pkg of batchPackages) {
      result[type].count++;
      result[type].revenue += Number(pkg.calculatedCostUsd || 0);
    }
    
    result[type].profit = result[type].revenue - result[type].cost;
  }
  
  return result;
}

// Get full package profit breakdown
export async function getFullPackageProfitBreakdown(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { fullPackage: { revenue: 0, cost: 0, shippingCost: 0, profit: 0, count: 0 }, commission: { totalCommission: 0, count: 0 } };
  
  // Full Package orders (resale)
  const fpOrders = await db.select()
    .from(fullPackageOrders)
    .where(and(
      gte(fullPackageOrders.createdAt, startDate),
      lte(fullPackageOrders.createdAt, endDate),
      eq(fullPackageOrders.orderType, 'full_package')
    ));
  
  const fullPackageData = {
    revenue: 0, cost: 0, shippingCost: 0, profit: 0, count: fpOrders.length,
  };
  
  for (const order of fpOrders) {
    const selling = Number(order.sellingPriceUsd || 0);
    const purchase = Number(order.purchasePriceUsd || 0);
    const shipping = Number(order.shippingCostUsd || 0);
    fullPackageData.revenue += selling;
    fullPackageData.cost += purchase;
    fullPackageData.shippingCost += shipping;
    fullPackageData.profit += (selling - purchase - shipping);
  }
  
  // Commission orders
  const commOrders = await db.select()
    .from(fullPackageOrders)
    .where(and(
      gte(fullPackageOrders.createdAt, startDate),
      lte(fullPackageOrders.createdAt, endDate),
      eq(fullPackageOrders.orderType, 'commission')
    ));
  
  const commissionData = {
    totalCommission: 0, count: commOrders.length,
  };
  
  for (const order of commOrders) {
    commissionData.totalCommission += Number(order.commissionFeeUsd || order.commissionAmount || 0);
  }
  
  return { fullPackage: fullPackageData, commission: commissionData };
}

// Get service profit breakdown
export async function getServiceProfitBreakdown(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { revenue: 0, cost: 0, profit: 0, count: 0, byType: [] as { typeId: number; typeName: string; revenue: number; cost: number; profit: number; count: number }[] };
  
  const services = await db.select()
    .from(extraServices)
    .where(and(
      gte(extraServices.createdAt, startDate),
      lte(extraServices.createdAt, endDate)
    ));
  
  const typeMap = new Map<number, { typeName: string; revenue: number; cost: number; profit: number; count: number }>();
  let totalRevenue = 0, totalCost = 0, totalProfit = 0;
  
  // Get service type names
  const types = await db.select().from(serviceTypes);
  const typeNameMap = new Map<number, string>();
  for (const t of types) {
    typeNameMap.set(t.id, t.nameKu || t.nameEn || `Service ${t.id}`);
  }
  
  for (const svc of services) {
    const revenue = Number(svc.priceAmount || 0);
    const cost = Number(svc.costAmount || 0);
    const profit = Number(svc.profitAmount || 0) || (revenue - cost);
    
    totalRevenue += revenue;
    totalCost += cost;
    totalProfit += profit;
    
    const existing = typeMap.get(svc.serviceTypeId) || { typeName: typeNameMap.get(svc.serviceTypeId) || '', revenue: 0, cost: 0, profit: 0, count: 0 };
    existing.revenue += revenue;
    existing.cost += cost;
    existing.profit += profit;
    existing.count++;
    typeMap.set(svc.serviceTypeId, existing);
  }
  
  return {
    revenue: totalRevenue,
    cost: totalCost,
    profit: totalProfit,
    count: services.length,
    byType: Array.from(typeMap.entries()).map(([typeId, data]) => ({ typeId, ...data })),
  };
}

// Get expense breakdown by category with names
export async function getExpenseBreakdownDetailed(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { categories: [] as { id: number; nameEn: string; nameKu: string; icon: string; color: string; amount: number; count: number; percentage: number }[], total: 0 };
  
  const expenseResult = await db.select({
    categoryId: expenses.categoryId,
    amount: sql<number>`SUM(${expenses.amountUsd})`,
    count: sql<number>`COUNT(*)`,
  })
    .from(expenses)
    .where(and(
      gte(expenses.expenseDate, startDate),
      lte(expenses.expenseDate, endDate)
    ))
    .groupBy(expenses.categoryId);
  
  // Get all categories
  const allCategories = await db.select().from(expenseCategories);
  const catMap = new Map<number, ExpenseCategory>();
  for (const cat of allCategories) {
    catMap.set(cat.id, cat);
  }
  
  let total = 0;
  const categories = expenseResult.map(e => {
    const amount = Number(e.amount || 0);
    total += amount;
    const cat = catMap.get(e.categoryId);
    return {
      id: e.categoryId,
      nameEn: cat?.nameEn || 'Other',
      nameKu: cat?.nameKu || 'تر',
      icon: cat?.icon || '📦',
      color: cat?.color || '#6B7280',
      amount,
      count: Number(e.count || 0),
      percentage: 0,
    };
  });
  
  // Calculate percentages
  for (const cat of categories) {
    cat.percentage = total > 0 ? (cat.amount / total) * 100 : 0;
  }
  
  // Sort by amount descending
  categories.sort((a, b) => b.amount - a.amount);
  
  return { categories, total };
}

// Get monthly trend data for charts
export async function getMonthlyTrendData(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [] as { month: string; revenue: number; expenses: number; netProfit: number }[];
  
  const months: { month: string; startDate: Date; endDate: Date }[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  
  while (current <= endDate) {
    const monthStart = new Date(current);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    months.push({
      month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
      startDate: monthStart,
      endDate: monthEnd > endDate ? endDate : monthEnd,
    });
    current.setMonth(current.getMonth() + 1);
  }
  
  const results = [];
  
  for (const m of months) {
    // Revenue: sum of all package charges + FP revenue + service revenue
    let revenue = 0;
    let expenseTotal = 0;
    
    // Package revenue (from ledger DEBIT entries)
    try {
      const txResult = await db.select({
        amount: sql<number>`SUM(${ledgerTransactions.amountUsd})`,
      })
        .from(ledgerTransactions)
        .where(and(
          gte(ledgerTransactions.createdAt, m.startDate),
          lte(ledgerTransactions.createdAt, m.endDate),
          sql`${ledgerTransactions.transactionType} LIKE 'DEBIT_%'`
        ));
      revenue += Number(txResult[0]?.amount || 0);
    } catch (e) { /* ignore */ }
    
    // Revenue records
    try {
      const revResult = await db.select({
        amount: sql<number>`SUM(${revenueRecords.amountUsd})`,
      })
        .from(revenueRecords)
        .where(and(
          gte(revenueRecords.createdAt, m.startDate),
          lte(revenueRecords.createdAt, m.endDate),
          eq(revenueRecords.status, 'confirmed')
        ));
      // Only add if ledger didn't already capture it
      if (revenue === 0) {
        revenue += Number(revResult[0]?.amount || 0);
      }
    } catch (e) { /* ignore */ }
    
    // Expenses
    try {
      const expResult = await db.select({
        amount: sql<number>`SUM(${expenses.amountUsd})`,
      })
        .from(expenses)
        .where(and(
          gte(expenses.expenseDate, m.startDate),
          lte(expenses.expenseDate, m.endDate)
        ));
      expenseTotal = Number(expResult[0]?.amount || 0);
    } catch (e) { /* ignore */ }
    
    results.push({
      month: m.month,
      revenue,
      expenses: expenseTotal,
      netProfit: revenue - expenseTotal,
    });
  }
  
  return results;
}

// Get activity stats for dashboard
export async function getActivityStats(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { packagesDelivered: 0, fullPackagesSold: 0, commissionOrders: 0, invoicesIssued: 0, paymentsReceived: 0, servicesCompleted: 0, totalCustomers: 0 };
  
  // Packages delivered
  let packagesDelivered = 0;
  try {
    const pkgResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(packages)
      .where(and(
        eq(packages.status, 'delivered'),
        gte(packages.deliveredAt, startDate),
        lte(packages.deliveredAt, endDate)
      ));
    packagesDelivered = Number(pkgResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  // Full packages sold
  let fullPackagesSold = 0;
  try {
    const fpResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'full_package'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      ));
    fullPackagesSold = Number(fpResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  // Commission orders
  let commissionOrders = 0;
  try {
    const commResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(fullPackageOrders)
      .where(and(
        eq(fullPackageOrders.orderType, 'commission'),
        gte(fullPackageOrders.createdAt, startDate),
        lte(fullPackageOrders.createdAt, endDate)
      ));
    commissionOrders = Number(commResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  // Invoices issued
  let invoicesIssued = 0;
  try {
    const invResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(and(
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate)
      ));
    invoicesIssued = Number(invResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  // Payments received
  let paymentsReceived = 0;
  try {
    const payResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(paymentRecords)
      .where(and(
        gte(paymentRecords.createdAt, startDate),
        lte(paymentRecords.createdAt, endDate)
      ));
    paymentsReceived = Number(payResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  // Services completed
  let servicesCompleted = 0;
  try {
    const svcResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(extraServices)
      .where(and(
        gte(extraServices.createdAt, startDate),
        lte(extraServices.createdAt, endDate)
      ));
    servicesCompleted = Number(svcResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  // Total active customers
  let totalCustomers = 0;
  try {
    const custResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(customers)
      .where(eq(customers.isActive, true));
    totalCustomers = Number(custResult[0]?.count || 0);
  } catch (e) { /* ignore */ }
  
  return { packagesDelivered, fullPackagesSold, commissionOrders, invoicesIssued, paymentsReceived, servicesCompleted, totalCustomers };
}

// Comprehensive dashboard stats (replaces old dashboardStats)
export async function getComprehensiveDashboardStats(startDate: Date, endDate: Date) {
  const [batchProfit, fpProfit, serviceProfit, expenseBreakdown, monthlyTrend, activity] = await Promise.all([
    getBatchProfitByShippingType(startDate, endDate),
    getFullPackageProfitBreakdown(startDate, endDate),
    getServiceProfitBreakdown(startDate, endDate),
    getExpenseBreakdownDetailed(startDate, endDate),
    getMonthlyTrendData(startDate, endDate),
    getActivityStats(startDate, endDate),
  ]);
  
  // Calculate total revenue from all sources
  const batchRevenue = (batchProfit.air_regular?.profit || 0) + (batchProfit.air_irregular?.profit || 0) + (batchProfit.sea?.profit || 0);
  const fpRevenue = fpProfit.fullPackage.profit;
  const commissionRevenue = fpProfit.commission.totalCommission;
  const serviceRevenue = serviceProfit.profit;
  
  const totalGrossRevenue = batchRevenue + fpRevenue + commissionRevenue + serviceRevenue;
  const totalExpenses = expenseBreakdown.total;
  const netProfit = totalGrossRevenue - totalExpenses;
  const profitMargin = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;
  
  return {
    // Revenue by source
    revenueBySource: {
      batchProfit: {
        air_regular: batchProfit.air_regular,
        air_irregular: batchProfit.air_irregular,
        sea: batchProfit.sea,
        total: batchRevenue,
      },
      fullPackage: {
        ...fpProfit.fullPackage,
      },
      commission: {
        ...fpProfit.commission,
      },
      service: {
        ...serviceProfit,
      },
      totalRevenue: totalGrossRevenue,
    },
    
    // Expenses
    expenseBreakdown,
    
    // P&L Summary
    profitLoss: {
      totalRevenue: totalGrossRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      isProfit: netProfit >= 0,
    },
    
    // Monthly trend
    monthlyTrend,
    
    // Activity
    activity,
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


// ============ DELETE STAFF USER ============
export async function deleteStaffUser(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database connection failed");
  
  // Delete user permissions first (foreign key)
  try {
    await deleteUserPermissions(userId);
  } catch (e) {
    // Permissions may not exist, that's ok
  }
  
  // Delete the user
  await database.delete(users).where(eq(users.id, userId));
  return { success: true };
}

