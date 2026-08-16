import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // For Manus OAuth (optional)
  username: varchar("username", { length: 100 }).unique(), // For username/password login
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }), // "manus", "mobile", or "username"
  // "auditor" reads the whole system and writes no part of it. The guarantee
  // is not here — it is one check in server/_core/trpc.ts — but the role has
  // to be a value the column will accept. See shared/readOnlyRole.ts.
  role: mysqlEnum("role", ["super_admin", "admin", "employee", "accountant", "auditor"]).default("employee").notNull(),
  
  // Staff login fields
  mobileNumber: varchar("mobileNumber", { length: 20 }).unique(), // For mobile login
  passwordHash: varchar("passwordHash", { length: 255 }), // For mobile or username login
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdById: int("createdById"), // Who created this staff user

  // Where this person works. Set when the account is made, and stamped onto
  // everything they create — so a batch can say whether the work was done in
  // Guangzhou or in Erbil. Nullable: accounts that predate this have no
  // location until somebody sets one.
  workCountryId: int("workCountryId"),
  workCity: varchar("workCity", { length: 100 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ CUSTOMERS (Staff-created only) ============


export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  customerCode: varchar("customerCode", { length: 100 }).notNull().unique(), // AZ{number}(Name)
  sequenceNumber: int("sequenceNumber").notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  fullNameArabic: varchar("fullNameArabic", { length: 255 }),
  fullNameKurdish: varchar("fullNameKurdish", { length: 255 }),
  gender: mysqlEnum("gender", ["male", "female"]),
  nationality: varchar("nationality", { length: 100 }),
  businessType: varchar("businessType", { length: 100 }),
  mobileNumber: varchar("mobileNumber", { length: 20 }).notNull().unique(),
  secondaryMobile: varchar("secondaryMobile", { length: 20 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  // When the customer last set their own password.
  //
  // The password itself is bcrypt-hashed and cannot be read back — that is
  // the point of hashing it. What the office actually needs when somebody
  // rings up unable to sign in is whether this account is still on the
  // password we handed out or one the customer chose, and this answers that
  // without keeping anything readable.
  passwordChangedAt: timestamp("passwordChangedAt"),
  /**
   * Wrong passwords in the current run, and when the account reopens.
   *
   * The per-IP login limiter cannot see the attack these are for: one
   * account, tried from many addresses, each one well under the limit. The
   * count has to belong to the account.
   */
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lastFailedLoginAt: timestamp("lastFailedLoginAt"),
  lockedUntil: timestamp("lockedUntil"),
  email: varchar("email", { length: 320 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  district: varchar("district", { length: 100 }),
  address: text("address"),
  // The photo the customer chose for themselves in the portal.
  //
  // Stored as the image itself, shrunk to 512px by the portal before it is
  // sent — small enough to keep beside the row, and it means one fewer thing
  // to lose when files and rows are backed up separately.
  photoUrl: text("photoUrl"),
  passportUrl: text("passportUrl"),
  nationalIdUrl: text("nationalIdUrl"),
  contractUrl: text("contractUrl"),
  goodsTypePreferences: json("goodsTypePreferences").$type<string[]>(),
  shippingTypePreferences: json("shippingTypePreferences").$type<string[]>(),
  // Optional, multi-select: which services this customer uses
  // (full_package / commission / self_order). Purely a tag for badges & filters.
  serviceTypes: json("serviceTypes").$type<string[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  linkedUserId: int("linkedUserId"), // Optional link to OAuth user for portal access
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
}, (table) => ({
  customerCodeIdx: index("idx_customers_customer_code").on(table.customerCode),
  mobileNumberIdx: index("idx_customers_mobile_number").on(table.mobileNumber),
}));

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============ COUNTRIES (Dynamic) ============


export const vipCustomers = mysqlTable("vipCustomers", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  
  // VIP tier
  tier: mysqlEnum("tier", ["silver", "gold", "platinum"]).default("silver").notNull(),
  
  // Discount percentage (e.g., 5 = 5% off)
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }).default("0"),
  
  // Fixed price per KG override (null = use standard pricing)
  fixedPricePerKgAir: decimal("fixedPricePerKgAir", { precision: 10, scale: 2 }),
  fixedPricePerKgSea: decimal("fixedPricePerKgSea", { precision: 10, scale: 2 }),
  
  // Credit limit for this customer
  creditLimitUsd: decimal("creditLimitUsd", { precision: 10, scale: 2 }).default("0"),
  
  // Notes
  notes: text("notes"),
  
  // Validity
  validFrom: timestamp("validFrom").defaultNow().notNull(),
  validTo: timestamp("validTo"),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VipCustomer = typeof vipCustomers.$inferSelect;
export type InsertVipCustomer = typeof vipCustomers.$inferInsert;

// ============ PACKAGE QR CODES ============



// Customer Addresses - ناونیشانەکانی کڕیار
export const customerAddresses = mysqlTable("customerAddresses", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer
  customerId: int("customerId").notNull(),
  
  // Address details
  label: varchar("label", { length: 100 }).notNull(), // "Home", "Office", "Shop"
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  
  // Location
  country: varchar("country", { length: 100 }).default("Iraq").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }), // Neighborhood
  street: varchar("street", { length: 255 }),
  building: varchar("building", { length: 100 }),
  floor: varchar("floor", { length: 20 }),
  apartment: varchar("apartment", { length: 20 }),
  
  // Additional info
  landmark: text("landmark"), // Near landmark
  notes: text("notes"), // Delivery notes
  
  // GPS coordinates (optional)
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Default address
  isDefault: boolean("isDefault").default(false).notNull(),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type InsertCustomerAddress = typeof customerAddresses.$inferInsert;

// Customer Notifications - ئاگادارکردنەوەکانی کڕیار

export const customerCodePrefixes = mysqlTable("customer_code_prefixes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 10 }).unique().notNull(), // AZ, WZ, TR, etc.
  label: varchar("label", { length: 100 }).notNull(), // Azerbaijan, Wazn, Turkey, etc.
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerCodePrefix = typeof customerCodePrefixes.$inferSelect;
export type InsertCustomerCodePrefix = typeof customerCodePrefixes.$inferInsert;



// ============ EXPENSE ALERTS (Automatic Notification System) ============
