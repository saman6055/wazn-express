import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index } from "drizzle-orm/mysql-core";

// ============ WAZN STORE (وەزن ستۆر) ============
// A lightweight public storefront: admins publish products, anyone can browse a
// shareable product link and place an order (name + phone + address). Orders are
// saved here AND forwarded to staff over WhatsApp. No online payment — the sale
// is confirmed over WhatsApp / cash on delivery. Languages: ku / en / ar.

export const storeProducts = mysqlTable("storeProducts", {
  id: int("id").autoincrement().primaryKey(),

  // Name (English required as the base, like blogPosts)
  nameEn: varchar("nameEn", { length: 300 }).notNull(),
  nameKu: varchar("nameKu", { length: 300 }),
  nameAr: varchar("nameAr", { length: 300 }),

  // Description (rich text / plain)
  descriptionEn: text("descriptionEn"),
  descriptionKu: text("descriptionKu"),
  descriptionAr: text("descriptionAr"),

  // Pricing — decimal returns a string in drizzle; format on the client.
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // Optional "was" price for showing a discount strike-through.
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),

  // Images — one cover (used for link previews) + an optional gallery.
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  images: json("images").$type<string[]>(),

  // Free-text category label (kept simple for v1; can graduate to a table later).
  category: varchar("category", { length: 100 }),

  // Visibility. out_of_stock still shows the product but disables ordering.
  status: mysqlEnum("status", ["active", "hidden", "out_of_stock"]).default("active").notNull(),

  // Optional stock counter — null means untracked / unlimited.
  stock: int("stock"),

  // Shareable link slug (e.g. /store/red-jacket-2xl).
  slug: varchar("slug", { length: 255 }).unique(),

  isFeatured: boolean("isFeatured").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),

  viewCount: int("viewCount").default(0).notNull(),
  orderCount: int("orderCount").default(0).notNull(),

  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  statusIdx: index("storeProducts_status_idx").on(t.status),
}));

export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = typeof storeProducts.$inferInsert;

export const storeOrders = mysqlTable("storeOrders", {
  id: int("id").autoincrement().primaryKey(),

  // Human-friendly reference shared with the customer (WS-XXXXX).
  orderCode: varchar("orderCode", { length: 50 }).unique().notNull(),

  // Product reference + snapshot (so the order stays readable if the product
  // is later edited or deleted).
  productId: int("productId"),
  productName: varchar("productName", { length: 300 }).notNull(),
  productImageUrl: varchar("productImageUrl", { length: 500 }),

  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),

  // Customer-supplied contact + delivery details.
  customerName: varchar("customerName", { length: 200 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }).notNull(),
  customerCity: varchar("customerCity", { length: 100 }),
  customerAddress: text("customerAddress"),
  note: text("note"),

  status: mysqlEnum("status", ["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"]).default("new").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  statusIdx: index("storeOrders_status_idx").on(t.status),
  productIdx: index("storeOrders_product_idx").on(t.productId),
  createdIdx: index("storeOrders_created_idx").on(t.createdAt),
}));

export type StoreOrder = typeof storeOrders.$inferSelect;
export type InsertStoreOrder = typeof storeOrders.$inferInsert;
