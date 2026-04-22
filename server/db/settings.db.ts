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
  expenseAlertLogs, InsertExpenseAlertLog, ExpenseAlertLog,
  portalPriceListSettings, InsertPortalPriceListSettings, PortalPriceListSettings
} from "../../drizzle/schema";

// ============ COUNTRY OPERATIONS ============

export async function createCountry(data: InsertCountry): Promise<Country> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(countries).values(data);
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any)?.insertId;
  if (insertId == null) throw new Error("Failed to get insert ID after country creation");
  const inserted = await db.select().from(countries).where(eq(countries.id, Number(insertId))).limit(1);
  const row = inserted[0];
  if (!row) throw new Error("Country created but could not be retrieved");
  return row;
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
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any)?.insertId;
  if (insertId == null) throw new Error("Failed to get insert ID after warehouse creation");
  const inserted = await db.select().from(warehouses).where(eq(warehouses.id, Number(insertId))).limit(1);
  const row = inserted[0];
  if (!row) throw new Error("Warehouse created but could not be retrieved");
  return row;
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


// ============ SYSTEM SETTINGS OPERATIONS ============

export async function getSetting(key: string): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
    return result[0]?.settingValue ?? null;
  } catch {
    return null;
  }
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


// ============ PORTAL PRICE LIST (لیستی نرخی پۆرتاڵ) ============
// The settings table is single-row by convention (id=1 seeded by migration).
// If for some reason the row is missing we lazily create one with defaults so
// the portal never renders against a null config.

const DEFAULT_PORTAL_PRICE_LIST_SETTINGS: Omit<PortalPriceListSettings, "id" | "updatedAt" | "updatedById"> = {
  isEnabled: true,
  titleKu: "لیستی نرخی خزمەتگوزاری",
  titleEn: "Price List",
  titleAr: "قائمة الأسعار",
  titleZh: "价格表",
  subtitleKu: "نرخە نوێکراوەکانی گواستنەوە و خزمەتگوزاری",
  subtitleEn: "Up-to-date shipping & service rates",
  subtitleAr: "أحدث أسعار الشحن والخدمات",
  subtitleZh: "最新运费和服务价格",
  showShippingRates: true,
  showServices: true,
  showRmbEquivalent: true,
  showIqdEquivalent: false,
  layoutVariant: "tabs",
  position: "belowHeader",
  accentColor: "purple",
  disclaimerKu: "ئەم نرخانە ڕێنماییکارن و لەوانەیە بەپێی کێش، قەبارە و وڵاتی مەبەست بگۆڕێن.",
  disclaimerEn: "These rates are indicative and may vary based on weight, volume and destination.",
  disclaimerAr: "هذه الأسعار تقريبية وقد تختلف حسب الوزن والحجم والوجهة.",
  disclaimerZh: "以上价格为参考价格，可能因重量、体积和目的地而异。",
};

export async function getPortalPriceListSettings(): Promise<PortalPriceListSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(portalPriceListSettings).limit(1);
  if (row) return row;
  // Lazy-seed if the migration has not run (or the row was wiped manually).
  await db.insert(portalPriceListSettings).values(DEFAULT_PORTAL_PRICE_LIST_SETTINGS);
  const [inserted] = await db.select().from(portalPriceListSettings).limit(1);
  return inserted ?? null;
}

export async function updatePortalPriceListSettings(
  data: Partial<InsertPortalPriceListSettings>,
  updatedById: number,
): Promise<PortalPriceListSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await getPortalPriceListSettings();
  if (!existing) return null;
  await db.update(portalPriceListSettings)
    .set({ ...data, updatedById })
    .where(eq(portalPriceListSettings.id, existing.id));
  const [updated] = await db.select().from(portalPriceListSettings)
    .where(eq(portalPriceListSettings.id, existing.id)).limit(1);
  return updated ?? null;
}

/**
 * Portal-facing pricing rules — only rows the admin has explicitly opted into
 * showing on the customer portal. Filters out expired rules as of `now`.
 */
export async function getPortalShippingRates() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  try {
    return await db.select().from(pricingRules).where(
      and(
        eq(pricingRules.showOnPortal, true),
        eq(pricingRules.isActive, true),
        lte(pricingRules.effectiveFrom, now),
        or(isNull(pricingRules.effectiveTo), gte(pricingRules.effectiveTo, now)),
      )
    ).orderBy(asc(pricingRules.portalSortOrder), asc(pricingRules.shippingType));
  } catch {
    // If the new columns haven't migrated yet we silently return empty so the
    // portal renders a "coming soon" state instead of crashing.
    return [];
  }
}

/**
 * Admin-facing list of ALL pricing rules with portal metadata, regardless of
 * visibility or active state — used by the settings page to let admins toggle
 * and curate.
 */
export async function getPricingRulesWithPortalMeta() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pricingRules).orderBy(asc(pricingRules.portalSortOrder), desc(pricingRules.effectiveFrom));
}

/**
 * Patch ONLY the portal-display fields on a pricing rule. Does not touch
 * pricePerUnit / effectiveFrom / shippingType etc. — those flow through the
 * existing updatePricingRule path with audit logging.
 */
export async function updatePricingRulePortalFields(
  id: number,
  fields: {
    showOnPortal?: boolean;
    portalLabelKu?: string | null;
    portalLabelEn?: string | null;
    portalLabelAr?: string | null;
    portalLabelZh?: string | null;
    portalIcon?: string | null;
    portalColor?: string | null;
    portalBadge?: string | null;
    portalSortOrder?: number;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(pricingRules).set(fields).where(eq(pricingRules.id, id));
}

