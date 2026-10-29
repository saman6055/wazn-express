import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index, uniqueIndex } from "drizzle-orm/mysql-core";

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
  /**
   * What the arrivals board said, and when it said it.
   *
   * `flightArrivedAt` is written once, the first time the flight is seen on
   * the ground — it is what stops the watcher looking again and what the
   * customs move counts its morning from.
   */
  flightStatus: varchar("flightStatus", { length: 40 }),
  flightArrivedAt: timestamp("flightArrivedAt"),
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
  // Unused since the rule became automatic (2026-10-18, same day it was added):
  // kept so the column a deploy already made has a name. Nothing reads it.
  smallParcelSurchargePercent: decimal("smallParcelSurchargePercent", { precision: 5, scale: 2 }),
  // The small sea parcel rule (shared/parcelCost: smallParcelPrice) is on for
  // this batch. Ticked by default on a new sea batch; empty on the batches
  // made before it, which therefore stay as they were priced.
  smallParcelRule: boolean("smallParcelRule"),
  
  // Tiered pricing flag
  useTieredPricing: boolean("useTieredPricing").default(false).notNull(), // True for air_irregular and sea
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  // Where the person who made this batch was working, copied in at creation.
  // Stored rather than looked up from the user later: if they move office
  // next year, this batch must still say where it was actually made.
  createdInCountryId: int("createdInCountryId"),
  createdInCity: varchar("createdInCity", { length: 100 }),
  // The dispatch check in China (owner, 2026-10-24): every parcel scanned
  // into a carton before the batch leaves. When it was finished, by whom,
  // and the reason given when it was finished with parcels left out.
  dispatchCheckedAt: timestamp("dispatchCheckedAt"),
  dispatchCheckedById: int("dispatchCheckedById"),
  dispatchNote: text("dispatchNote"),
  // The carrier's bill looked like part of the batch only (shared/carrierParts)
  // and an admin said why and that it should not wait (owner, 2026-10-25).
  partsAcceptedAt: timestamp("partsAcceptedAt"),
  partsAcceptedById: int("partsAcceptedById"),
  partsAcceptedNote: text("partsAcceptedNote"),
  // The carrier's own batch number (e.g. "ANC 169") - one carrier shipment
  // can hold several of ours (owner, 2026-10-28). Office only: never sent to
  // a customer (server/lib/customerVisibleBatch FORBIDDEN_BATCH_FIELDS).
  carrierBatchNo: varchar("carrierBatchNo", { length: 64 }),
  // The Erbil twin of a China batch, made by the office from inside it.
  twinOfBatchId: int("twinOfBatchId"),
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

/**
 * Every change to a batch's money fields — cost per kg/CBM, the carrier's
 * total, selling price per kg/CBM — with the value it replaced. Written by
 * updateBatch on staff edits and by the delivery-time cost derivation
 * (changedById NULL = the system divided the total itself). The owner's
 * rule: an overwritten price must stay on the record.
 */
export const batchPriceHistory = mysqlTable("batchPriceHistory", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),

  // One of shared/batchPriceHistory.ts PRICE_HISTORY_FIELDS.
  field: varchar("field", { length: 32 }).notNull(),

  // Null means the field was empty on that side of the change.
  oldValue: decimal("oldValue", { precision: 12, scale: 2 }),
  newValue: decimal("newValue", { precision: 12, scale: 2 }),

  // Null when the system wrote it (delivery-time derivation), not a person.
  changedById: int("changedById"),

  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  // The edit dialog reads one batch's history at once, newest first.
  batchIdIdx: index("idx_bph_batch_id").on(table.batchId),
}));

export type BatchPriceHistory = typeof batchPriceHistory.$inferSelect;
export type InsertBatchPriceHistory = typeof batchPriceHistory.$inferInsert;

// ============ CARTONS (owner, 2026-10-24) ============

