import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

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

  // ---- Portal display (service list on customer portal) ----
  showOnPortal: boolean("showOnPortal").default(false).notNull(),
  portalDescriptionKu: text("portalDescriptionKu"),
  portalDescriptionEn: text("portalDescriptionEn"),
  portalDescriptionAr: text("portalDescriptionAr"),
  portalDescriptionZh: text("portalDescriptionZh"),
  portalBadge: varchar("portalBadge", { length: 30 }), // POPULAR|NEW|RECOMMENDED|null
  portalPriceLabelKu: varchar("portalPriceLabelKu", { length: 100 }), // "بە دۆلار/عدد"
  portalPriceLabelEn: varchar("portalPriceLabelEn", { length: 100 }), // "per item"
  portalPriceLabelAr: varchar("portalPriceLabelAr", { length: 100 }),
  portalPriceLabelZh: varchar("portalPriceLabelZh", { length: 100 }),

  // Metadata
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertServiceType = typeof serviceTypes.$inferInsert;


// Extra Services - خزمەتگوزاری زیادە



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

// ============ BATCH LABEL TEMPLATES (لەیبڵی باچ - یەک لەیبڵ بۆ هەر کڕیار) ============
export const batchLabelTemplates = mysqlTable("batchLabelTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  size: mysqlEnum("size", ["10x15", "10x10", "A6", "A5", "custom"]).default("10x15").notNull(),
  widthMm: int("widthMm").default(100),
  heightMm: int("heightMm").default(150),
  showQrCode: boolean("showQrCode").default(true).notNull(),
  qrCodeSize: int("qrCodeSize").default(80),
  qrCodePosition: mysqlEnum("qrCodePosition", ["top-left", "top-right", "bottom-left", "bottom-right", "center"]).default("top-right"),
  showBarcode: boolean("showBarcode").default(true).notNull(),
  barcodeType: mysqlEnum("barcodeType", ["code128", "code39", "ean13", "qr"]).default("code128"),
  showLogo: boolean("showLogo").default(true).notNull(),
  logoUrl: varchar("logoUrl", { length: 500 }),
  logoWidth: int("logoWidth").default(60),
  showCustomerName: boolean("showCustomerName").default(true).notNull(),
  showCustomerCode: boolean("showCustomerCode").default(true).notNull(),
  showTotalPackages: boolean("showTotalPackages").default(true).notNull(),
  showTotalWeight: boolean("showTotalWeight").default(true).notNull(),
  showTotalVolume: boolean("showTotalVolume").default(true).notNull(),
  showTotalPrice: boolean("showTotalPrice").default(true).notNull(),
  showBatchNumber: boolean("showBatchNumber").default(true).notNull(),
  showDate: boolean("showDate").default(true).notNull(),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#059669"),
  fontFamily: varchar("fontFamily", { length: 100 }).default("Arial"),
  fontSize: int("fontSize").default(12),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BatchLabelTemplate = typeof batchLabelTemplates.$inferSelect;
export type InsertBatchLabelTemplate = typeof batchLabelTemplates.$inferInsert;

// ============ STOCK/INVENTORY MANAGEMENT SYSTEM ============

// Stock Categories



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

  // Pinned flag — pinned posts sort to the very top of Wazn News.
  isPinned: boolean("isPinned").default(false).notNull(),
  
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

// ============ PORTAL TUTORIALS (how-to videos shown to customers) ============
//
// Short YouTube walkthroughs — "how to order from Taobao", "how to register a
// tracking number" — grouped into sections the admin controls from Portal
// Center. The video itself stays on YouTube: we store only the link, so an
// embedded play still counts toward the channel's views, and there is no video
// hosting to pay for or maintain.
//
// `category` is free text rather than an enum so a section can be a platform
// (Taobao, 1688) or a topic of its own ("Portal", "Payment"); the admin form
// offers the productAttributes platform list as suggestions.
export const portalTutorials = mysqlTable("portalTutorials", {
  id: int("id").autoincrement().primaryKey(),

  category: varchar("category", { length: 100 }).notNull(),

  titleKu: varchar("titleKu", { length: 300 }).notNull(),
  titleEn: varchar("titleEn", { length: 300 }),
  titleAr: varchar("titleAr", { length: 300 }),

  summaryKu: text("summaryKu"),
  summaryEn: text("summaryEn"),
  summaryAr: text("summaryAr"),

  // Full YouTube URL as pasted by the admin. The video id — and therefore the
  // thumbnail — is derived from it, so no image ever needs uploading.
  videoUrl: varchar("videoUrl", { length: 500 }).notNull(),
  durationSeconds: int("durationSeconds"),

  sortOrder: int("sortOrder").default(0).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  // Pinned to the top of the page — the one thing a new customer should watch.
  isFeatured: boolean("isFeatured").default(false).notNull(),

  // How often it was opened, and how often it was watched to the end: a large
  // gap between the two says the video is too long or unclear.
  viewCount: int("viewCount").default(0).notNull(),
  completedCount: int("completedCount").default(0).notNull(),
  helpfulCount: int("helpfulCount").default(0).notNull(),
  notHelpfulCount: int("notHelpfulCount").default(0).notNull(),

  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("idx_portal_tutorials_category").on(table.category),
  publishedIdx: index("idx_portal_tutorials_published").on(table.isPublished, table.sortOrder),
}));

export type PortalTutorial = typeof portalTutorials.$inferSelect;
export type InsertPortalTutorial = typeof portalTutorials.$inferInsert;
