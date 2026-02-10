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