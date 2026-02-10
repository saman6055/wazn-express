import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

// ============ USERS (Staff Only: Admin, Employee, Accountant) ============

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // For Manus OAuth (optional)
  username: varchar("username", { length: 100 }).unique(), // For username/password login
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }), // "manus", "mobile", or "username"
  role: mysqlEnum("role", ["super_admin", "admin", "employee", "accountant"]).default("employee").notNull(),
  
  // Staff login fields
  mobileNumber: varchar("mobileNumber", { length: 20 }).unique(), // For mobile login
  passwordHash: varchar("passwordHash", { length: 255 }), // For mobile or username login
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdById: int("createdById"), // Who created this staff user
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ CUSTOMERS (Staff-created only) ============

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  customerCode: varchar("customerCode", { length: 100 }).notNull().unique(), // AZ{number}(Name)
  sequenceNumber: int("sequenceNumber").notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  fullNameArabic: varchar("fullNameArabic", { length: 255 }),
  fullNameKurdish: varchar("fullNameKurdish", { length: 255 }),
  gender: mysqlEnum("gender", ["male", "female"]),
  nationality: varchar("nationality", { length: 100 }),
  businessType: varchar("businessType", { length: 100 }),
  mobileNumber: varchar("mobileNumber", { length: 20 }).notNull().unique(),
  secondaryMobile: varchar("secondaryMobile", { length: 20 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  district: varchar("district", { length: 100 }),
  address: text("address"),
  passportUrl: text("passportUrl"),
  nationalIdUrl: text("nationalIdUrl"),
  contractUrl: text("contractUrl"),
  goodsTypePreferences: json("goodsTypePreferences").$type<string[]>(),
  shippingTypePreferences: json("shippingTypePreferences").$type<string[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  linkedUserId: int("linkedUserId"), // Optional link to OAuth user for portal access
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============ COUNTRIES (Dynamic) ============

export const countries = mysqlTable("countries", {
  id: int("id").autoincrement().primaryKey(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }),
  nameKu: varchar("nameKu", { length: 100 }),
  nameZh: varchar("nameZh", { length: 100 }),
  nameTr: varchar("nameTr", { length: 100 }),
  nameFa: varchar("nameFa", { length: 100 }),
  isoCode: varchar("isoCode", { length: 3 }).notNull().unique(),
  defaultCurrency: varchar("defaultCurrency", { length: 3 }),
  isActive: boolean("isActive").default(true).notNull(),
  isOrigin: boolean("isOrigin").default(false).notNull(),
  isDestination: boolean("isDestination").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Country = typeof countries.$inferSelect;
export type InsertCountry = typeof countries.$inferInsert;

// ============ WAREHOUSES (Data-driven) ============

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  nameEn: varchar("nameEn", { length: 200 }).notNull(),
  nameAr: varchar("nameAr", { length: 200 }),
  nameKu: varchar("nameKu", { length: 200 }),
  nameZh: varchar("nameZh", { length: 200 }),
  nameTr: varchar("nameTr", { length: 200 }),
  nameFa: varchar("nameFa", { length: 200 }),
  countryId: int("countryId").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  addressEn: text("addressEn"),
  addressAr: text("addressAr"),
  addressKu: text("addressKu"),
  warehouseType: mysqlEnum("warehouseType", ["air", "sea", "custom"]).notNull(),
  codePrefix: varchar("codePrefix", { length: 10 }).notNull(),
  expectedDeliveryMin: int("expectedDeliveryMin"), // days
  expectedDeliveryMax: int("expectedDeliveryMax"), // days
  pricingModel: mysqlEnum("pricingModel", ["per_kg", "per_cbm"]).notNull(),
  contactInfo: text("contactInfo"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = typeof warehouses.$inferInsert;

// ============ PRICING RULES (Dynamic) ============

export const pricingRules = mysqlTable("pricingRules", {
  id: int("id").autoincrement().primaryKey(),
  originCountryId: int("originCountryId").notNull(),
  originWarehouseId: int("originWarehouseId"), // optional
  destinationCountryId: int("destinationCountryId").notNull(),
  shippingType: mysqlEnum("shippingType", ["air_regular", "air_irregular", "sea"]).notNull(),
  pricePerUnit: decimal("pricePerUnit", { precision: 10, scale: 2 }).notNull(), // USD
  unit: mysqlEnum("unit", ["kg", "cbm"]).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = typeof pricingRules.$inferInsert;

// ============ BATCHES (Shipment Groups) ============

export const batches = mysqlTable("batches", {
  id: int("id").autoincrement().primaryKey(),
  batchCode: varchar("batchCode", { length: 50 }).notNull().unique(),
  originWarehouseId: int("originWarehouseId").notNull(),
  destinationCountryId: int("destinationCountryId").notNull(),
  shippingType: mysqlEnum("shippingType", ["air_regular", "air_irregular", "sea"]).notNull(),
  carrierInfo: varchar("carrierInfo", { length: 255 }), // airline/container
  // Detailed shipping info
  airlineName: varchar("airlineName", { length: 100 }), // e.g., Turkish Airlines, Qatar Airways
  flightNumber: varchar("flightNumber", { length: 50 }), // e.g., TK123
  shippingCompany: varchar("shippingCompany", { length: 100 }), // Shipping/logistics company name
  containerNumber: varchar("containerNumber", { length: 50 }), // For sea shipping
  vesselName: varchar("vesselName", { length: 100 }), // Ship name for sea shipping
  shippingCost: decimal("shippingCost", { precision: 12, scale: 2 }), // Total cost we pay to carrier
  departureDate: timestamp("departureDate"),
  estimatedArrival: timestamp("estimatedArrival"),
  actualArrival: timestamp("actualArrival"),
  status: mysqlEnum("status", ["preparing", "in_transit", "arrived", "customs", "delivered", "closed"]).default("preparing").notNull(),
  totalPackages: int("totalPackages").default(0).notNull(),
  totalWeight: decimal("totalWeight", { precision: 10, scale: 2 }),
  
  // Actual measurements (real weight/volume)
  actualWeightKg: decimal("actualWeightKg", { precision: 10, scale: 2 }),
  actualCbm: decimal("actualCbm", { precision: 10, scale: 4 }),
  
  // Charged measurements (what we pay for)
  chargedWeightKg: decimal("chargedWeightKg", { precision: 10, scale: 2 }),
  chargedCbm: decimal("chargedCbm", { precision: 10, scale: 4 }),
  
  // Cost fields (our cost from supplier)
  costPerKg: decimal("costPerKg", { precision: 10, scale: 2 }), // Our cost per KG
  costPerCbm: decimal("costPerCbm", { precision: 10, scale: 2 }), // Our cost per CBM
  
  // Selling price fields - default price per batch
  pricePerKg: decimal("pricePerKg", { precision: 10, scale: 2 }), // Default selling price per KG (for air_regular)
  pricePerCbm: decimal("pricePerCbm", { precision: 10, scale: 2 }), // Default selling price per CBM
  
  // Tiered pricing flag
  useTieredPricing: boolean("useTieredPricing").default(false).notNull(), // True for air_irregular and sea
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

// ============ PACKAGES ============

export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  packageCode: varchar("packageCode", { length: 50 }).notNull().unique(),
  trackingNumber: varchar("trackingNumber", { length: 100 }).unique(),
  customerId: int("customerId"), // Nullable for unclaimed packages
  originWarehouseId: int("originWarehouseId").notNull(),
  batchId: int("batchId"),
  fullPackageOrderId: int("fullPackageOrderId"), // Link to full package order if applicable
  packageOwnership: mysqlEnum("packageOwnership", ["customer", "company"]).default("customer").notNull(), // Who owns the package
  categoryId: int("categoryId"), // Product category (clothing, medical, shoes, etc.)
  isUnclaimed: boolean("isUnclaimed").default(false).notNull(), // True if package has no owner yet
  claimedAt: timestamp("claimedAt"), // When the package was claimed by a customer
  claimedById: int("claimedById"), // Staff who assigned the customer
  qrCodeData: text("qrCodeData"), // signed QR data
  qrCodeSignature: varchar("qrCodeSignature", { length: 255 }),
  weightKg: decimal("weightKg", { precision: 10, scale: 3 }),
  lengthCm: decimal("lengthCm", { precision: 10, scale: 2 }),
  widthCm: decimal("widthCm", { precision: 10, scale: 2 }),
  heightCm: decimal("heightCm", { precision: 10, scale: 2 }),
  volumeCbm: decimal("volumeCbm", { precision: 10, scale: 6 }),
  shippingType: mysqlEnum("shippingType", ["air_regular", "air_irregular", "sea"]).notNull(),
  description: text("description"),
  photos: json("photos").$type<string[]>(),
  calculatedCostUsd: decimal("calculatedCostUsd", { precision: 10, scale: 2 }),
  appliedPricingRuleId: int("appliedPricingRuleId"),
  isCharged: boolean("isCharged").default(false).notNull(), // Whether delivery charge has been applied
  deliveryType: mysqlEnum("deliveryType", ["air_transit", "warehouse_pickup", "direct_delivery"]), // How package was delivered
  status: mysqlEnum("status", [
    "registered",
    "in_batch",
    "in_transit",
    "customs_processing",
    "ready_for_delivery",
    "out_for_delivery",
    "delivered",
    "returned",
    "cancelled"
  ]).default("registered").notNull(),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  registeredById: int("registeredById").notNull(),
  deliveredAt: timestamp("deliveredAt"),
  deliveredById: int("deliveredById"),
  recipientName: varchar("recipientName", { length: 255 }),
  recipientSignature: text("recipientSignature"),
  deliveryPhoto: text("deliveryPhoto"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

// ============ LEDGER ENTRIES - REMOVED ============
// The ledgerEntries table has been completely removed.
// All financial transactions now use the unified ledgerTransactions table.
// See ledgerTransactions table below for the new unified financial system.

// ============ INVOICES ============

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  packageId: int("packageId"),
  batchId: int("batchId"),
  subtotalUsd: decimal("subtotalUsd", { precision: 12, scale: 2 }).notNull(),
  taxUsd: decimal("taxUsd", { precision: 12, scale: 2 }).default("0"),
  totalUsd: decimal("totalUsd", { precision: 12, scale: 2 }).notNull(),
  exchangeRateIqd: decimal("exchangeRateIqd", { precision: 12, scale: 2 }),
  exchangeRateRmb: decimal("exchangeRateRmb", { precision: 12, scale: 6 }),
  totalIqd: decimal("totalIqd", { precision: 15, scale: 0 }),
  totalRmb: decimal("totalRmb", { precision: 12, scale: 2 }),
  status: mysqlEnum("status", ["draft", "issued", "paid", "partially_paid", "cancelled", "refunded"]).default("draft").notNull(),
  issuedAt: timestamp("issuedAt"),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  pdfUrl: text("pdfUrl"),
  lineItems: json("lineItems").$type<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[]>(),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ============ EXCHANGE RATES ============

export const exchangeRates = mysqlTable("exchangeRates", {
  id: int("id").autoincrement().primaryKey(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull().default("USD"),
  targetCurrency: varchar("targetCurrency", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 15, scale: 6 }).notNull(),
  source: varchar("source", { length: 50 }), // api, manual
  isManualOverride: boolean("isManualOverride").default(false).notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  effectiveTo: timestamp("effectiveTo"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

// ============ AUDIT LOGS ============

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }), // Cached user name for display
  userRole: varchar("userRole", { length: 20 }),
  action: varchar("action", { length: 100 }).notNull(), // create, update, delete, status_change, charge, payment, etc.
  actionLabel: varchar("actionLabel", { length: 255 }), // Human-readable action description
  category: mysqlEnum("category", ["customer", "package", "batch", "full_package", "purchase_request", "commission", "finance", "settings", "user", "system"]).default("system").notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // Package, Customer, FullPackageOrder, etc.
  entityId: int("entityId"),
  entityCode: varchar("entityCode", { length: 100 }), // Human-readable code (e.g., AZ0001, FP-ABC123)
  oldValues: json("oldValues").$type<Record<string, any>>(),
  newValues: json("newValues").$type<Record<string, any>>(),
  changedFields: json("changedFields").$type<string[]>(), // List of fields that changed
  description: text("description"), // Detailed description of the change
  metadata: json("metadata").$type<Record<string, any>>(), // Additional context (e.g., related entities)
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("idx_audit_category").on(table.category),
  entityTypeIdx: index("idx_audit_entity_type").on(table.entityType),
  userIdIdx: index("idx_audit_user").on(table.userId),
  createdAtIdx: index("idx_audit_created_at").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ============ PERMISSIONS ============

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  canView: boolean("canView").notNull().default(false),
  canCreate: boolean("canCreate").notNull().default(false),
  canEdit: boolean("canEdit").notNull().default(false),
  canDelete: boolean("canDelete").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userModuleIdx: index("idx_user_module").on(table.userId, table.module),
}));

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

export const subPermissions = mysqlTable("sub_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  permissionKey: varchar("permissionKey", { length: 100 }).notNull(),
  isAllowed: boolean("isAllowed").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userModuleKeyIdx: index("idx_user_module_key").on(table.userId, table.module, table.permissionKey),
}));

export type SubPermission = typeof subPermissions.$inferSelect;
export type InsertSubPermission = typeof subPermissions.$inferInsert;

// ============ NOTIFICATIONS LOG ============

export const notificationLogs = mysqlTable("notificationLogs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  channel: mysqlEnum("channel", ["email", "whatsapp", "sms"]).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  content: text("content"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "delivered"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

// ============ SYSTEM SETTINGS ============

export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue"),
  settingType: varchar("settingType", { length: 20 }).default("string"),
  description: text("description"),
  updatedById: int("updatedById"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;


// ============ FULL PACKAGE ORDERS (Product Ordering & Profit Tracking) ============

// ============ SUPPLIERS (For Full Package) ============

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameArabic: varchar("nameArabic", { length: 255 }),
  nameChinese: varchar("nameChinese", { length: 255 }),
  contactPerson: varchar("contactPerson", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  wechatId: varchar("wechatId", { length: 100 }),
  email: varchar("email", { length: 320 }),
  platform: mysqlEnum("platform", ["1688", "taobao", "alibaba", "pinduoduo", "other"]).default("1688"),
  platformShopUrl: text("platformShopUrl"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"), // 0.00 - 5.00
  totalOrders: int("totalOrders").default(0),
  totalSpentUsd: decimal("totalSpentUsd", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ============ FULL PACKAGE ORDERS ============

export const fullPackageOrders = mysqlTable("fullPackageOrders", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("orderCode", { length: 50 }).notNull().unique(), // FP-XXXXX
  customerId: int("customerId").notNull(),
  supplierId: int("supplierId"), // Link to supplier
  
  // Order Type: full_package (we buy & resell), purchase_request (customer requests from portal), commission (we buy for customer with fee)
  orderType: mysqlEnum("orderType", ["full_package", "purchase_request", "commission"]).default("full_package").notNull(),
  
  // Product Information
  productName: varchar("productName", { length: 500 }).notNull(),
  productLink: text("productLink"),
  productImage: text("productImage"),
  productImages: json("productImages").$type<string[]>(), // Multiple product images
  productDescription: text("productDescription"),
  quantity: int("quantity").default(1).notNull(),
  color: varchar("color", { length: 100 }), // Product color
  size: varchar("size", { length: 100 }), // Product size
  
  // Supplier Tracking
  supplierTrackingNumber: varchar("supplierTrackingNumber", { length: 100 }), // 1688/Taobao tracking
  supplierOrderNumber: varchar("supplierOrderNumber", { length: 100 }), // Order number on supplier platform
  purchaseInvoiceUrl: text("purchaseInvoiceUrl"), // Purchase invoice/receipt image
  
  // Pricing - For Resale
  purchasePriceUsd: decimal("purchasePriceUsd", { precision: 10, scale: 2 }), // Our cost (resale)
  purchasePriceCny: decimal("purchasePriceCny", { precision: 10, scale: 2 }), // Cost in CNY
  sellingPriceUsd: decimal("sellingPriceUsd", { precision: 10, scale: 2 }), // Customer pays (resale)
  
  // Pricing - For Commission Purchase (customer knows the price)
  itemPriceUsd: decimal("itemPriceUsd", { precision: 10, scale: 2 }), // Actual item price (customer knows)
  itemPriceCny: decimal("itemPriceCny", { precision: 10, scale: 2 }), // Item price in CNY
  commissionFeeUsd: decimal("commissionFeeUsd", { precision: 10, scale: 2 }), // Commission fee for purchasing service
  totalPrepaidUsd: decimal("totalPrepaidUsd", { precision: 10, scale: 2 }), // Total prepaid by customer (item + commission)
  
  // Prepaid tracking
  isPrepaid: boolean("isPrepaid").default(false), // Whether customer has prepaid
  prepaidAt: timestamp("prepaidAt"), // When customer prepaid
  
  // Profit tracking
  grossProfitUsd: decimal("grossProfitUsd", { precision: 10, scale: 2 }), // Selling price - Purchase price
  netProfitUsd: decimal("netProfitUsd", { precision: 10, scale: 2 }), // Gross profit - Shipping cost
  
  // Legacy fields (kept for backward compatibility)
  estimatedPriceUsd: decimal("estimatedPriceUsd", { precision: 10, scale: 2 }), // Estimated item price
  actualPriceUsd: decimal("actualPriceUsd", { precision: 10, scale: 2 }), // Actual item price after purchase
  purchaseFeeUsd: decimal("purchaseFeeUsd", { precision: 10, scale: 2 }), // Service fee for purchasing
  
  // Commission (legacy)
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }), // Commission percentage
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }), // Calculated commission
  
  // Shipping
  shippingType: mysqlEnum("shippingType", ["air_regular", "air_irregular", "sea"]),
  weightKg: decimal("weightKg", { precision: 10, scale: 3 }),
  volumeCbm: decimal("volumeCbm", { precision: 10, scale: 6 }), // For sea shipping
  dimensionLength: decimal("dimensionLength", { precision: 10, scale: 2 }), // cm
  dimensionWidth: decimal("dimensionWidth", { precision: 10, scale: 2 }), // cm
  dimensionHeight: decimal("dimensionHeight", { precision: 10, scale: 2 }), // cm
  shippingCostUsd: decimal("shippingCostUsd", { precision: 10, scale: 2 }).default("0"),
  
  // Calculated totals
  totalCostUsd: decimal("totalCostUsd", { precision: 10, scale: 2 }), // Total customer pays
  profitUsd: decimal("profitUsd", { precision: 10, scale: 2 }), // Our profit
  
  // Payment from customer balance
  paidFromBalanceUsd: decimal("paidFromBalanceUsd", { precision: 10, scale: 2 }).default("0"),
  remainingBalanceUsd: decimal("remainingBalanceUsd", { precision: 10, scale: 2 }).default("0"),
  isPaid: boolean("isPaid").default(false),
  
  // Charge tracking (when batch arrives)
  isChargedToCustomer: boolean("isChargedToCustomer").default(false), // Whether selling price has been charged (for full_package)
  chargedAt: timestamp("chargedAt"), // When selling price was charged
  isCharged: boolean("isCharged").default(false), // Whether order has been charged to customer account
  chargedToAccountAt: timestamp("chargedToAccountAt"), // When charged to account
  
  // Shipping charge tracking (for commission orders - charged separately from item+commission)
  isShippingCharged: boolean("isShippingCharged").default(false), // Whether shipping cost has been charged to customer
  shippingChargedAt: timestamp("shippingChargedAt"), // When shipping was charged
  shippingChargedUsd: decimal("shippingChargedUsd", { precision: 10, scale: 2 }), // Amount charged to customer for shipping
  
  // Order & Tracking
  orderNumber: varchar("orderNumber", { length: 100 }),
  trackingNumber: varchar("trackingNumber", { length: 100 }).unique(),
  orderDate: timestamp("orderDate"),
  trackingAddedDate: timestamp("trackingAddedDate"),
  expectedDeliveryDate: timestamp("expectedDeliveryDate"), // Expected delivery to customer
  arrivedDate: timestamp("arrivedDate"),
  deliveredDate: timestamp("deliveredDate"),
  actualDeliveryDate: timestamp("actualDeliveryDate"), // Actual delivery date
  
  // Quality Check
  qualityCheckStatus: mysqlEnum("qualityCheckStatus", ["pending", "passed", "failed", "partial"]),
  qualityCheckNotes: text("qualityCheckNotes"),
  qualityCheckDate: timestamp("qualityCheckDate"),
  qualityCheckById: int("qualityCheckById"),
  
  // Returns
  isReturned: boolean("isReturned").default(false),
  returnReason: text("returnReason"),
  returnDate: timestamp("returnDate"),
  returnStatus: mysqlEnum("returnStatus", ["requested", "approved", "rejected", "completed"]),
  refundAmount: decimal("refundAmount", { precision: 10, scale: 2 }),
  
  // Status
  status: mysqlEnum("status", [
    "pending_quote",     // Waiting for price quote (purchase_request only)
    "quoted",            // Price quoted, waiting for customer approval (purchase_request only)
    "pending",           // Waiting for approval/payment
    "approved",          // Approved, ready to order
    "rejected",          // Customer rejected the quote (purchase_request only)
    "ordered",           // Order placed
    "tracking_added",    // Tracking number added
    "in_china_warehouse", // Arrived at China warehouse
    "quality_check",     // Under quality inspection
    "in_batch",          // Added to a batch for shipping
    "in_transit",        // On the way to Iraq
    "arrived",           // Arrived at Iraq warehouse
    "ready_for_delivery", // Ready for customer pickup
    "delivered",         // Delivered to customer
    "cancelled",         // Order cancelled
    "refunded",          // Order refunded
    "returned"           // Product returned
  ]).default("pending").notNull(),
  
  // Batch assignment
  batchId: int("batchId"),
  packageId: int("packageId"), // Link to package when created
  linkedPurchaseRequestId: int("linkedPurchaseRequestId"), // Link to original purchase request
  
  // Priority & Tags
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal"),
  tags: json("tags").$type<string[]>(), // Custom tags
  
  // Reminder tracking
  trackingReminderSent: boolean("trackingReminderSent").default(false),
  
  // Tracking Alert System
  alertLevel: mysqlEnum("alertLevel", ["none", "warning", "urgent", "critical"]).default("none"),
  lastAlertSentAt: timestamp("lastAlertSentAt"),
  alertCount: int("alertCount").default(0),
  
  // Customer & Staff Notes
  customerNotes: text("customerNotes"), // Notes from customer
  notes: text("notes"), // General notes
  internalNotes: text("internalNotes"), // Staff-only notes
  
  // Staff Assignment
  createdById: int("createdById").notNull(),
  assignedToId: int("assignedToId"), // Staff assigned to handle this order
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FullPackageOrder = typeof fullPackageOrders.$inferSelect;
export type InsertFullPackageOrder = typeof fullPackageOrders.$inferInsert;

// ============ FULL PACKAGE STATUS HISTORY ============

export const fullPackageStatusHistory = mysqlTable("fullPackageStatusHistory", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }).notNull(),
  changedById: int("changedById").notNull(),
  changedByName: varchar("changedByName", { length: 255 }),
  notes: text("notes"),
  metadata: json("metadata").$type<Record<string, unknown>>(), // Additional data like location, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FullPackageStatusHistory = typeof fullPackageStatusHistory.$inferSelect;
export type InsertFullPackageStatusHistory = typeof fullPackageStatusHistory.$inferInsert;


// ============ CUSTOMER NOTIFICATION PREFERENCES ============

export const customerNotificationPrefs = mysqlTable("customerNotificationPrefs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  
  // Notification channels
  emailEnabled: boolean("emailEnabled").default(true),
  smsEnabled: boolean("smsEnabled").default(true),
  whatsappEnabled: boolean("whatsappEnabled").default(false),
  
  // Notification types
  packageRegistered: boolean("packageRegistered").default(true),
  packageStatusChange: boolean("packageStatusChange").default(true),
  packageDelivered: boolean("packageDelivered").default(true),
  paymentReminder: boolean("paymentReminder").default(true),
  promotions: boolean("promotions").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerNotificationPref = typeof customerNotificationPrefs.$inferSelect;
export type InsertCustomerNotificationPref = typeof customerNotificationPrefs.$inferInsert;

// ============ VIP CUSTOMERS & SPECIAL PRICING ============

export const vipCustomers = mysqlTable("vipCustomers", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  
  // VIP tier
  tier: mysqlEnum("tier", ["silver", "gold", "platinum"]).default("silver").notNull(),
  
  // Discount percentage (e.g., 5 = 5% off)
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }).default("0"),
  
  // Fixed price per KG override (null = use standard pricing)
  fixedPricePerKgAir: decimal("fixedPricePerKgAir", { precision: 10, scale: 2 }),
  fixedPricePerKgSea: decimal("fixedPricePerKgSea", { precision: 10, scale: 2 }),
  
  // Credit limit for this customer
  creditLimitUsd: decimal("creditLimitUsd", { precision: 10, scale: 2 }).default("0"),
  
  // Notes
  notes: text("notes"),
  
  // Validity
  validFrom: timestamp("validFrom").defaultNow().notNull(),
  validTo: timestamp("validTo"),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VipCustomer = typeof vipCustomers.$inferSelect;
export type InsertVipCustomer = typeof vipCustomers.$inferInsert;

// ============ PACKAGE QR CODES ============

export const packageQrCodes = mysqlTable("packageQrCodes", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  packageType: mysqlEnum("packageType", ["regular", "full_package"]).default("regular").notNull(),
  
  // QR Code data
  qrCode: varchar("qrCode", { length: 100 }).notNull().unique(), // Unique code for scanning
  qrImageUrl: text("qrImageUrl"), // URL to generated QR image
  
  // Scan tracking
  lastScannedAt: timestamp("lastScannedAt"),
  lastScannedById: int("lastScannedById"),
  scanCount: int("scanCount").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackageQrCode = typeof packageQrCodes.$inferSelect;
export type InsertPackageQrCode = typeof packageQrCodes.$inferInsert;

// ===// ============ SCHEDULED TASKS LOG =============

export const scheduledTasksLog = mysqlTable("scheduledTasksLog", {
  id: int("id").autoincrement().primaryKey(),
  taskName: varchar("taskName", { length: 100 }).notNull(),
  taskType: varchar("taskType", { length: 50 }).notNull(), // e.g., "overdue_check", "payment_reminder"
  
  // Execution details
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  
  // Results
  itemsProcessed: int("itemsProcessed").default(0),
  itemsSucceeded: int("itemsSucceeded").default(0),
  itemsFailed: int("itemsFailed").default(0),
  
  // Error tracking
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledTaskLog = typeof scheduledTasksLog.$inferSelect;
export type InsertScheduledTaskLog = typeof scheduledTasksLog.$inferInsert;


// ============ BARCODE SCANNING SYSTEM ============

// Package Scans - tracks every scan event
export const packageScans = mysqlTable("packageScans", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId"), // null if package not yet registered
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  
  // Scan type
  scanType: mysqlEnum("scanType", [
    "registered",           // First scan - package registered
    "received_china",       // Received at China warehouse
    "in_batch",            // Added to batch
    "in_transit",          // In transit (shipped)
    "received_local",      // Received at local warehouse (Erbil)
    "out_for_delivery",    // Out for delivery
    "delivered",           // Delivered to customer
    "returned",            // Returned
    "customs_hold"         // Held at customs
  ]).notNull(),
  
  // Who and where
  scannedById: int("scannedById").notNull(),
  warehouseId: int("warehouseId"),
  
  // Location data
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  locationName: varchar("locationName", { length: 255 }),
  
  // Additional data
  notes: text("notes"),
  photoUrl: varchar("photoUrl", { length: 500 }),
  
  // Device info
  deviceId: int("deviceId"),
  deviceInfo: json("deviceInfo").$type<{
    userAgent?: string;
    platform?: string;
    appVersion?: string;
  }>(),
  
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackageScan = typeof packageScans.$inferSelect;
export type InsertPackageScan = typeof packageScans.$inferInsert;

// Package Status History - detailed history of all status changes
export const packageStatusHistory = mysqlTable("packageStatusHistory", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  
  // Status change
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }).notNull(),
  
  // Who changed
  changedById: int("changedById").notNull(),
  changeMethod: mysqlEnum("changeMethod", ["scan", "manual", "system", "api"]).default("manual").notNull(),
  
  // Related scan
  scanId: int("scanId"),
  
  // Reason and notes
  reason: varchar("reason", { length: 255 }),
  notes: text("notes"),
  
  // Metadata
  metadata: json("metadata").$type<{
    warehouseId?: number;
    batchId?: number;
    latitude?: number;
    longitude?: number;
    signatureUrl?: string;
    photoUrl?: string;
  }>(),
  
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackageStatusHistory = typeof packageStatusHistory.$inferSelect;
export type InsertPackageStatusHistory = typeof packageStatusHistory.$inferInsert;

// Scan Devices - registered scanning devices
export const scanDevices = mysqlTable("scanDevices", {
  id: int("id").autoincrement().primaryKey(),
  
  // Device identification
  deviceName: varchar("deviceName", { length: 100 }).notNull(),
  deviceType: mysqlEnum("deviceType", ["mobile", "scanner", "tablet", "desktop"]).default("mobile").notNull(),
  deviceIdentifier: varchar("deviceIdentifier", { length: 255 }).unique(), // Unique device ID
  
  // Assignment
  assignedToId: int("assignedToId"),
  warehouseId: int("warehouseId"),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  lastActiveAt: timestamp("lastActiveAt"),
  
  // Stats
  totalScans: int("totalScans").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScanDevice = typeof scanDevices.$inferSelect;
export type InsertScanDevice = typeof scanDevices.$inferInsert;


// ============ CUSTOMER LEDGER SYSTEM ============

// Customer Accounts - financial account for each customer
export const customerAccounts = mysqlTable("customerAccounts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer reference
  customerId: int("customerId").notNull().unique(),
  accountNumber: varchar("accountNumber", { length: 50 }).notNull().unique(), // ACC-AZ067-2024
  
  // Balances (positive = customer owes, negative = credit)
  currentBalanceUsd: decimal("currentBalanceUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  currentBalanceIqd: decimal("currentBalanceIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  
  // Balance breakdown by transaction type (for detailed tracking)
  packageDebtUsd: decimal("packageDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  fullPackageDebtUsd: decimal("fullPackageDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  purchaseRequestDebtUsd: decimal("purchaseRequestDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  commissionDebtUsd: decimal("commissionDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  serviceDebtUsd: decimal("serviceDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  
  // Customer credit/deposit (prepaid balance)
  creditBalanceUsd: decimal("creditBalanceUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  creditBalanceIqd: decimal("creditBalanceIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  
  // Credit limits
  creditLimitUsd: decimal("creditLimitUsd", { precision: 10, scale: 2 }).default("500"),
  creditLimitIqd: decimal("creditLimitIqd", { precision: 15, scale: 0 }).default("750000"),
  
  // Totals (lifetime)
  totalDebitUsd: decimal("totalDebitUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  totalCreditUsd: decimal("totalCreditUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  totalDebitIqd: decimal("totalDebitIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  totalCreditIqd: decimal("totalCreditIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  
  // Status
  accountStatus: mysqlEnum("accountStatus", ["active", "suspended", "blocked"]).default("active").notNull(),
  
  // Customer scoring
  customerScore: decimal("customerScore", { precision: 3, scale: 1 }).default("5.0"), // 0-5 rating
  paymentRating: mysqlEnum("paymentRating", ["excellent", "good", "fair", "poor"]).default("good"),
  
  // Timestamps
  lastTransactionAt: timestamp("lastTransactionAt"),
  lastPaymentAt: timestamp("lastPaymentAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type InsertCustomerAccount = typeof customerAccounts.$inferInsert;

// Ledger Transactions - all financial movements
export const ledgerTransactions = mysqlTable("ledgerTransactions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  transactionNumber: varchar("transactionNumber", { length: 50 }).notNull().unique(), // TXN-20241218-0001
  
  // Transaction type
  transactionType: mysqlEnum("transactionType", [
    "DEBIT_PACKAGE",          // Package delivery charge
    "DEBIT_FULL_PACKAGE",     // Full package order charge
    "DEBIT_PURCHASE_REQUEST", // Purchase request charge
    "DEBIT_COMMISSION",       // Commission order charge
    "DEBIT_SERVICE",          // Service fee
    "DEBIT_PENALTY",          // Late payment penalty
    "DEBIT_OTHER",            // Other charges
    "CREDIT_PAYMENT",         // Payment received
    "CREDIT_DEPOSIT",         // Customer deposit (prepaid balance)
    "CREDIT_REFUND",          // Refund to customer
    "CREDIT_DISCOUNT",        // Discount given
    "CREDIT_OTHER",           // Other credits
    "ADJUSTMENT_DEBIT",       // Manual debit adjustment
    "ADJUSTMENT_CREDIT"       // Manual credit adjustment
  ]).notNull(),
  
  // Amounts
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).default("0"),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }).default("0"),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }), // USD to IQD rate
  
  // Balance tracking
  balanceBeforeUsd: decimal("balanceBeforeUsd", { precision: 12, scale: 2 }).notNull(),
  balanceAfterUsd: decimal("balanceAfterUsd", { precision: 12, scale: 2 }).notNull(),
  balanceBeforeIqd: decimal("balanceBeforeIqd", { precision: 15, scale: 0 }).notNull(),
  balanceAfterIqd: decimal("balanceAfterIqd", { precision: 15, scale: 0 }).notNull(),
  
  // Reference (what caused this transaction)
  referenceType: mysqlEnum("referenceType", [
    "package", 
    "full_package", 
    "purchase_request", 
    "commission", 
    "payment", 
    "adjustment", 
    "service", 
    "manual"
  ]),
  referenceId: int("referenceId"),
  
  // Description
  description: text("description"),
  
  // Invoice link (auto-generated for DEBIT transactions)
  invoiceId: int("invoiceId"),
  
  // Audit
  createdById: int("createdById").notNull(),
  approvedById: int("approvedById"), // For large transactions
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type InsertLedgerTransaction = typeof ledgerTransactions.$inferInsert;

// Payment Records - detailed payment information
export const paymentRecords = mysqlTable("paymentRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  transactionId: int("transactionId"), // Link to ledger transaction
  
  // Payment identification
  paymentNumber: varchar("paymentNumber", { length: 50 }).notNull().unique(), // PAY-20241218-0001
  
  // Amounts
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).default("0"),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }).default("0"),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }),
  
  // Payment method
  paymentMethod: mysqlEnum("paymentMethod", [
    "CASH",
    "BANK_TRANSFER",
    "FIB",
    "FASTPAY",
    "ZAINCASH",
    "ASIAHAWALA",
    "CARD",
    "OTHER"
  ]).notNull(),
  
  // Status
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "confirmed", "cancelled", "refunded"]).default("confirmed").notNull(),
  
  // Receipt/Reference
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  bankReference: varchar("bankReference", { length: 100 }),
  receiptPhoto: varchar("receiptPhoto", { length: 500 }), // URL to receipt image
  
  // Notes
  notes: text("notes"),
  
  // Audit
  receivedById: int("receivedById").notNull(),
  confirmedById: int("confirmedById"),
  cancelledById: int("cancelledById"),
  cancelReason: text("cancelReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
  cancelledAt: timestamp("cancelledAt"),
});

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = typeof paymentRecords.$inferInsert;

// Credit Adjustments - manual balance adjustments
export const creditAdjustments = mysqlTable("creditAdjustments", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  transactionId: int("transactionId"), // Link to ledger transaction
  
  // Adjustment details
  adjustmentType: mysqlEnum("adjustmentType", ["increase_debt", "decrease_debt", "write_off"]).notNull(),
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).default("0"),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }).default("0"),
  
  // Reason
  reason: text("reason").notNull(),
  supportingDocument: varchar("supportingDocument", { length: 500 }),
  
  // Approval
  requestedById: int("requestedById").notNull(),
  approvedById: int("approvedById"),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvalNotes: text("approvalNotes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
});

export type CreditAdjustment = typeof creditAdjustments.$inferSelect;
export type InsertCreditAdjustment = typeof creditAdjustments.$inferInsert;

// Payment Reminders - scheduled reminders for debtors
export const paymentReminders = mysqlTable("paymentReminders", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  
  // Reminder details
  reminderType: mysqlEnum("reminderType", ["sms", "whatsapp", "email", "call"]).notNull(),
  messageTemplate: text("messageTemplate"),
  customMessage: text("customMessage"),
  
  // Scheduling
  scheduledAt: timestamp("scheduledAt").notNull(),
  sentAt: timestamp("sentAt"),
  
  // Status
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  failureReason: text("failureReason"),
  
  // Response tracking
  customerResponse: text("customerResponse"),
  promisedPaymentDate: timestamp("promisedPaymentDate"),
  promisedAmount: decimal("promisedAmount", { precision: 10, scale: 2 }),
  
  // Audit
  createdById: int("createdById").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = typeof paymentReminders.$inferInsert;


// ============ PRODUCT CATEGORIES (جۆرەکانی کاڵا) ============

export const productCategories = mysqlTable("productCategories", {
  id: int("id").autoincrement().primaryKey(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(), // English name
  nameAr: varchar("nameAr", { length: 100 }), // Arabic name
  nameKu: varchar("nameKu", { length: 100 }), // Kurdish name
  icon: varchar("icon", { length: 50 }), // Emoji or icon name (e.g., "👔", "clothing")
  color: varchar("color", { length: 20 }), // Color for UI (e.g., "#3B82F6")
  sortOrder: int("sortOrder").default(0).notNull(), // Display order
  isActive: boolean("isActive").default(true).notNull(),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;


// ============ BATCH PRICING TIERS (نرخدانی پلەیی) ============
export const batchPricingTiers = mysqlTable("batchPricingTiers", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  
  // Tier range (min and max values)
  minValue: decimal("minValue", { precision: 10, scale: 4 }).notNull(), // Min KG or CBM
  maxValue: decimal("maxValue", { precision: 10, scale: 4 }), // Max KG or CBM (null = unlimited)
  
  // Price for this tier
  pricePerUnit: decimal("pricePerUnit", { precision: 10, scale: 2 }).notNull(), // Price per KG or CBM
  
  // Metadata
  sortOrder: int("sortOrder").default(0).notNull(), // Display order
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BatchPricingTier = typeof batchPricingTiers.$inferSelect;
export type InsertBatchPricingTier = typeof batchPricingTiers.$inferInsert;


// ============ BATCH CUSTOMER PRICING (نرخی تایبەت بۆ کڕیار) ============
export const batchCustomerPricing = mysqlTable("batchCustomerPricing", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  customerId: int("customerId").notNull(),
  
  // Custom price for this customer in this batch
  pricePerKg: decimal("pricePerKg", { precision: 10, scale: 2 }), // Custom price per KG (for air)
  pricePerCbm: decimal("pricePerCbm", { precision: 10, scale: 2 }), // Custom price per CBM (for sea)
  
  // Notes about why this customer has special pricing
  notes: text("notes"),
  
  // Metadata
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BatchCustomerPricing = typeof batchCustomerPricing.$inferSelect;
export type InsertBatchCustomerPricing = typeof batchCustomerPricing.$inferInsert;


// ============ NOTIFICATION SETTINGS (Global) ============
export const notificationSettings = mysqlTable("notificationSettings", {
  id: int("id").autoincrement().primaryKey(),
  
  // Event type
  eventType: varchar("eventType", { length: 50 }).notNull().unique(),
  
  // Channel toggles
  emailEnabled: boolean("emailEnabled").default(false).notNull(),
  smsEnabled: boolean("smsEnabled").default(false).notNull(),
  whatsappEnabled: boolean("whatsappEnabled").default(false).notNull(),
  
  // WhatsApp settings
  whatsappApiKey: varchar("whatsappApiKey", { length: 255 }),
  whatsappPhoneNumberId: varchar("whatsappPhoneNumberId", { length: 50 }),
  whatsappTemplateId: varchar("whatsappTemplateId", { length: 100 }),
  
  // Custom message template (optional override)
  customSubject: varchar("customSubject", { length: 255 }),
  customBody: text("customBody"),
  
  // Metadata
  updatedById: int("updatedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = typeof notificationSettings.$inferInsert;



// ============ COMPANY FINANCIAL MANAGEMENT (بەڕێوەبردنی دارایی کۆمپانیا) ============

// ============ EXPENSE CATEGORIES (پۆلی مەسروفات) ============
export const expenseCategories = mysqlTable("expenseCategories", {
  id: int("id").autoincrement().primaryKey(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }),
  nameKu: varchar("nameKu", { length: 100 }),
  icon: varchar("icon", { length: 50 }), // Emoji or icon
  color: varchar("color", { length: 20 }), // Color for UI
  description: text("description"),
  isRecurring: boolean("isRecurring").default(false).notNull(), // Monthly recurring
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;

// ============ EXPENSES (مەسروفات) ============
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 4 }), // If IQD, rate to USD
  amountUsd: decimal("amountUsd", { precision: 12, scale: 2 }).notNull(), // Converted to USD
  description: text("description"),
  expenseDate: timestamp("expenseDate").notNull(),
  receiptUrl: varchar("receiptUrl", { length: 500 }), // Receipt image
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "bank_transfer", "card", "other"]).default("cash").notNull(),
  cashAccountId: int("cashAccountId"), // Which account paid from
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurringDay: int("recurringDay"), // Day of month for recurring
  vendor: varchar("vendor", { length: 255 }), // Who was paid
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// ============ PARTNERS/SHAREHOLDERS (شەریکان) ============
export const partners = mysqlTable("partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameKu: varchar("nameKu", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  ownershipPercentage: decimal("ownershipPercentage", { precision: 5, scale: 2 }).notNull(), // e.g., 50.00%
  initialCapital: decimal("initialCapital", { precision: 14, scale: 2 }).default("0").notNull(), // Initial investment
  currentBalance: decimal("currentBalance", { precision: 14, scale: 2 }).default("0").notNull(), // Retained earnings
  joinDate: timestamp("joinDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// ============ PARTNER TRANSACTIONS (گواستنەوەی شەریکان) ============
export const partnerTransactions = mysqlTable("partnerTransactions", {
  id: int("id").autoincrement().primaryKey(),
  partnerId: int("partnerId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "capital_contribution",  // سەرمایە - Adding capital
    "profit_share",          // بەشی قازانج - Monthly/yearly profit distribution
    "withdrawal",            // دەرهێنان - Taking money out
    "loan_to_company",       // قەرز بۆ کۆمپانیا - Partner loans to company
    "loan_repayment",        // گەڕاندنەوەی قەرز - Company repays partner
    "adjustment"             // ڕێکخستن - Manual adjustment
  ]).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  amountUsd: decimal("amountUsd", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  transactionDate: timestamp("transactionDate").notNull(),
  periodMonth: int("periodMonth"), // For profit_share: which month (1-12)
  periodYear: int("periodYear"),   // For profit_share: which year
  cashAccountId: int("cashAccountId"), // Which account used
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerTransaction = typeof partnerTransactions.$inferSelect;
export type InsertPartnerTransaction = typeof partnerTransactions.$inferInsert;

// ============ COMPANY DEBTS (قەرزی کۆمپانیا) ============
export const companyDebts = mysqlTable("companyDebts", {
  id: int("id").autoincrement().primaryKey(),
  creditorName: varchar("creditorName", { length: 255 }).notNull(), // Who we owe
  creditorType: mysqlEnum("creditorType", ["personal", "bank", "supplier", "other"]).notNull(),
  creditorPhone: varchar("creditorPhone", { length: 20 }),
  creditorEmail: varchar("creditorEmail", { length: 320 }),
  principalAmount: decimal("principalAmount", { precision: 14, scale: 2 }).notNull(), // Original amount
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  principalAmountUsd: decimal("principalAmountUsd", { precision: 14, scale: 2 }).notNull(),
  interestRate: decimal("interestRate", { precision: 5, scale: 2 }).default("0"), // Annual interest %
  totalInterest: decimal("totalInterest", { precision: 14, scale: 2 }).default("0"), // Total interest to pay
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(), // Principal + Interest
  paidAmount: decimal("paidAmount", { precision: 14, scale: 2 }).default("0").notNull(), // Amount paid so far
  remainingAmount: decimal("remainingAmount", { precision: 14, scale: 2 }).notNull(), // Remaining to pay
  startDate: timestamp("startDate").notNull(),
  dueDate: timestamp("dueDate"), // Final due date
  installmentCount: int("installmentCount"), // Number of installments
  installmentAmount: decimal("installmentAmount", { precision: 14, scale: 2 }), // Monthly payment
  status: mysqlEnum("status", ["active", "paid", "overdue", "restructured"]).default("active").notNull(),
  purpose: text("purpose"), // Why the loan was taken
  collateral: text("collateral"), // Any collateral
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyDebt = typeof companyDebts.$inferSelect;
export type InsertCompanyDebt = typeof companyDebts.$inferInsert;

// ============ DEBT PAYMENTS (پارەدانی قەرز) ============
export const debtPayments = mysqlTable("debtPayments", {
  id: int("id").autoincrement().primaryKey(),
  debtId: int("debtId").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  amountUsd: decimal("amountUsd", { precision: 14, scale: 2 }).notNull(),
  principalPaid: decimal("principalPaid", { precision: 14, scale: 2 }).notNull(), // Principal portion
  interestPaid: decimal("interestPaid", { precision: 14, scale: 2 }).default("0"), // Interest portion
  paymentDate: timestamp("paymentDate").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "bank_transfer", "card", "other"]).default("cash").notNull(),
  cashAccountId: int("cashAccountId"), // Which account paid from
  remainingAfter: decimal("remainingAfter", { precision: 14, scale: 2 }),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DebtPayment = typeof debtPayments.$inferSelect;
export type InsertDebtPayment = typeof debtPayments.$inferInsert;

// ============ CASH ACCOUNTS (حسابی نەقد و بانک) ============
export const cashAccounts = mysqlTable("cashAccounts", {
  id: int("id").autoincrement().primaryKey(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  accountNameKu: varchar("accountNameKu", { length: 255 }),
  accountType: mysqlEnum("accountType", ["cash", "bank", "mobile_wallet"]).notNull(),
  bankName: varchar("bankName", { length: 255 }), // For bank accounts
  accountNumber: varchar("accountNumber", { length: 100 }), // Bank account number
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  currentBalance: decimal("currentBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  initialBalance: decimal("initialBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(), // Main account
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CashAccount = typeof cashAccounts.$inferSelect;
export type InsertCashAccount = typeof cashAccounts.$inferInsert;

// ============ CASH TRANSACTIONS (گواستنەوەی پارە) ============
export const cashTransactions = mysqlTable("cashTransactions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "deposit",           // داخل - Money in
    "withdrawal",        // دەرهێنان - Money out
    "transfer_in",       // گواستنەوە - Transfer from another account
    "transfer_out",      // گواستنەوە - Transfer to another account
    "customer_payment",  // پارەدانی کڕیار - Customer pays
    "expense",           // مەسروف - Expense payment
    "debt_payment",      // پارەدانی قەرز - Debt payment
    "partner_deposit",   // داخلی شەریک - Partner adds money
    "partner_withdrawal",// دەرهێنانی شەریک - Partner takes money
    "adjustment"         // ڕێکخستن - Manual adjustment
  ]).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 2 }).notNull(),
  relatedAccountId: int("relatedAccountId"), // For transfers
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // customer, expense, debt, partner
  relatedEntityId: int("relatedEntityId"),
  description: text("description"),
  transactionDate: timestamp("transactionDate").notNull(),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CashTransaction = typeof cashTransactions.$inferSelect;
export type InsertCashTransaction = typeof cashTransactions.$inferInsert;

// ============ FINANCIAL PERIODS (ماوەی دارایی) ============
export const financialPeriods = mysqlTable("financialPeriods", {
  id: int("id").autoincrement().primaryKey(),
  periodType: mysqlEnum("periodType", ["monthly", "quarterly", "yearly"]).notNull(),
  year: int("year").notNull(),
  month: int("month"), // 1-12 for monthly, null for yearly
  quarter: int("quarter"), // 1-4 for quarterly
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  
  // Revenue
  totalRevenue: decimal("totalRevenue", { precision: 14, scale: 2 }).default("0"),
  packageRevenue: decimal("packageRevenue", { precision: 14, scale: 2 }).default("0"),
  fullPackageRevenue: decimal("fullPackageRevenue", { precision: 14, scale: 2 }).default("0"),
  otherRevenue: decimal("otherRevenue", { precision: 14, scale: 2 }).default("0"),
  
  // Expenses
  totalExpenses: decimal("totalExpenses", { precision: 14, scale: 2 }).default("0"),
  
  // Profit
  grossProfit: decimal("grossProfit", { precision: 14, scale: 2 }).default("0"),
  netProfit: decimal("netProfit", { precision: 14, scale: 2 }).default("0"),
  
  // Status
  status: mysqlEnum("status", ["open", "closed", "locked"]).default("open").notNull(),
  closedAt: timestamp("closedAt"),
  closedById: int("closedById"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialPeriod = typeof financialPeriods.$inferSelect;
export type InsertFinancialPeriod = typeof financialPeriods.$inferInsert;


// ============ SCAN HISTORY (مێژووی سکان) ============
export const scanHistory = mysqlTable("scanHistory", {
  id: int("id").autoincrement().primaryKey(),
  
  // Package reference
  packageId: int("packageId"), // Can be null for failed scans
  fullPackageOrderId: int("fullPackageOrderId"), // For full package scans
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  
  // Scan details
  scanType: mysqlEnum("scanType", [
    "register",       // تۆمارکردن - New package registration
    "receive",        // وەرگرتن - Received at China warehouse
    "ship",           // ناردن - Added to batch/shipped
    "arrive",         // گەیشتن - Arrived at local warehouse
    "deliver",        // گەیاندن - Delivered to customer
    "return",         // گەڕاندنەوە - Returned
    "other"           // تر
  ]).notNull(),
  
  // Result
  status: mysqlEnum("status", ["success", "error", "not_found"]).default("success").notNull(),
  errorMessage: text("errorMessage"), // If failed, why
  
  // Package info at time of scan
  customerName: varchar("customerName", { length: 255 }),
  customerId: int("customerId"),
  weightKg: decimal("weightKg", { precision: 10, scale: 3 }),
  shippingType: varchar("shippingType", { length: 50 }),
  batchId: int("batchId"),
  batchCode: varchar("batchCode", { length: 50 }),
  
  // Cost/price info
  calculatedCost: decimal("calculatedCost", { precision: 10, scale: 2 }),
  
  // Who scanned
  scannedById: int("scannedById").notNull(),
  scannedByName: varchar("scannedByName", { length: 255 }),
  
  // Device/location info
  deviceType: varchar("deviceType", { length: 50 }), // mobile, desktop, scanner
  warehouseId: int("warehouseId"),
  
  // Timestamps
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
});

export type ScanHistory = typeof scanHistory.$inferSelect;
export type InsertScanHistory = typeof scanHistory.$inferInsert;


// ============ EXTRA SERVICES SYSTEM (سیستەمی خزمەتگوزاری زیادە) ============

// Service Types - جۆرەکانی خزمەتگوزاری
export const serviceTypes = mysqlTable("serviceTypes", {
  id: int("id").autoincrement().primaryKey(),
  
  // Names in multiple languages
  nameEn: varchar("nameEn", { length: 100 }).notNull(), // English name
  nameKu: varchar("nameKu", { length: 100 }), // Kurdish name
  nameAr: varchar("nameAr", { length: 100 }), // Arabic name
  
  // Display
  icon: varchar("icon", { length: 50 }), // Emoji or icon name
  color: varchar("color", { length: 20 }), // Color for UI
  
  // Default pricing (can be overridden per service)
  defaultCost: decimal("defaultCost", { precision: 10, scale: 2 }), // Default cost to company
  defaultPrice: decimal("defaultPrice", { precision: 10, scale: 2 }), // Default price to customer
  
  // Settings
  requiresCustomer: boolean("requiresCustomer").default(true).notNull(), // Must have customer?
  addToCustomerBalance: boolean("addToCustomerBalance").default(true).notNull(), // Add to customer debt?
  
  // Status
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  
  // Metadata
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertServiceType = typeof serviceTypes.$inferInsert;


// Extra Services - خزمەتگوزاری زیادە
export const extraServices = mysqlTable("extraServices", {
  id: int("id").autoincrement().primaryKey(),
  
  // Service reference number
  serviceNumber: varchar("serviceNumber", { length: 50 }).notNull().unique(), // SRV-2024-0001
  
  // Service type
  serviceTypeId: int("serviceTypeId").notNull(),
  
  // Customer (optional - some services may not have a customer)
  customerId: int("customerId"),
  
  // Description
  description: text("description").notNull(), // What service was provided
  
  // Financial details
  costAmount: decimal("costAmount", { precision: 10, scale: 2 }).default("0").notNull(), // What it cost us
  priceAmount: decimal("priceAmount", { precision: 10, scale: 2 }).default("0").notNull(), // What we charge customer
  profitAmount: decimal("profitAmount", { precision: 10, scale: 2 }).default("0").notNull(), // Profit (price - cost)
  
  // Currency
  currency: mysqlEnum("currency", ["USD", "IQD", "CNY"]).default("USD").notNull(),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }), // Exchange rate if converted
  
  // Payment status
  isPaid: boolean("isPaid").default(false).notNull(),
  paidAt: timestamp("paidAt"),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer", "balance"]),
  
  // Added to customer balance?
  addedToBalance: boolean("addedToBalance").default(false).notNull(),
  ledgerTransactionId: int("ledgerTransactionId"), // Reference to ledger if added
  
  // Invoice reference
  invoiceId: int("invoiceId"), // If included in an invoice
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExtraService = typeof extraServices.$inferSelect;
export type InsertExtraService = typeof extraServices.$inferInsert;


// Package Claim Requests - داواکاری پاکەتە بێ خاوەنەکان
export const packageClaimRequests = mysqlTable("packageClaimRequests", {
  id: int("id").autoincrement().primaryKey(),
  
  // Request number for reference
  requestNumber: varchar("requestNumber", { length: 50 }).notNull().unique(), // CLM-2024-0001
  
  // Package being claimed
  packageId: int("packageId").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  
  // Customer making the claim
  customerId: int("customerId").notNull(),
  
  // Request status
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  
  // Customer's note/reason for claiming
  customerNote: text("customerNote"),
  
  // Admin review
  reviewedById: int("reviewedById"),
  reviewedAt: timestamp("reviewedAt"),
  adminNote: text("adminNote"), // Reason for approval/rejection
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PackageClaimRequest = typeof packageClaimRequests.$inferSelect;
export type InsertPackageClaimRequest = typeof packageClaimRequests.$inferInsert;


// Customer Messages - پەیامەکانی کڕیار (Chat System)
export const customerMessages = mysqlTable("customerMessages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Conversation reference
  conversationId: varchar("conversationId", { length: 50 }).notNull(), // CONV-{customerId}
  
  // Customer
  customerId: int("customerId").notNull(),
  
  // Message details
  message: text("message").notNull(),
  
  // Sender type
  senderType: mysqlEnum("senderType", ["customer", "admin"]).notNull(),
  senderId: int("senderId").notNull(), // userId of sender
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  // Attachments (optional)
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  attachmentType: mysqlEnum("attachmentType", ["image", "document", "other"]),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CustomerMessage = typeof customerMessages.$inferSelect;
export type InsertCustomerMessage = typeof customerMessages.$inferInsert;

// Customer Addresses - ناونیشانەکانی کڕیار
export const customerAddresses = mysqlTable("customerAddresses", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer
  customerId: int("customerId").notNull(),
  
  // Address details
  label: varchar("label", { length: 100 }).notNull(), // "Home", "Office", "Shop"
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  
  // Location
  country: varchar("country", { length: 100 }).default("Iraq").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }), // Neighborhood
  street: varchar("street", { length: 255 }),
  building: varchar("building", { length: 100 }),
  floor: varchar("floor", { length: 20 }),
  apartment: varchar("apartment", { length: 20 }),
  
  // Additional info
  landmark: text("landmark"), // Near landmark
  notes: text("notes"), // Delivery notes
  
  // GPS coordinates (optional)
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Default address
  isDefault: boolean("isDefault").default(false).notNull(),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type InsertCustomerAddress = typeof customerAddresses.$inferInsert;

// Customer Notifications - ئاگادارکردنەوەکانی کڕیار
export const customerNotifications = mysqlTable("customerNotifications", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer
  customerId: int("customerId").notNull(),
  
  // Notification details
  title: varchar("title", { length: 255 }).notNull(),
  titleKu: varchar("titleKu", { length: 255 }), // Kurdish
  titleAr: varchar("titleAr", { length: 255 }), // Arabic
  
  message: text("message").notNull(),
  messageKu: text("messageKu"), // Kurdish
  messageAr: text("messageAr"), // Arabic
  
  // Type
  type: mysqlEnum("type", ["info", "success", "warning", "error", "package", "payment", "promotion"]).default("info").notNull(),
  
  // Related entity (optional)
  relatedType: mysqlEnum("relatedType", ["package", "batch", "payment", "invoice", "full_package"]),
  relatedId: int("relatedId"),
  
  // Link (optional)
  actionUrl: varchar("actionUrl", { length: 500 }),
  actionLabel: varchar("actionLabel", { length: 100 }),
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;


// ============ INVOICE TEMPLATES ============

export const invoiceTemplates = mysqlTable("invoiceTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template name (for multiple templates)
  name: varchar("name", { length: 100 }).notNull().default("Default"),
  isDefault: boolean("isDefault").default(true).notNull(),
  
  // Style selection
  style: mysqlEnum("style", ["modern", "classic", "minimal"]).default("modern").notNull(),
  
  // Company Information
  companyName: varchar("companyName", { length: 255 }),
  companyNameAr: varchar("companyNameAr", { length: 255 }), // Arabic
  companyNameKu: varchar("companyNameKu", { length: 255 }), // Kurdish
  companyAddress: text("companyAddress"),
  companyAddressAr: text("companyAddressAr"),
  companyAddressKu: text("companyAddressKu"),
  companyPhone: varchar("companyPhone", { length: 50 }),
  companyPhone2: varchar("companyPhone2", { length: 50 }),
  companyEmail: varchar("companyEmail", { length: 255 }),
  companyWebsite: varchar("companyWebsite", { length: 255 }),
  
  // Logo
  logoUrl: varchar("logoUrl", { length: 500 }),
  logoWidth: int("logoWidth").default(150), // Logo width in pixels
  logoPosition: mysqlEnum("logoPosition", ["left", "center", "right"]).default("left"),
  
  // Colors (hex format)
  primaryColor: varchar("primaryColor", { length: 7 }).default("#3b82f6"), // Blue
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#10b981"), // Green
  accentColor: varchar("accentColor", { length: 7 }).default("#f59e0b"), // Amber
  textColor: varchar("textColor", { length: 7 }).default("#1f2937"), // Dark gray
  backgroundColor: varchar("backgroundColor", { length: 7 }).default("#ffffff"), // White
  
  // Font settings
  fontFamily: varchar("fontFamily", { length: 100 }).default("Arial"),
  fontSize: int("fontSize").default(10), // Base font size
  
  // Bank Details
  bankName: varchar("bankName", { length: 255 }),
  bankAccountName: varchar("bankAccountName", { length: 255 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 100 }),
  bankIban: varchar("bankIban", { length: 50 }),
  bankSwift: varchar("bankSwift", { length: 20 }),
  
  // Additional bank (for dual currency)
  bank2Name: varchar("bank2Name", { length: 255 }),
  bank2AccountName: varchar("bank2AccountName", { length: 255 }),
  bank2AccountNumber: varchar("bank2AccountNumber", { length: 100 }),
  bank2Currency: varchar("bank2Currency", { length: 10 }),
  
  // Footer
  footerText: text("footerText"),
  footerTextAr: text("footerTextAr"),
  footerTextKu: text("footerTextKu"),
  
  // Terms & Conditions
  termsText: text("termsText"),
  termsTextAr: text("termsTextAr"),
  termsTextKu: text("termsTextKu"),
  
  // Additional settings
  showQrCode: boolean("showQrCode").default(true),
  showWatermark: boolean("showWatermark").default(false),
  watermarkText: varchar("watermarkText", { length: 100 }),
  
  // Invoice number format
  invoicePrefix: varchar("invoicePrefix", { length: 20 }).default("INV"),
  invoiceNumberDigits: int("invoiceNumberDigits").default(6),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdById: int("createdById"),
});

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type InsertInvoiceTemplate = typeof invoiceTemplates.$inferInsert;



// ============ NOTIFICATION TEMPLATES ============
export const notificationTemplates = mysqlTable("notificationTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template identification
  eventType: mysqlEnum("eventType", [
    "package_received", 
    "package_shipped", 
    "package_arrived", 
    "package_delivered",
    "payment_received",
    "invoice_created",
    "batch_shipped",
    "batch_arrived",
    "custom"
  ]).notNull(),
  
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  
  // Message templates (with placeholders like {customerName}, {trackingNumber}, etc.)
  smsTemplate: text("smsTemplate"),
  smsTemplateAr: text("smsTemplateAr"),
  smsTemplateKu: text("smsTemplateKu"),
  
  whatsappTemplate: text("whatsappTemplate"),
  whatsappTemplateAr: text("whatsappTemplateAr"),
  whatsappTemplateKu: text("whatsappTemplateKu"),
  
  emailSubject: varchar("emailSubject", { length: 255 }),
  emailSubjectAr: varchar("emailSubjectAr", { length: 255 }),
  emailSubjectKu: varchar("emailSubjectKu", { length: 255 }),
  emailTemplate: text("emailTemplate"),
  emailTemplateAr: text("emailTemplateAr"),
  emailTemplateKu: text("emailTemplateKu"),
  
  pushTitle: varchar("pushTitle", { length: 100 }),
  pushTitleAr: varchar("pushTitleAr", { length: 100 }),
  pushTitleKu: varchar("pushTitleKu", { length: 100 }),
  pushTemplate: text("pushTemplate"),
  pushTemplateAr: text("pushTemplateAr"),
  pushTemplateKu: text("pushTemplateKu"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// ============ LABEL TEMPLATES ============
export const labelTemplates = mysqlTable("labelTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  
  // Label size
  size: mysqlEnum("size", ["10x15", "10x10", "A6", "A5", "custom"]).default("10x15").notNull(),
  widthMm: int("widthMm").default(100),
  heightMm: int("heightMm").default(150),
  
  // QR Code settings
  showQrCode: boolean("showQrCode").default(true).notNull(),
  qrCodeSize: int("qrCodeSize").default(80), // Size in pixels
  qrCodePosition: mysqlEnum("qrCodePosition", ["top-left", "top-right", "bottom-left", "bottom-right", "center"]).default("top-right"),
  
  // Barcode settings
  showBarcode: boolean("showBarcode").default(true).notNull(),
  barcodeType: mysqlEnum("barcodeType", ["code128", "code39", "ean13", "qr"]).default("code128"),
  
  // Logo settings
  showLogo: boolean("showLogo").default(true).notNull(),
  logoUrl: varchar("logoUrl", { length: 500 }),
  logoWidth: int("logoWidth").default(60),
  
  // Fields to show
  showTrackingNumber: boolean("showTrackingNumber").default(true).notNull(),
  showCustomerName: boolean("showCustomerName").default(true).notNull(),
  showCustomerCode: boolean("showCustomerCode").default(true).notNull(),
  showCustomerPhone: boolean("showCustomerPhone").default(true).notNull(),
  showDestinationCity: boolean("showDestinationCity").default(true).notNull(),
  showWeight: boolean("showWeight").default(true).notNull(),
  showDimensions: boolean("showDimensions").default(false).notNull(),
  showShippingType: boolean("showShippingType").default(true).notNull(),
  showBatchNumber: boolean("showBatchNumber").default(true).notNull(),
  showDate: boolean("showDate").default(true).notNull(),
  showPrice: boolean("showPrice").default(false).notNull(),
  
  // Style settings
  primaryColor: varchar("primaryColor", { length: 7 }).default("#000000"),
  fontFamily: varchar("fontFamily", { length: 100 }).default("Arial"),
  fontSize: int("fontSize").default(12),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LabelTemplate = typeof labelTemplates.$inferSelect;
export type InsertLabelTemplate = typeof labelTemplates.$inferInsert;


// ============ STOCK/INVENTORY MANAGEMENT SYSTEM ============

// Stock Categories
export const stockCategories = mysqlTable("stockCategories", {
  id: int("id").autoincrement().primaryKey(),
  
  name: varchar("name", { length: 100 }).notNull(),
  nameKu: varchar("nameKu", { length: 100 }), // Kurdish name
  nameAr: varchar("nameAr", { length: 100 }), // Arabic name
  slug: varchar("slug", { length: 100 }).unique(),
  description: text("description"),
  parentId: int("parentId"), // For subcategories
  image: varchar("image", { length: 500 }),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockCategory = typeof stockCategories.$inferSelect;
export type InsertStockCategory = typeof stockCategories.$inferInsert;

// Stock Products - Product catalog
export const stockProducts = mysqlTable("stockProducts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Basic info
  sku: varchar("sku", { length: 50 }).notNull().unique(), // Stock Keeping Unit
  barcode: varchar("barcode", { length: 100 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameKu: varchar("nameKu", { length: 255 }), // Kurdish name
  nameAr: varchar("nameAr", { length: 255 }), // Arabic name
  nameCn: varchar("nameCn", { length: 255 }), // Chinese name
  
  // Category
  categoryId: int("categoryId"),
  
  // Description
  description: text("description"),
  shortDescription: varchar("shortDescription", { length: 500 }),
  
  // Images
  mainImage: varchar("mainImage", { length: 500 }),
  images: json("images").$type<string[]>(),
  
  // Pricing
  costPrice: decimal("costPrice", { precision: 10, scale: 2 }).default("0"), // Average cost
  sellingPrice: decimal("sellingPrice", { precision: 10, scale: 2 }).default("0"),
  minSellingPrice: decimal("minSellingPrice", { precision: 10, scale: 2 }), // Minimum allowed price
  
  // Stock settings
  unit: varchar("unit", { length: 50 }).default("piece"), // piece, kg, meter, box
  minStockLevel: int("minStockLevel").default(5), // Alert when below this
  maxStockLevel: int("maxStockLevel"), // Maximum to keep in stock
  reorderQuantity: int("reorderQuantity").default(10), // How many to order when low
  
  // Current stock (denormalized for quick access)
  currentStock: int("currentStock").default(0),
  reservedStock: int("reservedStock").default(0), // Reserved for pending orders
  availableStock: int("availableStock").default(0), // currentStock - reservedStock
  
  // Tracking
  trackInventory: boolean("trackInventory").default(true).notNull(),
  allowNegativeStock: boolean("allowNegativeStock").default(false).notNull(),
  
  // Physical properties
  weight: decimal("weight", { precision: 8, scale: 3 }), // in kg
  length: decimal("length", { precision: 8, scale: 2 }), // in cm
  width: decimal("width", { precision: 8, scale: 2 }),
  height: decimal("height", { precision: 8, scale: 2 }),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  
  // Supplier info
  defaultSupplierId: int("defaultSupplierId"),
  supplierSku: varchar("supplierSku", { length: 100 }), // Supplier's product code
  
  // Metadata
  tags: json("tags").$type<string[]>(),
  notes: text("notes"),
  
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockProduct = typeof stockProducts.$inferSelect;
export type InsertStockProduct = typeof stockProducts.$inferInsert;

// Stock Purchases - Purchases from suppliers
export const stockPurchases = mysqlTable("stockPurchases", {
  id: int("id").autoincrement().primaryKey(),
  
  // Purchase code
  purchaseCode: varchar("purchaseCode", { length: 50 }).notNull().unique(), // PO-2024-0001
  
  // Supplier
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 255 }), // For quick reference
  
  // Warehouse
  warehouseId: int("warehouseId"),
  
  // Status
  status: mysqlEnum("status", [
    "draft",      // Just created
    "ordered",    // Order sent to supplier
    "shipped",    // Supplier shipped
    "received",   // Received at warehouse
    "cancelled"   // Cancelled
  ]).default("draft").notNull(),
  
  // Dates
  orderDate: timestamp("orderDate"),
  expectedDate: timestamp("expectedDate"),
  receivedDate: timestamp("receivedDate"),
  
  // Amounts
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0"),
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }).default("0"),
  otherCosts: decimal("otherCosts", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).default("0"),
  
  // Currency
  currency: varchar("currency", { length: 3 }).default("USD"),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 4 }).default("1"),
  
  // Payment
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid"]).default("unpaid"),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0"),
  
  // Notes
  notes: text("notes"),
  internalNotes: text("internalNotes"),
  
  // Audit
  createdById: int("createdById"),
  receivedById: int("receivedById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockPurchase = typeof stockPurchases.$inferSelect;
export type InsertStockPurchase = typeof stockPurchases.$inferInsert;

// Stock Purchase Items - Line items for purchases
export const stockPurchaseItems = mysqlTable("stockPurchaseItems", {
  id: int("id").autoincrement().primaryKey(),
  
  purchaseId: int("purchaseId").notNull(),
  productId: int("productId").notNull(),
  
  // Quantities
  orderedQuantity: int("orderedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").default(0),
  
  // Pricing
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).notNull(),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockPurchaseItem = typeof stockPurchaseItems.$inferSelect;
export type InsertStockPurchaseItem = typeof stockPurchaseItems.$inferInsert;

// Stock Sales - Sales to customers (both account and cash)
export const stockSales = mysqlTable("stockSales", {
  id: int("id").autoincrement().primaryKey(),
  
  // Sale code
  saleCode: varchar("saleCode", { length: 50 }).notNull().unique(), // SO-2024-0001 or POS-2024-0001
  
  // Sale type
  saleType: mysqlEnum("saleType", ["account", "cash"]).default("account").notNull(),
  
  // Customer (optional for cash sales)
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 255 }), // For quick reference or walk-in
  customerPhone: varchar("customerPhone", { length: 20 }), // For walk-in customers
  
  // Warehouse
  warehouseId: int("warehouseId"),
  
  // Status
  status: mysqlEnum("status", [
    "draft",      // Just created
    "confirmed",  // Confirmed, ready to ship
    "shipped",    // Shipped to customer
    "delivered",  // Delivered
    "cancelled",  // Cancelled
    "returned"    // Returned
  ]).default("confirmed").notNull(),
  
  // Dates
  saleDate: timestamp("saleDate").defaultNow(),
  shippedDate: timestamp("shippedDate"),
  deliveredDate: timestamp("deliveredDate"),
  
  // Amounts
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }).default("0"),
  shippingCharge: decimal("shippingCharge", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default("0"),
  
  // Cost & Profit
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).default("0"),
  profit: decimal("profit", { precision: 12, scale: 2 }).default("0"),
  profitMargin: decimal("profitMargin", { precision: 5, scale: 2 }).default("0"), // Percentage
  
  // Payment (for cash sales)
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "transfer", "balance"]).default("cash"),
  amountReceived: decimal("amountReceived", { precision: 12, scale: 2 }).default("0"),
  changeGiven: decimal("changeGiven", { precision: 10, scale: 2 }).default("0"),
  
  // For account sales
  addedToLedger: boolean("addedToLedger").default(false),
  ledgerTransactionId: int("ledgerTransactionId"),
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdById: int("createdById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockSale = typeof stockSales.$inferSelect;
export type InsertStockSale = typeof stockSales.$inferInsert;

// Stock Sale Items - Line items for sales
export const stockSaleItems = mysqlTable("stockSaleItems", {
  id: int("id").autoincrement().primaryKey(),
  
  saleId: int("saleId").notNull(),
  productId: int("productId").notNull(),
  
  // Product info (denormalized for history)
  productName: varchar("productName", { length: 255 }),
  productSku: varchar("productSku", { length: 50 }),
  
  // Quantities
  quantity: int("quantity").notNull(),
  
  // Pricing
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 12, scale: 2 }).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockSaleItem = typeof stockSaleItems.$inferSelect;
export type InsertStockSaleItem = typeof stockSaleItems.$inferInsert;

// Stock Movements - All inventory movements
export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  
  // Product
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId"),
  
  // Movement type
  movementType: mysqlEnum("movementType", [
    "purchase_in",    // Stock received from purchase
    "sale_out",       // Stock sold
    "adjustment_in",  // Manual adjustment (increase)
    "adjustment_out", // Manual adjustment (decrease)
    "transfer_in",    // Transfer from another warehouse
    "transfer_out",   // Transfer to another warehouse
    "return_in",      // Customer return
    "return_out",     // Return to supplier
    "damage_out"      // Damaged/expired stock
  ]).notNull(),
  
  // Quantity (positive for in, negative for out)
  quantity: int("quantity").notNull(),
  
  // Stock levels
  stockBefore: int("stockBefore").notNull(),
  stockAfter: int("stockAfter").notNull(),
  
  // Cost tracking
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }),
  
  // Reference
  referenceType: varchar("referenceType", { length: 50 }), // purchase, sale, adjustment
  referenceId: int("referenceId"),
  referenceCode: varchar("referenceCode", { length: 50 }), // PO-2024-0001, SO-2024-0001
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdById: int("createdById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;


// ============ REVENUE RECORDS (تۆماری داهات) ============
export const revenueRecords = mysqlTable("revenueRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // Date and identification
  recordDate: timestamp("recordDate").notNull(),
  recordNumber: varchar("recordNumber", { length: 50 }).notNull().unique(), // REV-20241225-0001
  
  // Revenue type
  revenueType: mysqlEnum("revenueType", [
    "package_delivery",    // داهاتی گەیاندنی پاکەت
    "full_package_sale",   // داهاتی فرۆشتنی فولپاکێج
    "full_package_commission", // عمولەی فولپاکێج
    "service_fee",         // کرێی خزمەتگوزاری
    "extra_service",       // خزمەتگوزاری زیادە
    "shipping_fee",        // کرێی گواستنەوە
    "other"                // داهاتی تر
  ]).notNull(),
  
  // Amounts
  amountUsd: decimal("amountUsd", { precision: 12, scale: 2 }).notNull(),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }),
  
  // Cost (for profit calculation)
  costUsd: decimal("costUsd", { precision: 12, scale: 2 }).default("0"),
  profitUsd: decimal("profitUsd", { precision: 12, scale: 2 }).default("0"),
  
  // Reference to source
  referenceType: mysqlEnum("referenceType", ["package", "fullPackageOrder", "invoice", "service", "manual"]),
  referenceId: int("referenceId"),
  
  // Customer info
  customerId: int("customerId"),
  
  // Description
  description: text("description"),
  
  // Status
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"]).default("confirmed").notNull(),
  
  // Audit
  createdById: int("createdById").notNull(),
  confirmedById: int("confirmedById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RevenueRecord = typeof revenueRecords.$inferSelect;
export type InsertRevenueRecord = typeof revenueRecords.$inferInsert;

// ============ DAILY FINANCIAL SUMMARY (پوختەی دارایی ڕۆژانە) ============
export const dailyFinancialSummary = mysqlTable("dailyFinancialSummary", {
  id: int("id").autoincrement().primaryKey(),
  
  // Date
  summaryDate: timestamp("summaryDate").notNull().unique(),
  
  // Revenue breakdown
  totalRevenue: decimal("totalRevenue", { precision: 14, scale: 2 }).default("0").notNull(),
  packageRevenue: decimal("packageRevenue", { precision: 14, scale: 2 }).default("0"),
  fullPackageRevenue: decimal("fullPackageRevenue", { precision: 14, scale: 2 }).default("0"),
  serviceRevenue: decimal("serviceRevenue", { precision: 14, scale: 2 }).default("0"),
  otherRevenue: decimal("otherRevenue", { precision: 14, scale: 2 }).default("0"),
  
  // Expense breakdown
  totalExpenses: decimal("totalExpenses", { precision: 14, scale: 2 }).default("0").notNull(),
  shippingExpenses: decimal("shippingExpenses", { precision: 14, scale: 2 }).default("0"),
  purchaseExpenses: decimal("purchaseExpenses", { precision: 14, scale: 2 }).default("0"),
  operationalExpenses: decimal("operationalExpenses", { precision: 14, scale: 2 }).default("0"),
  otherExpenses: decimal("otherExpenses", { precision: 14, scale: 2 }).default("0"),
  
  // Profit
  grossProfit: decimal("grossProfit", { precision: 14, scale: 2 }).default("0"),
  netProfit: decimal("netProfit", { precision: 14, scale: 2 }).default("0"),
  
  // Cash flow
  cashIn: decimal("cashIn", { precision: 14, scale: 2 }).default("0"),
  cashOut: decimal("cashOut", { precision: 14, scale: 2 }).default("0"),
  netCashFlow: decimal("netCashFlow", { precision: 14, scale: 2 }).default("0"),
  
  // Counts
  packagesDelivered: int("packagesDelivered").default(0),
  fullPackagesSold: int("fullPackagesSold").default(0),
  invoicesIssued: int("invoicesIssued").default(0),
  paymentsReceived: int("paymentsReceived").default(0),
  
  // Receivables & Payables
  totalReceivables: decimal("totalReceivables", { precision: 14, scale: 2 }).default("0"),
  totalPayables: decimal("totalPayables", { precision: 14, scale: 2 }).default("0"),
  
  // Status
  isFinalized: boolean("isFinalized").default(false).notNull(),
  finalizedAt: timestamp("finalizedAt"),
  finalizedById: int("finalizedById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyFinancialSummary = typeof dailyFinancialSummary.$inferSelect;
export type InsertDailyFinancialSummary = typeof dailyFinancialSummary.$inferInsert;


// ============ BLOG POSTS (Announcements) ============

export const blogPosts = mysqlTable("blogPosts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Title in multiple languages
  titleEn: varchar("titleEn", { length: 500 }).notNull(),
  titleKu: varchar("titleKu", { length: 500 }),
  titleAr: varchar("titleAr", { length: 500 }),
  
  // Content in multiple languages (rich text/HTML)
  contentEn: text("contentEn").notNull(),
  contentKu: text("contentKu"),
  contentAr: text("contentAr"),
  
  // Summary/excerpt for preview
  summaryEn: text("summaryEn"),
  summaryKu: text("summaryKu"),
  summaryAr: text("summaryAr"),
  
  // Cover image
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  
  // Category/type
  category: mysqlEnum("category", ["announcement", "news", "promotion", "update", "guide"]).default("announcement").notNull(),
  
  // Status
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  
  // Featured flag (show prominently)
  isFeatured: boolean("isFeatured").default(false).notNull(),
  
  // Scheduling
  publishedAt: timestamp("publishedAt"),
  expiresAt: timestamp("expiresAt"), // Optional expiry date
  
  // SEO
  slug: varchar("slug", { length: 255 }).unique(),
  
  // Engagement
  viewCount: int("viewCount").default(0).notNull(),
  
  // Author
  authorId: int("authorId").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;


// ============ DELETION LOGS (Data Management History) ============

export const deletionLogs = mysqlTable("deletionLogs", {
  id: int("id").autoincrement().primaryKey(),
  
  // What was deleted
  category: varchar("category", { length: 100 }).notNull(), // customers, packages, batches, etc.
  deletionType: mysqlEnum("deletionType", ["single_category", "old_data", "test_data", "factory_reset"]).notNull(),
  
  // How many records were deleted
  recordCount: int("recordCount").notNull(),
  
  // Details about what was deleted (JSON for flexibility)
  details: json("details").$type<{
    filters?: Record<string, any>;
    dateRange?: { from: string; to: string };
    affectedTables?: string[];
    sampleIds?: number[];
  }>(),
  
  // Backup info (if backup was created)
  backupCreated: boolean("backupCreated").default(false).notNull(),
  backupFileUrl: varchar("backupFileUrl", { length: 500 }),
  backupFileName: varchar("backupFileName", { length: 255 }),
  
  // Who performed the deletion
  deletedById: int("deletedById").notNull(),
  deletedByName: varchar("deletedByName", { length: 255 }),
  
  // When
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  
  // IP address for security audit
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  // Notes/reason for deletion
  reason: text("reason"),
});

export type DeletionLog = typeof deletionLogs.$inferSelect;
export type InsertDeletionLog = typeof deletionLogs.$inferInsert;


// ============ PURCHASE REQUESTS (داواکاری کڕین) ============


// ============ BACKUP MANAGEMENT ============

export const backups = mysqlTable("backups", {
  id: int("id").autoincrement().primaryKey(),
  
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }), // in bytes
  
  backupType: mysqlEnum("backupType", ["manual", "scheduled"]).default("manual").notNull(),
  backupContent: mysqlEnum("backupContent", ["database_only", "files_only", "full"]).default("database_only").notNull(),
  schedule: mysqlEnum("schedule", ["daily", "weekly", "monthly"]),
  status: mysqlEnum("status", ["in_progress", "completed", "failed"]).default("in_progress").notNull(),
  
  // For full backups
  filesZipUrl: varchar("filesZipUrl", { length: 500 }),
  filesZipSize: bigint("filesZipSize", { mode: "number" }),
  filesCount: int("filesCount"),
  
  errorMessage: text("errorMessage"),
  databaseName: varchar("databaseName", { length: 100 }),
  tablesCount: int("tablesCount"),
  recordsCount: int("recordsCount"),
  
  createdById: int("createdById"),
  createdByName: varchar("createdByName", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  expiresAt: timestamp("expiresAt"),
});

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = typeof backups.$inferInsert;



// ============ CURRENCIES ============

export const currencies = mysqlTable("currencies", {
  id: int("id").autoincrement().primaryKey(),
  
  code: varchar("code", { length: 10 }).notNull().unique(), // USD, EUR, IQD
  name: varchar("name", { length: 100 }).notNull(), // US Dollar, Euro, Iraqi Dinar
  symbol: varchar("symbol", { length: 10 }).notNull(), // $, €, د.ع
  exchangeRate: decimal("exchangeRate", { precision: 20, scale: 6 }).notNull(), // rate to base currency
  isBaseCurrency: boolean("isBaseCurrency").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdById: int("createdById"),
  createdByName: varchar("createdByName", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Currency = typeof currencies.$inferSelect;
export type InsertCurrency = typeof currencies.$inferInsert;

// ============ TAX RATES ============

export const taxRates = mysqlTable("tax_rates", {
  id: int("id").autoincrement().primaryKey(),
  
  name: varchar("name", { length: 100 }).notNull(), // VAT, Sales Tax, etc.
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(), // 15.00 for 15%
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  description: text("description"),
  
  createdById: int("createdById"),
  createdByName: varchar("createdByName", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxRate = typeof taxRates.$inferSelect;
export type InsertTaxRate = typeof taxRates.$inferInsert;

// ============ EMAIL TEMPLATES ============

export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  
  name: varchar("name", { length: 100 }).notNull().unique(), // low_stock_alert, invoice_sent
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(), // HTML template with {{variables}}
  variables: text("variables"), // JSON array of available variables
  category: mysqlEnum("category", ["notification", "invoice", "report", "alert"]).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdById: int("createdById"),
  createdByName: varchar("createdByName", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ============ IP WHITELIST ============

export const ipWhitelist = mysqlTable("ip_whitelist", {
  id: int("id").autoincrement().primaryKey(),
  
  ipAddress: varchar("ipAddress", { length: 45 }).notNull().unique(), // supports IPv6
  description: varchar("description", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdById: int("createdById"),
  createdByName: varchar("createdByName", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IpWhitelist = typeof ipWhitelist.$inferSelect;
export type InsertIpWhitelist = typeof ipWhitelist.$inferInsert;


// ============ ACTIVITY ALERTS ============

export const activityAlerts = mysqlTable("activity_alerts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Alert details
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  category: mysqlEnum("category", ["customer", "package", "batch", "full_package", "purchase_request", "commission", "finance", "settings", "user", "system", "security"]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  
  // Related entity
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  entityCode: varchar("entityCode", { length: 100 }),
  
  // Related audit log
  auditLogId: int("auditLogId"),
  
  // Action that triggered the alert
  action: varchar("action", { length: 100 }).notNull(),
  
  // User who performed the action
  triggeredById: int("triggeredById"),
  triggeredByName: varchar("triggeredByName", { length: 255 }),
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  readById: int("readById"),
  
  // Notification status
  notificationSent: boolean("notificationSent").default(false).notNull(),
  notificationSentAt: timestamp("notificationSentAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityAlert = typeof activityAlerts.$inferSelect;
export type InsertActivityAlert = typeof activityAlerts.$inferInsert;


// ============ SUPPORT CHATS ============

export const supportChats = mysqlTable("support_chats", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer info
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }),
  customerCode: varchar("customerCode", { length: 100 }),
  
  // Chat info
  subject: varchar("subject", { length: 255 }),
  category: mysqlEnum("category", ["order_status", "pricing", "payment", "general", "complaint", "other"]).default("general").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  
  // Status
  status: mysqlEnum("status", ["open", "pending", "resolved", "closed"]).default("open").notNull(),
  
  // Assignment
  assignedToId: int("assignedToId"),
  assignedToName: varchar("assignedToName", { length: 255 }),
  
  // Timestamps
  lastMessageAt: timestamp("lastMessageAt"),
  resolvedAt: timestamp("resolvedAt"),
  closedAt: timestamp("closedAt"),
  
  // Metadata
  unreadByCustomer: int("unreadByCustomer").default(0).notNull(),
  unreadByStaff: int("unreadByStaff").default(0).notNull(),
  totalMessages: int("totalMessages").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupportChat = typeof supportChats.$inferSelect;
export type InsertSupportChat = typeof supportChats.$inferInsert;

// ============ CHAT MESSAGES ============

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Chat reference
  chatId: int("chatId").notNull(),
  
  // Sender info
  senderType: mysqlEnum("senderType", ["customer", "staff", "system", "bot"]).notNull(),
  senderId: int("senderId"),
  senderName: varchar("senderName", { length: 255 }),
  
  // Message content
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "file", "system"]).default("text").notNull(),
  
  // Attachments
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentType: varchar("attachmentType", { length: 100 }),
  
  // Status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ============ CUSTOMER CODE PREFIXES ============

export const customerCodePrefixes = mysqlTable("customer_code_prefixes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 10 }).unique().notNull(), // AZ, WZ, TR, etc.
  label: varchar("label", { length: 100 }).notNull(), // Azerbaijan, Wazn, Turkey, etc.
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerCodePrefix = typeof customerCodePrefixes.$inferSelect;
export type InsertCustomerCodePrefix = typeof customerCodePrefixes.$inferInsert;



// ============ EXPENSE ALERTS (Automatic Notification System) ============

export const expenseAlerts = mysqlTable("expenseAlerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alertType", ["daily", "weekly", "monthly", "per_transaction"]).notNull(),
  thresholdAmount: decimal("thresholdAmount", { precision: 12, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  categoryId: int("categoryId"), // null = all categories, specific = only that category
  isEnabled: boolean("isEnabled").default(true).notNull(),
  notifyMethod: mysqlEnum("notifyMethod", ["system", "email", "both"]).default("system").notNull(),
  description: text("description"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExpenseAlert = typeof expenseAlerts.$inferSelect;
export type InsertExpenseAlert = typeof expenseAlerts.$inferInsert;

export const expenseAlertLogs = mysqlTable("expenseAlertLogs", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull(),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
  totalExpenses: decimal("totalExpenses", { precision: 12, scale: 2 }).notNull(),
  thresholdAmount: decimal("thresholdAmount", { precision: 12, scale: 2 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  expenseCount: int("expenseCount").default(0).notNull(),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  details: text("details"), // JSON with expense breakdown
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExpenseAlertLog = typeof expenseAlertLogs.$inferSelect;
export type InsertExpenseAlertLog = typeof expenseAlertLogs.$inferInsert;
