import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  json,
  index,
  mysqlEnum,
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
