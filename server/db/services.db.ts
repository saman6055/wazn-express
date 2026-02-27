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
  batchLabelTemplates, InsertBatchLabelTemplate, BatchLabelTemplate,
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

// ============ PRODUCT CATEGORIES (جۆرەکانی کاڵا) ============

/** Fallback when productCategories table lacks sortOrder/icon/color columns (old schema) */
async function getAllProductCategoriesFallback(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<ProductCategory[]> {
  const [rows] = (await db.execute(
    sql`SELECT id, nameEn, nameAr, nameKu, isActive, createdAt, updatedAt FROM productCategories ORDER BY id`
  )) as unknown as [Record<string, unknown>[]];
  return (rows ?? []).map((row) => ({
    id: Number(row.id),
    nameEn: String(row.nameEn ?? ""),
    nameAr: row.nameAr != null ? String(row.nameAr) : null,
    nameKu: row.nameKu != null ? String(row.nameKu) : null,
    icon: null,
    color: null,
    sortOrder: 0,
    isActive: Boolean(row.isActive ?? true),
    createdById: null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  })) as ProductCategory[];
}

export async function getAllProductCategories(): Promise<ProductCategory[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select()
      .from(productCategories)
      .orderBy(productCategories.sortOrder);
  } catch {
    return getAllProductCategoriesFallback(db);
  }
}

export async function getActiveProductCategories(): Promise<ProductCategory[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select()
      .from(productCategories)
      .where(eq(productCategories.isActive, true))
      .orderBy(productCategories.sortOrder);
  } catch {
    const [rows] = (await db.execute(
      sql`SELECT id, nameEn, nameAr, nameKu, isActive, createdAt, updatedAt FROM productCategories WHERE isActive = 1 ORDER BY id`
    )) as unknown as [Record<string, unknown>[]];
    return (rows ?? []).map((row) => ({
      id: Number(row.id),
      nameEn: String(row.nameEn ?? ""),
      nameAr: row.nameAr != null ? String(row.nameAr) : null,
      nameKu: row.nameKu != null ? String(row.nameKu) : null,
      icon: null,
      color: null,
      sortOrder: 0,
      isActive: true,
      createdById: null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    })) as ProductCategory[];
  }
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


// ============ SERVICE TYPES (جۆرەکانی خزمەتگوزاری) ============

/** Map raw row (old schema) to ServiceType shape for API */
function mapRowToServiceType(row: Record<string, unknown>): ServiceType {
  return {
    id: Number(row.id),
    nameEn: String(row.nameEn ?? ""),
    nameKu: row.nameKu != null ? String(row.nameKu) : null,
    nameAr: row.nameAr != null ? String(row.nameAr) : null,
    icon: row.icon != null ? String(row.icon) : null,
    color: row.color != null ? String(row.color) : null,
    defaultCost: row.defaultCost != null ? String(row.defaultCost) : null,
    defaultPrice: row.defaultPrice != null ? String(row.defaultPrice) : row.basePrice != null ? String(row.basePrice) : null,
    requiresCustomer: row.requiresCustomer != null ? Boolean(row.requiresCustomer) : true,
    addToCustomerBalance: row.addToCustomerBalance != null ? Boolean(row.addToCustomerBalance) : true,
    sortOrder: row.sortOrder != null ? Number(row.sortOrder) : 0,
    isActive: Boolean(row.isActive ?? true),
    createdById: row.createdById != null ? Number(row.createdById) : null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

/** Fallback when serviceTypes table has old schema (no sortOrder etc.) */
async function getAllServiceTypesFallback(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<ServiceType[]> {
  const [rows] = (await db.execute(
    sql`SELECT id, nameEn, nameKu, nameAr, isActive, createdAt, updatedAt FROM serviceTypes ORDER BY id`
  )) as unknown as [Record<string, unknown>[]];
  return (rows ?? []).map(mapRowToServiceType);
}

export async function getAllServiceTypes(): Promise<ServiceType[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(serviceTypes).orderBy(serviceTypes.sortOrder);
  } catch {
    return getAllServiceTypesFallback(db);
  }
}

export async function getActiveServiceTypes(): Promise<ServiceType[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(serviceTypes)
      .where(eq(serviceTypes.isActive, true))
      .orderBy(serviceTypes.sortOrder);
  } catch {
    const [rows] = (await db.execute(
      sql`SELECT id, nameEn, nameKu, nameAr, isActive, createdAt, updatedAt FROM serviceTypes WHERE isActive = 1 ORDER BY id`
    )) as unknown as [Record<string, unknown>[]];
    return (rows ?? []).map(mapRowToServiceType);
  }
}

export async function getServiceTypeById(id: number): Promise<ServiceType | null> {
  const db = await getDb();
  if (!db) return null;
  const [type] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
  return type || null;
}

/** Minimal insert for old serviceTypes table (only base columns) */
async function createServiceTypeFallback(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  data: InsertServiceType
): Promise<ServiceType> {
  const insertResult = (await db.execute(
    sql`INSERT INTO serviceTypes (nameEn, nameKu, nameAr, isActive, createdAt, updatedAt) VALUES (${data.nameEn}, ${data.nameKu ?? null}, ${data.nameAr ?? null}, ${data.isActive ?? true}, NOW(), NOW())`
  )) as unknown as [{ insertId: number }, unknown];
  const insertId = Number(insertResult[0]?.insertId);
  if (!insertId) throw new Error("Insert failed");
  const [rows] = (await db.execute(
    sql`SELECT * FROM serviceTypes WHERE id = ${insertId}`
  )) as unknown as [Record<string, unknown>[]];
  const row = Array.isArray(rows) ? rows[0] : rows;
  return mapRowToServiceType((row ?? {}) as Record<string, unknown>);
}

/** Ensure serviceTypes table has all required columns (auto-migration) */
async function ensureServiceTypeColumns(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<void> {
  const columns = ['icon', 'color', 'defaultCost', 'defaultPrice', 'requiresCustomer', 'addToCustomerBalance', 'sortOrder', 'createdById'];
  for (const col of columns) {
    try {
      await db.execute(sql`SELECT ${sql.raw(col)} FROM serviceTypes LIMIT 0`);
    } catch {
      // Column doesn't exist - add it
      const alterSql = col === 'icon' ? `ALTER TABLE serviceTypes ADD COLUMN icon VARCHAR(50)` :
        col === 'color' ? `ALTER TABLE serviceTypes ADD COLUMN color VARCHAR(20)` :
        col === 'defaultCost' ? `ALTER TABLE serviceTypes ADD COLUMN defaultCost DECIMAL(10,2)` :
        col === 'defaultPrice' ? `ALTER TABLE serviceTypes ADD COLUMN defaultPrice DECIMAL(10,2)` :
        col === 'requiresCustomer' ? `ALTER TABLE serviceTypes ADD COLUMN requiresCustomer BOOLEAN NOT NULL DEFAULT TRUE` :
        col === 'addToCustomerBalance' ? `ALTER TABLE serviceTypes ADD COLUMN addToCustomerBalance BOOLEAN NOT NULL DEFAULT TRUE` :
        col === 'sortOrder' ? `ALTER TABLE serviceTypes ADD COLUMN sortOrder INT NOT NULL DEFAULT 0` :
        col === 'createdById' ? `ALTER TABLE serviceTypes ADD COLUMN createdById INT` : null;
      if (alterSql) {
        try { await db.execute(sql.raw(alterSql)); } catch { /* already exists or other issue */ }
      }
    }
  }
}

let _serviceTypeColumnsEnsured = false;

export async function createServiceType(data: InsertServiceType): Promise<ServiceType> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Auto-migrate columns on first call
  if (!_serviceTypeColumnsEnsured) {
    try {
      await ensureServiceTypeColumns(db);
      _serviceTypeColumnsEnsured = true;
    } catch { /* non-fatal */ }
  }

  try {
    const result = await db.insert(serviceTypes).values(data);
    const insertId = Number(result[0].insertId);
    const [type] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, insertId));
    if (type) return type;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUnknownColumn =
      /Unknown column|ER_BAD_FIELD_ERROR|doesn't exist/.test(msg);
    if (isUnknownColumn) {
      return createServiceTypeFallback(db, data);
    }
    throw err;
  }
  throw new Error("Failed to create service type");
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
  const updateData: Record<string, unknown> = { ...data };
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

