import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

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
  // Volumetric billing: air charges the greater of scale weight and
  // (L×W×H)/divisor, so a light bulky carton can cost several times what the
  // scale suggests. These three record that the customer was told and that
  // somebody signed it off. Never a gate on batching — only a trail.
  volumetricNotifiedAt: timestamp("volumetricNotifiedAt"),
  volumetricAckAt: timestamp("volumetricAckAt"),
  volumetricAckById: int("volumetricAckById"),
  recipientName: varchar("recipientName", { length: 255 }),
  recipientSignature: text("recipientSignature"),
  deliveryPhoto: text("deliveryPhoto"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  customerIdIdx: index("idx_packages_customer_id").on(table.customerId),
  batchIdIdx: index("idx_packages_batch_id").on(table.batchId),
  statusIdx: index("idx_packages_status").on(table.status),
  trackingNumberIdx: index("idx_packages_tracking_number").on(table.trackingNumber),
  createdAtIdx: index("idx_packages_created_at").on(table.createdAt),
}));

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

// ============ PACKAGE ↔ FULL-PACKAGE-ORDER LINKS (multi-link) ============
// Why this table exists:
//   - One physical package can carry items from N orders (shared tracking, "same carton").
//   - One full-package order can be split across N physical packages (multi-tracking).
//   - The legacy single FK packages.fullPackageOrderId only models 1-to-1.
// This join table makes both relationships first-class so batch sync, status
// reconciliation, and accounting all see every linked order, not just the first.
//
// Invariants enforced elsewhere (not at DB level):
//   - All orders linked to one package share the SAME customerId (single-customer rule).
//   - Exactly one row per package has isPrimary=TRUE (the one mirrored into
//     packages.fullPackageOrderId for legacy code paths).
export const packageOrderLinks = mysqlTable("packageOrderLinks", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  fullPackageOrderId: int("fullPackageOrderId").notNull(),
  // For multi-tracking case: which carton (1..N) within the order this package represents.
  // For shared-tracking case: same cartonIndex across the linked orders (it's their shared carton).
  cartonIndex: int("cartonIndex").default(1).notNull(),
  // The "canonical" link for legacy FK compatibility (packages.fullPackageOrderId).
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // One package cannot link to the same order twice.
  uniqPackageOrder: index("uniq_pol_pkg_order").on(table.packageId, table.fullPackageOrderId),
  packageIdIdx: index("idx_pol_package_id").on(table.packageId),
  orderIdIdx: index("idx_pol_order_id").on(table.fullPackageOrderId),
}));

export type PackageOrderLink = typeof packageOrderLinks.$inferSelect;
export type InsertPackageOrderLink = typeof packageOrderLinks.$inferInsert;

// ============ LEDGER ENTRIES - REMOVED ============
// The ledgerEntries table has been completely removed.
// All financial transactions now use the unified ledgerTransactions table.
// See ledgerTransactions table below for the new unified financial system.

// ============ INVOICES ============


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
  
  // Customer's note/reason for claiming (required at the app layer)
  customerNote: text("customerNote"),
  // Proof of ownership uploaded by the customer — purchase screenshots,
  // supplier/WeChat photos, etc. (at least one required at the app layer).
  proofImages: json("proofImages").$type<string[]>(),

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


// ============ DELIVERY BOX SYSTEM ============
// بۆکسی گەیاندن — کۆکردنەوەی چەندین پاکەت لە سەرچاوەی جیاواز بۆ گەیاندن بە کڕیار

