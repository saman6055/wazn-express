import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

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
}, (table) => ({
  statusIdx: index("idx_batches_status").on(table.status),
  shippingTypeIdx: index("idx_batches_shipping_type").on(table.shippingType),
  createdAtIdx: index("idx_batches_created_at").on(table.createdAt),
}));

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

// ============ PACKAGES ============




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
}, (table) => ({
  // Live-pricing recompute fetches tiers per batch on portal batch views.
  batchIdIdx: index("idx_batch_pricing_tiers_batch_id").on(table.batchId),
}));
export type BatchPricingTier = typeof batchPricingTiers.$inferSelect;
export type InsertBatchPricingTier = typeof batchPricingTiers.$inferInsert;


// ============ BATCH CUSTOMER PRICING (نرخی تایبەت بۆ کڕیار) ============



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
}, (table) => ({
  batchCustomerIdx: index("idx_batch_customer_pricing").on(table.batchId, table.customerId),
}));
export type BatchCustomerPricing = typeof batchCustomerPricing.$inferSelect;
export type InsertBatchCustomerPricing = typeof batchCustomerPricing.$inferInsert;


// ============ NOTIFICATION SETTINGS (Global) ============