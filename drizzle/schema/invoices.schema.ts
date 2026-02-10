import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  packageId: int("packageId"),
  batchId: int("batchId"),
  subtotalUsd: decimal("subtotalUsd", { precision: 12, scale: 2 }).notNull(),
  taxUsd: decimal("taxUsd", { precision: 12, scale: 2 }).default("0"),
  totalUsd: decimal("totalUsd", { precision: 12, scale: 2 }).notNull(),
  exchangeRateIqd: decimal("exchangeRateIqd", { precision: 12, scale: 2 }),
  exchangeRateRmb: decimal("exchangeRateRmb", { precision: 12, scale: 6 }),
  totalIqd: decimal("totalIqd", { precision: 15, scale: 0 }),
  totalRmb: decimal("totalRmb", { precision: 12, scale: 2 }),
  status: mysqlEnum("status", ["draft", "issued", "paid", "partially_paid", "cancelled", "refunded"]).default("draft").notNull(),
  issuedAt: timestamp("issuedAt"),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  pdfUrl: text("pdfUrl"),
  lineItems: json("lineItems").$type<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[]>(),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  customerIdIdx: index("idx_invoices_customer_id").on(table.customerId),
  batchIdIdx: index("idx_invoices_batch_id").on(table.batchId),
  createdAtIdx: index("idx_invoices_created_at").on(table.createdAt),
}));

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ============ EXCHANGE RATES ============


export const invoiceTemplates = mysqlTable("invoiceTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template name (for multiple templates)
  name: varchar("name", { length: 100 }).notNull().default("Default"),
  isDefault: boolean("isDefault").default(true).notNull(),
  
  // Style selection
  style: mysqlEnum("style", ["modern", "classic", "minimal"]).default("modern").notNull(),
  
  // Company Information
  companyName: varchar("companyName", { length: 255 }),
  companyNameAr: varchar("companyNameAr", { length: 255 }), // Arabic
  companyNameKu: varchar("companyNameKu", { length: 255 }), // Kurdish
  companyAddress: text("companyAddress"),
  companyAddressAr: text("companyAddressAr"),
  companyAddressKu: text("companyAddressKu"),
  companyPhone: varchar("companyPhone", { length: 50 }),
  companyPhone2: varchar("companyPhone2", { length: 50 }),
  companyEmail: varchar("companyEmail", { length: 255 }),
  companyWebsite: varchar("companyWebsite", { length: 255 }),
  
  // Logo
  logoUrl: varchar("logoUrl", { length: 500 }),
  logoWidth: int("logoWidth").default(150), // Logo width in pixels
  logoPosition: mysqlEnum("logoPosition", ["left", "center", "right"]).default("left"),
  
  // Colors (hex format)
  primaryColor: varchar("primaryColor", { length: 7 }).default("#3b82f6"), // Blue
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#10b981"), // Green
  accentColor: varchar("accentColor", { length: 7 }).default("#f59e0b"), // Amber
  textColor: varchar("textColor", { length: 7 }).default("#1f2937"), // Dark gray
  backgroundColor: varchar("backgroundColor", { length: 7 }).default("#ffffff"), // White
  
  // Font settings
  fontFamily: varchar("fontFamily", { length: 100 }).default("Arial"),
  fontSize: int("fontSize").default(10), // Base font size
  
  // Bank Details
  bankName: varchar("bankName", { length: 255 }),
  bankAccountName: varchar("bankAccountName", { length: 255 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 100 }),
  bankIban: varchar("bankIban", { length: 50 }),
  bankSwift: varchar("bankSwift", { length: 20 }),
  
  // Additional bank (for dual currency)
  bank2Name: varchar("bank2Name", { length: 255 }),
  bank2AccountName: varchar("bank2AccountName", { length: 255 }),
  bank2AccountNumber: varchar("bank2AccountNumber", { length: 100 }),
  bank2Currency: varchar("bank2Currency", { length: 10 }),
  
  // Footer
  footerText: text("footerText"),
  footerTextAr: text("footerTextAr"),
  footerTextKu: text("footerTextKu"),
  
  // Terms & Conditions
  termsText: text("termsText"),
  termsTextAr: text("termsTextAr"),
  termsTextKu: text("termsTextKu"),
  
  // Additional settings
  showQrCode: boolean("showQrCode").default(true),
  showWatermark: boolean("showWatermark").default(false),
  watermarkText: varchar("watermarkText", { length: 100 }),
  
  // Invoice number format
  invoicePrefix: varchar("invoicePrefix", { length: 20 }).default("INV"),
  invoiceNumberDigits: int("invoiceNumberDigits").default(6),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdById: int("createdById"),
});

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type InsertInvoiceTemplate = typeof invoiceTemplates.$inferInsert;



// ============ NOTIFICATION TEMPLATES ============