export const deliveryBoxes = mysqlTable("deliveryBoxes", {
  id: int("id").autoincrement().primaryKey(),
  boxCode: varchar("boxCode", { length: 50 }).notNull().unique(), // BOX-20260324-001

  // کڕیار
  customerId: int("customerId").notNull(),

  // باچ — set when auto-created for a specific batch; null for manual delivery boxes
  batchId: int("batchId"),

  // جۆری گەیاندن
  deliveryMethod: mysqlEnum("deliveryMethod", ["warehouse_pickup", "home_delivery", "city_transfer"]).default("warehouse_pickup").notNull(),
  destinationCity: varchar("destinationCity", { length: 100 }),
  destinationAddress: text("destinationAddress"),
  recipientName: varchar("recipientName", { length: 255 }),
  recipientPhone: varchar("recipientPhone", { length: 20 }),

  // تێچوو و نرخی گەیاندن
  deliveryCostUsd: decimal("deliveryCostUsd", { precision: 10, scale: 2 }).default("0"), // تێچووی ڕاستەقینە بۆ کۆمپانیا
  deliveryChargeUsd: decimal("deliveryChargeUsd", { precision: 10, scale: 2 }).default("0"), // نرخ بۆ کڕیار
  deliveryProfitUsd: decimal("deliveryProfitUsd", { precision: 10, scale: 2 }).default("0"), // قازانج = charge - cost

  // ئامار
  totalPackages: int("totalPackages").default(0).notNull(),
  totalWeightKg: decimal("totalWeightKg", { precision: 10, scale: 3 }).default("0"),
  totalValueUsd: decimal("totalValueUsd", { precision: 10, scale: 2 }).default("0"), // کۆی نرخی پاکەتەکان

  // بارودۆخ
  status: mysqlEnum("status", ["open", "ready", "in_transit", "delivered", "cancelled"]).default("open").notNull(),

  // واژوو و وێنە
  signature: text("signature"), // base64
  deliveryPhoto: text("deliveryPhoto"),

  // ئینڤۆیس
  invoiceId: int("invoiceId"),
  isCharged: boolean("isCharged").default(false).notNull(), // ئایا نرخی گەیاندن لە والیت چووە

  // تێبینی
  notes: text("notes"),

  // کارمەندان
  createdById: int("createdById").notNull(),
  sealedById: int("sealedById"),
  deliveredById: int("deliveredById"),

  // When the customer confirmed receipt themselves, from the portal.
  //
  // Kept apart from deliveredById, which names the staff member who handed the
  // box over and took a signature. The day someone says "I never received it",
  // the company needs to know which of the two happened: a staff handover with
  // a signature, or the customer's own word. Writing a customer into a staff
  // field would erase that difference.
  customerConfirmedAt: timestamp("customerConfirmedAt"),

  // کاتەکان
  sealedAt: timestamp("sealedAt"),
  inTransitAt: timestamp("inTransitAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  batchIdIdx: index("idx_delivery_boxes_batch_id").on(table.batchId),
  customerIdIdx: index("idx_delivery_boxes_customer_id").on(table.customerId),
}));

export type DeliveryBox = typeof deliveryBoxes.$inferSelect;
export type InsertDeliveryBox = typeof deliveryBoxes.$inferInsert;

// ئایتمەکانی بۆکسی گەیاندن — هەر پاکەتێک لە ناو بۆکسدا
export const deliveryBoxItems = mysqlTable("deliveryBoxItems", {
  id: int("id").autoincrement().primaryKey(),
  boxId: int("boxId").notNull(), // FK → deliveryBoxes
  packageId: int("packageId"), // FK → packages (nullable)
  fullPackageOrderId: int("fullPackageOrderId"), // FK → fullPackageOrders (nullable)

  // snapshot زانیاری پاکەت کاتی سکان
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  packageCode: varchar("packageCode", { length: 50 }),
  description: text("description"),
  weightKg: decimal("weightKg", { precision: 10, scale: 3 }),
  calculatedCostUsd: decimal("calculatedCostUsd", { precision: 10, scale: 2 }),

  // جۆری پاکەت
  itemType: mysqlEnum("itemType", ["regular", "full_package", "commission"]).default("regular").notNull(),
  sourceInfo: varchar("sourceInfo", { length: 255 }), // "باچ AIR-001" یان "FP-00123"

  // سکان
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
  scannedById: int("scannedById").notNull(),
});

export type DeliveryBoxItem = typeof deliveryBoxItems.$inferSelect;
export type InsertDeliveryBoxItem = typeof deliveryBoxItems.$inferInsert;


// ============ CUSTOMER DECLARED (PRE-ALERT) PACKAGES ============
// Customers pre-declare an incoming purchase's tracking number from the
// portal BEFORE it physically arrives. When staff later register that
// tracking in Quick Register, the system auto-matches it to this customer —
// so a package that would otherwise land "unclaimed" is instantly owned.
// Only trackingNumber is required; everything else is optional context.
export const customerDeclaredPackages = mysqlTable("customerDeclaredPackages", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(), // FK → customers
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  // Free text, not an enum: platforms are productAttributes rows the admin
  // can extend, and the customer portal picks from that same list — so a shop
  // added for orders is immediately available here too.
  platform: varchar("platform", { length: 100 }),
  productName: varchar("productName", { length: 255 }),
  productImages: json("productImages").$type<string[]>(),
  categoryId: int("categoryId"), // optional FK → productCategories
  notes: text("notes"),
  purchaseDate: timestamp("purchaseDate"), // optional — when the customer bought it
  status: mysqlEnum("status", ["pending", "matched", "received", "cancelled"]).default("pending").notNull(),
  matchedPackageId: int("matchedPackageId"), // real package that fulfilled this declaration
  matchedAt: timestamp("matchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  trackingIdx: index("idx_cdp_tracking").on(table.trackingNumber),
  customerIdx: index("idx_cdp_customer").on(table.customerId),
  statusIdx: index("idx_cdp_status").on(table.status),
}));

export type CustomerDeclaredPackage = typeof customerDeclaredPackages.$inferSelect;
export type InsertCustomerDeclaredPackage = typeof customerDeclaredPackages.$inferInsert;


// Customer Messages - پەیامەکانی کڕیار (Chat System)