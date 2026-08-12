import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

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

// ============ RECYCLE BIN ============

/**
 * A deleted record, kept whole so it can be put back.
 *
 * Stores a snapshot of the row rather than marking the original with a
 * `deletedAt`. Soft-deleting a batch would have meant auditing thirty-six
 * separate queries across nine files for a `deletedAt IS NULL` filter, and a
 * single one missed leaks a deleted shipment back into a report or the
 * customer portal. A snapshot cannot leak: the row is genuinely gone, and
 * the bin is the only thing that still knows about it.
 *
 * `entityType` keeps this general. Every section can put things here without
 * a table of its own, which is the point — a bin per section would be a
 * dozen slightly different bins.
 *
 * Types that already carry their own `deletedAt` (full-package orders) are
 * NOT copied here. They are read through the same bin screen from their own
 * table, because things reference an order and its history has to survive.
 * The bin is a view over "what was deleted", not a second storage policy.
 */
export const deletedRecords = mysqlTable("deletedRecords", {
  id: int("id").autoincrement().primaryKey(),

  entityType: varchar("entityType", { length: 50 }).notNull(),
  /** Id the record had before it was deleted. Not a foreign key: the row it
   *  pointed at no longer exists, which is the whole idea. */
  entityId: int("entityId").notNull(),
  /** What to show in the bin — a batch code, a customer name. Denormalised
   *  on purpose: the record it came from is gone, so nothing can be joined. */
  label: varchar("label", { length: 255 }).notNull(),

  /** The complete row, exactly as it was, so restoring is a re-insert. */
  snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),

  deletedById: int("deletedById").notNull(),
  deletedByName: varchar("deletedByName", { length: 255 }),
  deletionReason: text("deletionReason"),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
}, (table) => ({
  // The bin lists newest first, and filters by type.
  deletedAtIdx: index("idx_deleted_records_deleted_at").on(table.deletedAt),
  entityIdx: index("idx_deleted_records_entity").on(table.entityType, table.entityId),
}));

export type DeletedRecord = typeof deletedRecords.$inferSelect;
export type InsertDeletedRecord = typeof deletedRecords.$inferInsert;
