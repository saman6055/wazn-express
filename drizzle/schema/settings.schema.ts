import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

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
  // ---- Portal display (price list on customer portal) ----
  showOnPortal: boolean("showOnPortal").default(false).notNull(),
  portalLabelKu: varchar("portalLabelKu", { length: 150 }),
  portalLabelEn: varchar("portalLabelEn", { length: 150 }),
  portalLabelAr: varchar("portalLabelAr", { length: 150 }),
  portalLabelZh: varchar("portalLabelZh", { length: 150 }),
  portalIcon: varchar("portalIcon", { length: 50 }),  // lucide icon name (Plane, Ship, Zap, etc.)
  portalColor: varchar("portalColor", { length: 30 }), // sky|teal|amber|purple|emerald|rose
  portalBadge: varchar("portalBadge", { length: 30 }), // POPULAR|NEW|RECOMMENDED|FAST
  portalSortOrder: int("portalSortOrder").default(0).notNull(),
  // ---- Audit ----
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = typeof pricingRules.$inferInsert;

// ============ PORTAL PRICE LIST SETTINGS (ڕێکخستنی لیستی نرخی پۆرتاڵ) ============
// Global settings for the customer-facing price list section shown on portal home.
// There is exactly ONE row (id=1). Admin edits it to customize section title,
// subtitle, visibility toggles, layout variant, and disclaimer per language.

export const portalPriceListSettings = mysqlTable("portalPriceListSettings", {
  id: int("id").autoincrement().primaryKey(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  // Titles & subtitles (4 languages)
  titleKu: varchar("titleKu", { length: 200 }),
  titleEn: varchar("titleEn", { length: 200 }),
  titleAr: varchar("titleAr", { length: 200 }),
  titleZh: varchar("titleZh", { length: 200 }),
  subtitleKu: varchar("subtitleKu", { length: 400 }),
  subtitleEn: varchar("subtitleEn", { length: 400 }),
  subtitleAr: varchar("subtitleAr", { length: 400 }),
  subtitleZh: varchar("subtitleZh", { length: 400 }),
  // Content toggles
  showShippingRates: boolean("showShippingRates").default(true).notNull(),
  showServices: boolean("showServices").default(true).notNull(),
  showRmbEquivalent: boolean("showRmbEquivalent").default(true).notNull(),
  showIqdEquivalent: boolean("showIqdEquivalent").default(false).notNull(),
  // Layout
  layoutVariant: mysqlEnum("layoutVariant", ["tabs", "stacked", "compact"]).default("tabs").notNull(),
  position: mysqlEnum("position", ["top", "belowHeader", "belowStats"]).default("belowHeader").notNull(),
  accentColor: varchar("accentColor", { length: 30 }).default("purple").notNull(),
  // Disclaimer (4 languages)
  disclaimerKu: text("disclaimerKu"),
  disclaimerEn: text("disclaimerEn"),
  disclaimerAr: text("disclaimerAr"),
  disclaimerZh: text("disclaimerZh"),
  // Audit
  updatedById: int("updatedById"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortalPriceListSettings = typeof portalPriceListSettings.$inferSelect;
export type InsertPortalPriceListSettings = typeof portalPriceListSettings.$inferInsert;

// ============ BATCHES (Shipment Groups) ============


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

// ============ PRODUCT ATTRIBUTES (ڕەنگ، قەبارە، جۆری کاڵا) ============

export const productAttributes = mysqlTable("productAttributes", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["color", "size", "productType"]).notNull(),
  value: varchar("value", { length: 200 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductAttribute = typeof productAttributes.$inferSelect;
export type InsertProductAttribute = typeof productAttributes.$inferInsert;
