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
  /**
   * Air waybill — the air equivalent of a container number, and the number
   * the carrier and customs both quote back at you. Neither it nor the
   * container number is known when the batch is created (the cartons are
   * still being filled), so both are nullable and editable afterwards.
   */
  awbNumber: varchar("awbNumber", { length: 50 }),
  /**
   * The tracking numbers of the shipments that carried this batch's cartons
   * to the airline's / shipping line's warehouse, and how many cartons went.
   *
   * A batch is not one parcel: dozens of customer items are packed into a
   * few cartons, and those cartons travel to the depot under their own
   * courier trackings. Without these, "how did this batch get to the
   * warehouse, and how many cartons was it" was unanswerable — the piece
   * count was known (every item is scanned into the batch) but nothing above
   * it was. A JSON array rather than a child table: the list is short, it is
   * always read whole with its batch, and no row of it is referenced from
   * anywhere else.
   */
  shipmentTrackings: json("shipmentTrackings").$type<string[]>(),
  cartonCount: int("cartonCount"),
  shippingCost: decimal("shippingCost", { precision: 12, scale: 2 }), // Total cost we pay to carrier
  departureDate: timestamp("departureDate"),
  estimatedArrival: timestamp("estimatedArrival"),
  actualArrival: timestamp("actualArrival"),
  // at_depot: cleared customs and waiting in the Erbil depot for collection.
  // Added because the jump from "customs" straight to "delivered" gave the
  // customer no way to know their goods were in Erbil and ready.
  status: mysqlEnum("status", ["preparing", "in_transit", "arrived", "customs", "at_depot", "delivered", "closed"]).default("preparing").notNull(),
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
  // Where the person who made this batch was working, copied in at creation.
  // Stored rather than looked up from the user later: if they move office
  // next year, this batch must still say where it was actually made.
  createdInCountryId: int("createdInCountryId"),
  createdInCity: varchar("createdInCity", { length: 100 }),
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
// ============ BATCH STATUS HISTORY ============

/**
 * When a shipment moved from one stage to the next, and who moved it.
 *
 * A batch carries three timestamps of its own — created, departed, arrived —
 * and nothing else. So the customer's journey stepper could show a date for
 * the first three steps and never for customs, the Erbil depot, or delivery.
 * A shipment that had reached the customer showed six green steps and one
 * date, the oldest of them. On a sea batch that is two months of silence.
 *
 * A history table rather than three more columns on `batches`, for three
 * reasons: a status corrected back and forth leaves both moves on the record
 * instead of overwriting one; it says who made each change, which is what a
 * dispute actually needs; and parcels already work exactly this way in
 * `packageStatusHistory`, so this is the shape the system already has.
 *
 * Deliberately holds nothing financial. It is a record of state and time. No
 * reader of this table decides money, and none should.
 */
export const batchStatusHistory = mysqlTable("batchStatusHistory", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),

  // Null on the first row for a batch, or when the previous state is unknown.
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }).notNull(),

  // Null when the change came from a background job rather than a person.
  changedById: int("changedById"),

  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  // The portal reads a whole batch's history at once, oldest first.
  batchIdIdx: index("idx_bsh_batch_id").on(table.batchId),
  changedAtIdx: index("idx_bsh_changed_at").on(table.changedAt),
}));

export type BatchStatusHistory = typeof batchStatusHistory.$inferSelect;
export type InsertBatchStatusHistory = typeof batchStatusHistory.$inferInsert;
