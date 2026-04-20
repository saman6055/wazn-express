import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

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
  productType: varchar("productType", { length: 200 }), // Product type/category
  
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

  // Advance payment tracking — paid at order creation time (partial or full)
  advancePaidUsd: decimal("advancePaidUsd", { precision: 10, scale: 2 }).default("0"),
  advancePaidAt: timestamp("advancePaidAt"),
  advancePaymentMethod: mysqlEnum("advancePaymentMethod", ["CASH","BANK_TRANSFER","FIB","FASTPAY","ZAINCASH","ASIAHAWALA","CARD","OTHER"]),
  advancePaymentTransactionId: int("advancePaymentTransactionId"),
  
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
  trackingNumber: varchar("trackingNumber", { length: 100 }), // Not unique — multiple orders can share same tracking (same carton)
  trackingNumbers: json("trackingNumbers").$type<string[]>(), // Multiple tracking numbers for one order
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

  // ============ SAFE EDIT/DELETE INFRASTRUCTURE (Plan v3, Phase 1) ============
  // These three columns exist so that edit + delete can be made atomic and
  // reversible without ever drifting the customer ledger.
  //
  // chargeTransactionId → FK to the DEBIT ledger transaction that originally
  //   charged this order to the customer. When the order is deleted or its
  //   price edited, we use this ID to locate and reverse/adjust the exact
  //   original charge instead of guessing.
  //
  // version → optimistic concurrency lock. Every edit increments this. The
  //   UI sends the version it loaded; if it doesn't match the DB row, we
  //   reject the edit (409 Conflict) — two people can never silently
  //   overwrite each other.
  //
  // deletedAt → soft-delete marker. We NEVER hard-delete order rows. All
  //   list/detail queries filter WHERE deletedAt IS NULL. This keeps the
  //   historical audit trail intact and makes deletions fully recoverable
  //   if the user realizes it was a mistake.
  chargeTransactionId: int("chargeTransactionId"), // FK → ledgerTransactions.id
  version: int("version").default(1).notNull(),
  deletedAt: timestamp("deletedAt"),
  deletedById: int("deletedById"), // Who soft-deleted this order
  deletionReason: text("deletionReason"), // Why it was deleted (shown in audit log)

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  deletedAtIdx: index("idx_fpo_deleted_at").on(table.deletedAt),
  chargeTxnIdx: index("idx_fpo_charge_txn_id").on(table.chargeTransactionId),
}));

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

// ============ FULL PACKAGE ORDER TRACKINGS (multiple trackings per order) ============

export const fullPackageOrderTrackings = mysqlTable("fullPackageOrderTrackings", {
  id: int("id").autoincrement().primaryKey(),
  fullPackageOrderId: int("fullPackageOrderId").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(), // Not unique — same tracking can be shared across orders (same carton)
  cartonIndex: int("cartonIndex"), // 1, 2, 3... for display order
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("idx_fpot_order_id").on(table.fullPackageOrderId),
}));

export type FullPackageOrderTracking = typeof fullPackageOrderTrackings.$inferSelect;
export type InsertFullPackageOrderTracking = typeof fullPackageOrderTrackings.$inferInsert;

// ============ CUSTOMER NOTIFICATION PREFERENCES ============