// ============ BATCH LABEL TEMPLATES (تێمپلەیتی لەیبڵی باچ) ============
export async function getBatchLabelTemplates(): Promise<BatchLabelTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(batchLabelTemplates).orderBy(batchLabelTemplates.name);
  } catch {
    return [];
  }
}

export async function getBatchLabelTemplateById(id: number): Promise<BatchLabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(batchLabelTemplates).where(eq(batchLabelTemplates.id, id));
    return result[0] || null;
  } catch {
    return null;
  }
}

export async function getDefaultBatchLabelTemplate(): Promise<BatchLabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(batchLabelTemplates).where(eq(batchLabelTemplates.isDefault, true));
    return result[0] || null;
  } catch {
    return null;
  }
}

export async function createBatchLabelTemplate(data: InsertBatchLabelTemplate): Promise<BatchLabelTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(batchLabelTemplates).values(data);
  return getBatchLabelTemplateById(result.insertId) as Promise<BatchLabelTemplate>;
}

export async function updateBatchLabelTemplate(id: number, data: Partial<InsertBatchLabelTemplate>): Promise<BatchLabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(batchLabelTemplates).set({ ...data, updatedAt: new Date() }).where(eq(batchLabelTemplates.id, id));
  return getBatchLabelTemplateById(id);
}

export async function deleteBatchLabelTemplate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(batchLabelTemplates).where(eq(batchLabelTemplates.id, id));
  return true;
}

export async function setDefaultBatchLabelTemplate(id: number): Promise<BatchLabelTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(batchLabelTemplates).set({ isDefault: false }).where(eq(batchLabelTemplates.isDefault, true));
  await db.update(batchLabelTemplates).set({ isDefault: true, updatedAt: new Date() }).where(eq(batchLabelTemplates.id, id));
  return getBatchLabelTemplateById(id);
}

export async function ensureDefaultBatchLabelTemplate(): Promise<BatchLabelTemplate> {
  const existing = await getDefaultBatchLabelTemplate();
  if (existing) return existing;
  return createBatchLabelTemplate({
    name: "تێمپلەیتی بنەڕەتی لەیبڵی باچ",
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
    showCustomerName: true,
    showCustomerCode: true,
    showTotalPackages: true,
    showTotalWeight: true,
    showTotalVolume: true,
    showTotalPrice: true,
    showBatchNumber: true,
    showDate: true,
    primaryColor: "#059669",
    fontFamily: "Arial",
    fontSize: 12,
  });
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

