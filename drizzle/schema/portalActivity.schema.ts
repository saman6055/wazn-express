import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  json,
  index,
  mysqlEnum,
  decimal,
  text,
} from "drizzle-orm/mysql-core";

// ---------------------------------------------------------------------------
// customerActivityLog — durable record of what each customer does in the
// portal. Purely additive/observability: nothing in the business logic reads
// from it. Powers the admin "Customer Portal Center". Writes are best-effort
// (a failed log never blocks the customer's actual action).
// ---------------------------------------------------------------------------
export const customerActivityLog = mysqlTable(
  "customerActivityLog",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(), // FK → customers
    // Machine action key, e.g. login | page_view | declare_package |
    // claim_request | send_message | search | update_declaration |
    // cancel_declaration | update_profile | add_address.
    action: varchar("action", { length: 60 }).notNull(),
    // Coarse bucket for filtering/colouring in the UI.
    category: mysqlEnum("category", [
      "auth",
      "navigation",
      "declaration",
      "claim",
      "message",
      "search",
      "profile",
      "other",
    ])
      .default("other")
      .notNull(),
    entityType: varchar("entityType", { length: 50 }), // e.g. declared_package, claim_request
    entityId: int("entityId"),
    path: varchar("path", { length: 255 }), // portal route, for page_view
    detail: varchar("detail", { length: 500 }), // human-readable: search term, tracking no, etc.
    metadata: json("metadata").$type<Record<string, unknown>>(),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: varchar("userAgent", { length: 400 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("idx_cal_customer").on(table.customerId),
    actionIdx: index("idx_cal_action").on(table.action),
    createdIdx: index("idx_cal_created").on(table.createdAt),
  }),
);

export type CustomerActivityLog = typeof customerActivityLog.$inferSelect;
export type InsertCustomerActivityLog = typeof customerActivityLog.$inferInsert;

// ---------------------------------------------------------------------------
// customerAdminNotes — internal, staff-only notes about a customer, shown in
// the Portal Center. Append-only; never visible to the customer.
// ---------------------------------------------------------------------------
export const customerAdminNotes = mysqlTable(
  "customerAdminNotes",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    note: varchar("note", { length: 2000 }).notNull(),
    createdById: int("createdById").notNull(),
    createdByName: varchar("createdByName", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("idx_can_customer").on(table.customerId),
  }),
);

export type CustomerAdminNote = typeof customerAdminNotes.$inferSelect;
export type InsertCustomerAdminNote = typeof customerAdminNotes.$inferInsert;

// ---------------------------------------------------------------------------
// deliveryRatings — a customer's 1–5 star rating (plus optional comment) for
// a delivered package. One rating per package; shown in the Portal Center.
// ---------------------------------------------------------------------------
export const deliveryRatings = mysqlTable(
  "deliveryRatings",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    packageId: int("packageId").notNull().unique(),
    rating: int("rating").notNull(), // 1–5
    comment: varchar("comment", { length: 1000 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("idx_dr_customer").on(table.customerId),
    ratingIdx: index("idx_dr_rating").on(table.rating),
  }),
);

export type DeliveryRating = typeof deliveryRatings.$inferSelect;
export type InsertDeliveryRating = typeof deliveryRatings.$inferInsert;

// ---------------------------------------------------------------------------
// yuanExchangeOrders — a customer's request to buy Chinese Yuan (CNY) with
// USD at the company's sell rate. The rate is locked at order time; status
// is managed by staff from the Portal Center's Yuan tab.
// ---------------------------------------------------------------------------
export const yuanExchangeOrders = mysqlTable(
  "yuanExchangeOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    usdAmount: decimal("usdAmount", { precision: 12, scale: 2 }).notNull(),
    cnyAmount: decimal("cnyAmount", { precision: 12, scale: 2 }).notNull(),
    rate: decimal("rate", { precision: 10, scale: 4 }).notNull(), // CNY per 1 USD at order time
    status: mysqlEnum("status", ["pending", "processing", "completed", "cancelled"])
      .default("pending")
      .notNull(),
    customerNote: varchar("customerNote", { length: 1000 }),
    adminNote: varchar("adminNote", { length: 1000 }), // shown to the customer in the portal
    handledById: int("handledById"), // staff user who last changed the status
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    customerIdx: index("idx_yeo_customer").on(table.customerId),
    statusIdx: index("idx_yeo_status").on(table.status),
    createdIdx: index("idx_yeo_created").on(table.createdAt),
  }),
);

export type YuanExchangeOrder = typeof yuanExchangeOrders.$inferSelect;
export type InsertYuanExchangeOrder = typeof yuanExchangeOrders.$inferInsert;

// ============ CUSTOMER FEATURES (تایبەتمەندییەکانی کڕیار) ============

/**
 * A feature handed to one customer.
 *
 * Not a permission: every screen behind these is already scoped to the
 * customer's own data, and a customer without a row here is not being kept
 * away from anything — they are simply not being shown it yet. What the row
 * records is a decision somebody made, and who made it.
 */
export const customerFeatures = mysqlTable("customerFeatures", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  feature: varchar("feature", { length: 64 }).notNull(),
  note: text("note"),
  grantedById: int("grantedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerFeature = typeof customerFeatures.$inferSelect;
export type InsertCustomerFeature = typeof customerFeatures.$inferInsert;