/**
 * The cartons a batch leaves China in, numbered within the batch. Filled on
 * the dispatch check: every parcel scanned in, so a parcel not registered or
 * registered on another batch is caught in China, not in Erbil.
 */
export const batchCartons = mysqlTable("batchCartons", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  cartonNo: int("cartonNo").notNull(),
  weightKg: decimal("weightKg", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  closedById: int("closedById"),
}, (table) => ({
  batchIdx: index("idx_batch_cartons_batch").on(table.batchId),
  numberUnique: uniqueIndex("uq_batch_cartons_no").on(table.batchId, table.cartonNo),
}));

export type BatchCarton = typeof batchCartons.$inferSelect;

/** One parcel in one carton. A parcel is in at most one carton. */
export const batchCartonItems = mysqlTable("batchCartonItems", {
  id: int("id").autoincrement().primaryKey(),
  cartonId: int("cartonId").notNull(),
  batchId: int("batchId").notNull(),
  packageId: int("packageId").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  scannedById: int("scannedById").notNull(),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
}, (table) => ({
  packageUnique: uniqueIndex("uq_batch_carton_items_package").on(table.packageId),
  cartonIdx: index("idx_batch_carton_items_carton").on(table.cartonId),
  batchIdx: index("idx_batch_carton_items_batch").on(table.batchId),
}));

export type BatchCartonItem = typeof batchCartonItems.$inferSelect;


/**
 * One delivery of a batch by the carrier, with its own invoice (owner,
 * 2026-10-25): a carrier may send one of our batches in two or three loads.
 * The batch's billed weight and total cost are the sums of these rows once
 * any exist (server/db/carrierParts.db.ts) - every cost rule reads the batch.
 */
export const batchCarrierParts = mysqlTable("batchCarrierParts", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  partNo: int("partNo").notNull(),
  arrivedOn: varchar("arrivedOn", { length: 10 }),
  billedKg: decimal("billedKg", { precision: 10, scale: 2 }),
  billedCbm: decimal("billedCbm", { precision: 10, scale: 4 }),
  costUsd: decimal("costUsd", { precision: 12, scale: 2 }),
  awbNumber: varchar("awbNumber", { length: 64 }),
  note: varchar("note", { length: 255 }),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  batchIdx: index("idx_batch_carrier_parts_batch").on(table.batchId),
  numberUnique: uniqueIndex("uq_batch_carrier_parts_no").on(table.batchId, table.partNo),
}));

export type BatchCarrierPart = typeof batchCarrierParts.$inferSelect;

/**
 * The carrier's invoice for one of its shipments (owner, 2026-10-28): ANC
 * "Batch 169 - 276 kg - $2,428.80" held several of our batches. Written once;
 * the batches that carry the same carrierBatchNo share it by the kilos their
 * customers were charged on (shared/carrierGroup).
 */
export const carrierGroupInvoices = mysqlTable("carrierGroupInvoices", {
  id: int("id").autoincrement().primaryKey(),
  carrierBatchNo: varchar("carrierBatchNo", { length: 64 }).notNull(),
  billedKg: decimal("billedKg", { precision: 10, scale: 2 }).notNull(),
  costUsd: decimal("costUsd", { precision: 12, scale: 2 }).notNull(),
  note: varchar("note", { length: 255 }),
  /**
   * The day this load reached Erbil (YYYY-MM-DD). A batch of the group with
   * parcels that arrived before it came partly on an earlier load; only its
   * parcels checked in from this day count for this invoice (owner,
   * 2026-10-29, AIR-2026-069: half on one load, half on ANC 169).
   */
  arrivedOn: varchar("arrivedOn", { length: 10 }),
  splitAt: timestamp("splitAt"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  numberUnique: uniqueIndex("uq_carrier_group_invoices_no").on(table.carrierBatchNo),
}));

export type CarrierGroupInvoice = typeof carrierGroupInvoices.$inferSelect;
