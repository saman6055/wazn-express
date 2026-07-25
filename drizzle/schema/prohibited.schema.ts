import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, index } from "drizzle-orm/mysql-core";

// ============ PROHIBITED PACKAGES (کەل و پەلی قەدەغە) ============
// A package that arrived at the China warehouse but cannot be shipped (a
// prohibited item). Staff quick-register it (tracking + customer code + photo +
// reason); the customer sees it in their portal, gets a notification, and picks
// a resolution (return / reship to another address / destroy). Each resolution
// carries a fee that staff post to the customer's account as a debt via the
// existing ledger. This is a lightweight record — a prohibited item never
// becomes a full `packages` row because it can't ship.

export const prohibitedPackages = mysqlTable("prohibitedPackages", {
  id: int("id").autoincrement().primaryKey(),

  customerId: int("customerId").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  photos: json("photos").$type<string[]>(),

  // Reason: an id from client prohibitedItems (e.g. "banned-weapons"), resolved
  // to a localized label on the client, plus an optional free-text staff note.
  reasonId: varchar("reasonId", { length: 120 }),
  reasonNote: text("reasonNote"),

  // Customer's chosen resolution.
  resolutionChoice: mysqlEnum("resolutionChoice", ["return", "reship", "destroy"]),
  reshipAddress: text("reshipAddress"),
  resolutionChosenAt: timestamp("resolutionChosenAt"),

  // When the customer first opened / saw this item (drives the "seen" flag in
  // Portal Center and stops the portal flashing).
  viewedByCustomerAt: timestamp("viewedByCustomerAt"),

  // Fee posted to the customer's account as a debt (via ledger).
  feeUsd: decimal("feeUsd", { precision: 10, scale: 2 }),
  chargedAt: timestamp("chargedAt"),
  ledgerTransactionId: int("ledgerTransactionId"),

  // Lifecycle: pending (awaiting customer) → chosen (customer picked) →
  // resolved (staff completed) / cancelled.
  status: mysqlEnum("status", ["pending", "chosen", "resolved", "cancelled"]).default("pending").notNull(),

  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  customerIdx: index("prohibitedPackages_customer_idx").on(t.customerId),
  statusIdx: index("prohibitedPackages_status_idx").on(t.status),
}));

export type ProhibitedPackage = typeof prohibitedPackages.$inferSelect;
export type InsertProhibitedPackage = typeof prohibitedPackages.$inferInsert;
