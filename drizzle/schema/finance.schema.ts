import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

export const exchangeRates = mysqlTable("exchangeRates", {
  id: int("id").autoincrement().primaryKey(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull().default("USD"),
  targetCurrency: varchar("targetCurrency", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 15, scale: 6 }).notNull(),
  source: varchar("source", { length: 50 }), // api, manual
  isManualOverride: boolean("isManualOverride").default(false).notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  effectiveTo: timestamp("effectiveTo"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

// ============ AUDIT LOGS ============




// ============ CUSTOMER LEDGER SYSTEM ============

// Customer Accounts - financial account for each customer
export const customerAccounts = mysqlTable("customerAccounts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer reference
  customerId: int("customerId").notNull().unique(),
  accountNumber: varchar("accountNumber", { length: 50 }).notNull().unique(), // ACC-AZ067-2024
  
  // Balances (positive = customer owes, negative = credit)
  currentBalanceUsd: decimal("currentBalanceUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  currentBalanceIqd: decimal("currentBalanceIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  
  // Balance breakdown by transaction type (for detailed tracking)
  packageDebtUsd: decimal("packageDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  fullPackageDebtUsd: decimal("fullPackageDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  purchaseRequestDebtUsd: decimal("purchaseRequestDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  commissionDebtUsd: decimal("commissionDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  serviceDebtUsd: decimal("serviceDebtUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  
  // Customer credit/deposit (prepaid balance)
  creditBalanceUsd: decimal("creditBalanceUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  creditBalanceIqd: decimal("creditBalanceIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  
  // Credit limits
  creditLimitUsd: decimal("creditLimitUsd", { precision: 10, scale: 2 }).default("500"),
  creditLimitIqd: decimal("creditLimitIqd", { precision: 15, scale: 0 }).default("750000"),
  
  // Totals (lifetime)
  totalDebitUsd: decimal("totalDebitUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  totalCreditUsd: decimal("totalCreditUsd", { precision: 12, scale: 2 }).default("0").notNull(),
  totalDebitIqd: decimal("totalDebitIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  totalCreditIqd: decimal("totalCreditIqd", { precision: 15, scale: 0 }).default("0").notNull(),
  
  // Status
  accountStatus: mysqlEnum("accountStatus", ["active", "suspended", "blocked"]).default("active").notNull(),
  
  // Customer scoring
  customerScore: decimal("customerScore", { precision: 3, scale: 1 }).default("5.0"), // 0-5 rating
  paymentRating: mysqlEnum("paymentRating", ["excellent", "good", "fair", "poor"]).default("good"),
  
  // Timestamps
  lastTransactionAt: timestamp("lastTransactionAt"),
  lastPaymentAt: timestamp("lastPaymentAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type InsertCustomerAccount = typeof customerAccounts.$inferInsert;

// Ledger Transactions - all financial movements


// Ledger Transactions - all financial movements
export const ledgerTransactions = mysqlTable("ledgerTransactions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  transactionNumber: varchar("transactionNumber", { length: 50 }).notNull().unique(), // TXN-20241218-0001
  
  // Transaction type
  transactionType: mysqlEnum("transactionType", [
    "DEBIT_PACKAGE",          // Package delivery charge
    "DEBIT_FULL_PACKAGE",     // Full package order charge
    "DEBIT_PURCHASE_REQUEST", // Purchase request charge
    "DEBIT_COMMISSION",       // Commission order charge
    "DEBIT_SERVICE",          // Service fee
    "DEBIT_PENALTY",          // Late payment penalty
    "DEBIT_OTHER",            // Other charges
    "CREDIT_PAYMENT",         // Payment received
    "CREDIT_DEPOSIT",         // Customer deposit (prepaid balance)
    "CREDIT_REFUND",          // Refund to customer
    "CREDIT_DISCOUNT",        // Discount given
    "CREDIT_OTHER",           // Other credits
    "ADJUSTMENT_DEBIT",       // Manual debit adjustment
    "ADJUSTMENT_CREDIT"       // Manual credit adjustment
  ]).notNull(),
  
  // Amounts
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).default("0"),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }).default("0"),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }), // USD to IQD rate
  
  // Balance tracking
  balanceBeforeUsd: decimal("balanceBeforeUsd", { precision: 12, scale: 2 }).notNull(),
  balanceAfterUsd: decimal("balanceAfterUsd", { precision: 12, scale: 2 }).notNull(),
  balanceBeforeIqd: decimal("balanceBeforeIqd", { precision: 15, scale: 0 }).notNull(),
  balanceAfterIqd: decimal("balanceAfterIqd", { precision: 15, scale: 0 }).notNull(),
  
  // Reference (what caused this transaction)
  referenceType: mysqlEnum("referenceType", [
    "package", 
    "full_package", 
    "purchase_request", 
    "commission", 
    "payment", 
    "adjustment", 
    "service", 
    "manual"
  ]),
  referenceId: int("referenceId"),
  
  // Description
  description: text("description"),
  
  // Invoice link (auto-generated for DEBIT transactions)
  invoiceId: int("invoiceId"),
  
  // Audit
  createdById: int("createdById").notNull(),
  approvedById: int("approvedById"), // For large transactions
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index("idx_ledger_account_id").on(table.accountId),
  createdAtIdx: index("idx_ledger_created_at").on(table.createdAt),
  typeIdx: index("idx_ledger_transaction_type").on(table.transactionType),
  accountCreatedIdx: index("idx_ledger_account_created").on(table.accountId, table.createdAt),
  accountCreatedTypeIdx: index("idx_ledger_account_created_type").on(table.accountId, table.createdAt, table.transactionType),
}));

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type InsertLedgerTransaction = typeof ledgerTransactions.$inferInsert;

// Payment Records - detailed payment information


// Payment Records - detailed payment information
export const paymentRecords = mysqlTable("paymentRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  transactionId: int("transactionId"), // Link to ledger transaction
  
  // Payment identification
  paymentNumber: varchar("paymentNumber", { length: 50 }).notNull().unique(), // PAY-20241218-0001
  
  // Amounts
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).default("0"),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }).default("0"),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }),

  // Reversal tracking (used by advance payment reversals, partial refunds, etc.)
  // effective net amount = amountUsd - reversedAmountUsd
  reversedAmountUsd: decimal("reversedAmountUsd", { precision: 10, scale: 2 }).default("0").notNull(),
  reversedAt: timestamp("reversedAt"),
  reversalTransactionId: int("reversalTransactionId"), // FK → ledgerTransactions (last reversal)

  // Payment method
  paymentMethod: mysqlEnum("paymentMethod", [
    "CASH",
    "BANK_TRANSFER",
    "FIB",
    "FASTPAY",
    "ZAINCASH",
    "ASIAHAWALA",
    "CARD",
    "OTHER"
  ]).notNull(),
  
  // Status
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "confirmed", "cancelled", "refunded"]).default("confirmed").notNull(),
  
  // Receipt/Reference
  receiptNumber: varchar("receiptNumber", { length: 100 }),
  bankReference: varchar("bankReference", { length: 100 }),
  receiptPhoto: varchar("receiptPhoto", { length: 500 }), // URL to receipt image
  
  // Notes
  notes: text("notes"),
  
  // Audit
  receivedById: int("receivedById").notNull(),
  confirmedById: int("confirmedById"),
  cancelledById: int("cancelledById"),
  cancelReason: text("cancelReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
  cancelledAt: timestamp("cancelledAt"),
}, (table) => ({
  // Customer financial summaries sum payments per account on portal loads.
  accountIdIdx: index("idx_payment_records_account_id").on(table.accountId),
}));

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = typeof paymentRecords.$inferInsert;

// Credit Adjustments - manual balance adjustments


// Credit Adjustments - manual balance adjustments
export const creditAdjustments = mysqlTable("creditAdjustments", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  transactionId: int("transactionId"), // Link to ledger transaction
  
  // Adjustment details
  adjustmentType: mysqlEnum("adjustmentType", ["increase_debt", "decrease_debt", "write_off"]).notNull(),
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).default("0"),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }).default("0"),
  
  // Reason
  reason: text("reason").notNull(),
  supportingDocument: varchar("supportingDocument", { length: 500 }),
  
  // Approval
  requestedById: int("requestedById").notNull(),
  approvedById: int("approvedById"),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvalNotes: text("approvalNotes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
});

export type CreditAdjustment = typeof creditAdjustments.$inferSelect;
export type InsertCreditAdjustment = typeof creditAdjustments.$inferInsert;

// Payment Reminders - scheduled reminders for debtors


// Payment Reminders - scheduled reminders for debtors
export const paymentReminders = mysqlTable("paymentReminders", {
  id: int("id").autoincrement().primaryKey(),
  
  // Account reference
  accountId: int("accountId").notNull(),
  
  // Reminder details
  reminderType: mysqlEnum("reminderType", ["sms", "whatsapp", "email", "call"]).notNull(),
  messageTemplate: text("messageTemplate"),
  customMessage: text("customMessage"),
  
  // Scheduling
  scheduledAt: timestamp("scheduledAt").notNull(),
  sentAt: timestamp("sentAt"),
  
  // Status
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  failureReason: text("failureReason"),
  
  // Response tracking
  customerResponse: text("customerResponse"),
  promisedPaymentDate: timestamp("promisedPaymentDate"),
  promisedAmount: decimal("promisedAmount", { precision: 10, scale: 2 }),
  
  // Audit
  createdById: int("createdById").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = typeof paymentReminders.$inferInsert;


// ============ PRODUCT CATEGORIES (جۆرەکانی کاڵا) ============





// ============ COMPANY FINANCIAL MANAGEMENT (بەڕێوەبردنی دارایی کۆمپانیا) ============

// ============ EXPENSE CATEGORIES (پۆلی مەسروفات) ============
export const expenseCategories = mysqlTable("expenseCategories", {
  id: int("id").autoincrement().primaryKey(),
  nameEn: varchar("nameEn", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }),
  nameKu: varchar("nameKu", { length: 100 }),
  icon: varchar("icon", { length: 50 }), // Emoji or icon
  color: varchar("color", { length: 20 }), // Color for UI
  description: text("description"),
  isRecurring: boolean("isRecurring").default(false).notNull(), // Monthly recurring
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;

// ============ EXPENSES (مەسروفات) ============


// ============ EXPENSES (مەسروفات) ============
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 4 }), // If IQD, rate to USD
  amountUsd: decimal("amountUsd", { precision: 12, scale: 2 }).notNull(), // Converted to USD
  description: text("description"),
  expenseDate: timestamp("expenseDate").notNull(),
  receiptUrl: varchar("receiptUrl", { length: 500 }), // Receipt image
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "bank_transfer", "card", "other"]).default("cash").notNull(),
  cashAccountId: int("cashAccountId"), // Which account paid from
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurringDay: int("recurringDay"), // Day of month for recurring
  vendor: varchar("vendor", { length: 255 }), // Who was paid
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Expense dashboards filter by date range and category.
  expenseDateIdx: index("idx_expenses_expense_date").on(table.expenseDate),
  categoryIdIdx: index("idx_expenses_category_id").on(table.categoryId),
}));

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// ============ PARTNERS/SHAREHOLDERS (شەریکان) ============


// ============ PARTNERS/SHAREHOLDERS (شەریکان) ============
export const partners = mysqlTable("partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameKu: varchar("nameKu", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  ownershipPercentage: decimal("ownershipPercentage", { precision: 5, scale: 2 }).notNull(), // e.g., 50.00%
  initialCapital: decimal("initialCapital", { precision: 14, scale: 2 }).default("0").notNull(), // Initial investment
  currentBalance: decimal("currentBalance", { precision: 14, scale: 2 }).default("0").notNull(), // Retained earnings
  joinDate: timestamp("joinDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// ============ PARTNER TRANSACTIONS (گواستنەوەی شەریکان) ============


// ============ PARTNER TRANSACTIONS (گواستنەوەی شەریکان) ============
export const partnerTransactions = mysqlTable("partnerTransactions", {
  id: int("id").autoincrement().primaryKey(),
  partnerId: int("partnerId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "capital_contribution",  // سەرمایە - Adding capital
    "profit_share",          // بەشی قازانج - Monthly/yearly profit distribution
    "withdrawal",            // دەرهێنان - Taking money out
    "loan_to_company",       // قەرز بۆ کۆمپانیا - Partner loans to company
    "loan_repayment",        // گەڕاندنەوەی قەرز - Company repays partner
    "adjustment"             // ڕێکخستن - Manual adjustment
  ]).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  amountUsd: decimal("amountUsd", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  transactionDate: timestamp("transactionDate").notNull(),
  periodMonth: int("periodMonth"), // For profit_share: which month (1-12)
  periodYear: int("periodYear"),   // For profit_share: which year
  cashAccountId: int("cashAccountId"), // Which account used
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerTransaction = typeof partnerTransactions.$inferSelect;
export type InsertPartnerTransaction = typeof partnerTransactions.$inferInsert;

// ============ COMPANY DEBTS (قەرزی کۆمپانیا) ============


// ============ COMPANY DEBTS (قەرزی کۆمپانیا) ============
export const companyDebts = mysqlTable("companyDebts", {
  id: int("id").autoincrement().primaryKey(),
  creditorName: varchar("creditorName", { length: 255 }).notNull(), // Who we owe
  creditorType: mysqlEnum("creditorType", ["personal", "bank", "supplier", "other"]).notNull(),
  creditorPhone: varchar("creditorPhone", { length: 20 }),
  creditorEmail: varchar("creditorEmail", { length: 320 }),
  principalAmount: decimal("principalAmount", { precision: 14, scale: 2 }).notNull(), // Original amount
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  principalAmountUsd: decimal("principalAmountUsd", { precision: 14, scale: 2 }).notNull(),
  interestRate: decimal("interestRate", { precision: 5, scale: 2 }).default("0"), // Annual interest %
  totalInterest: decimal("totalInterest", { precision: 14, scale: 2 }).default("0"), // Total interest to pay
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(), // Principal + Interest
  paidAmount: decimal("paidAmount", { precision: 14, scale: 2 }).default("0").notNull(), // Amount paid so far
  remainingAmount: decimal("remainingAmount", { precision: 14, scale: 2 }).notNull(), // Remaining to pay
  startDate: timestamp("startDate").notNull(),
  dueDate: timestamp("dueDate"), // Final due date
  installmentCount: int("installmentCount"), // Number of installments
  installmentAmount: decimal("installmentAmount", { precision: 14, scale: 2 }), // Monthly payment
  status: mysqlEnum("status", ["active", "paid", "overdue", "restructured"]).default("active").notNull(),
  purpose: text("purpose"), // Why the loan was taken
  collateral: text("collateral"), // Any collateral
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyDebt = typeof companyDebts.$inferSelect;
export type InsertCompanyDebt = typeof companyDebts.$inferInsert;

// ============ DEBT PAYMENTS (پارەدانی قەرز) ============


// ============ DEBT PAYMENTS (پارەدانی قەرز) ============
export const debtPayments = mysqlTable("debtPayments", {
  id: int("id").autoincrement().primaryKey(),
  debtId: int("debtId").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  amountUsd: decimal("amountUsd", { precision: 14, scale: 2 }).notNull(),
  principalPaid: decimal("principalPaid", { precision: 14, scale: 2 }).notNull(), // Principal portion
  interestPaid: decimal("interestPaid", { precision: 14, scale: 2 }).default("0"), // Interest portion
  paymentDate: timestamp("paymentDate").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "bank_transfer", "card", "other"]).default("cash").notNull(),
  cashAccountId: int("cashAccountId"), // Which account paid from
  remainingAfter: decimal("remainingAfter", { precision: 14, scale: 2 }),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DebtPayment = typeof debtPayments.$inferSelect;
export type InsertDebtPayment = typeof debtPayments.$inferInsert;

// ============ CASH ACCOUNTS (حسابی نەقد و بانک) ============


// ============ CASH ACCOUNTS (حسابی نەقد و بانک) ============
export const cashAccounts = mysqlTable("cashAccounts", {
  id: int("id").autoincrement().primaryKey(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  accountNameKu: varchar("accountNameKu", { length: 255 }),
  accountType: mysqlEnum("accountType", ["cash", "bank", "mobile_wallet"]).notNull(),
  bankName: varchar("bankName", { length: 255 }), // For bank accounts
  accountNumber: varchar("accountNumber", { length: 100 }), // Bank account number
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  currentBalance: decimal("currentBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  initialBalance: decimal("initialBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(), // Main account
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CashAccount = typeof cashAccounts.$inferSelect;
export type InsertCashAccount = typeof cashAccounts.$inferInsert;

// ============ CASH TRANSACTIONS (گواستنەوەی پارە) ============


// ============ CASH TRANSACTIONS (گواستنەوەی پارە) ============
export const cashTransactions = mysqlTable("cashTransactions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "deposit",           // داخل - Money in
    "withdrawal",        // دەرهێنان - Money out
    "transfer_in",       // گواستنەوە - Transfer from another account
    "transfer_out",      // گواستنەوە - Transfer to another account
    "customer_payment",  // پارەدانی کڕیار - Customer pays
    "expense",           // مەسروف - Expense payment
    "debt_payment",      // پارەدانی قەرز - Debt payment
    "partner_deposit",   // داخلی شەریک - Partner adds money
    "partner_withdrawal",// دەرهێنانی شەریک - Partner takes money
    "adjustment"         // ڕێکخستن - Manual adjustment
  ]).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 2 }).notNull(),
  relatedAccountId: int("relatedAccountId"), // For transfers
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // customer, expense, debt, partner
  relatedEntityId: int("relatedEntityId"),
  description: text("description"),
  transactionDate: timestamp("transactionDate").notNull(),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Cash-account statements filter by account and sort by date.
  accountIdIdx: index("idx_cash_txn_account_id").on(table.accountId),
}));

export type CashTransaction = typeof cashTransactions.$inferSelect;
export type InsertCashTransaction = typeof cashTransactions.$inferInsert;

// ============ FINANCIAL PERIODS (ماوەی دارایی) ============


// ============ FINANCIAL PERIODS (ماوەی دارایی) ============
export const financialPeriods = mysqlTable("financialPeriods", {
  id: int("id").autoincrement().primaryKey(),
  periodType: mysqlEnum("periodType", ["monthly", "quarterly", "yearly"]).notNull(),
  year: int("year").notNull(),
  month: int("month"), // 1-12 for monthly, null for yearly
  quarter: int("quarter"), // 1-4 for quarterly
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  
  // Revenue
  totalRevenue: decimal("totalRevenue", { precision: 14, scale: 2 }).default("0"),
  packageRevenue: decimal("packageRevenue", { precision: 14, scale: 2 }).default("0"),
  fullPackageRevenue: decimal("fullPackageRevenue", { precision: 14, scale: 2 }).default("0"),
  otherRevenue: decimal("otherRevenue", { precision: 14, scale: 2 }).default("0"),
  
  // Expenses
  totalExpenses: decimal("totalExpenses", { precision: 14, scale: 2 }).default("0"),
  
  // Profit
  grossProfit: decimal("grossProfit", { precision: 14, scale: 2 }).default("0"),
  netProfit: decimal("netProfit", { precision: 14, scale: 2 }).default("0"),
  
  // Status
  status: mysqlEnum("status", ["open", "closed", "locked"]).default("open").notNull(),
  closedAt: timestamp("closedAt"),
  closedById: int("closedById"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialPeriod = typeof financialPeriods.$inferSelect;
export type InsertFinancialPeriod = typeof financialPeriods.$inferInsert;


// ============ SCAN HISTORY (مێژووی سکان) ============



// ============ REVENUE RECORDS (تۆماری داهات) ============
export const revenueRecords = mysqlTable("revenueRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // Date and identification
  recordDate: timestamp("recordDate").notNull(),
  recordNumber: varchar("recordNumber", { length: 50 }).notNull().unique(), // REV-20241225-0001
  
  // Revenue type
  revenueType: mysqlEnum("revenueType", [
    "package_delivery",    // داهاتی گەیاندنی پاکەت
    "full_package_sale",   // داهاتی فرۆشتنی فولپاکێج
    "full_package_commission", // عمولەی فولپاکێج
    "service_fee",         // کرێی خزمەتگوزاری
    "extra_service",       // خزمەتگوزاری زیادە
    "shipping_fee",        // کرێی گواستنەوە
    "other"                // داهاتی تر
  ]).notNull(),
  
  // Amounts
  amountUsd: decimal("amountUsd", { precision: 12, scale: 2 }).notNull(),
  amountIqd: decimal("amountIqd", { precision: 15, scale: 0 }),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 2 }),
  
  // Cost (for profit calculation)
  costUsd: decimal("costUsd", { precision: 12, scale: 2 }).default("0"),
  profitUsd: decimal("profitUsd", { precision: 12, scale: 2 }).default("0"),
  
  // Reference to source
  referenceType: mysqlEnum("referenceType", ["package", "fullPackageOrder", "invoice", "service", "manual"]),
  referenceId: int("referenceId"),
  
  // Customer info
  customerId: int("customerId"),
  
  // Description
  description: text("description"),
  
  // Status
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"]).default("confirmed").notNull(),
  
  // Audit
  createdById: int("createdById").notNull(),
  confirmedById: int("confirmedById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Revenue reports filter by date and customer on a growing ledger table.
  recordDateIdx: index("idx_revenue_records_record_date").on(table.recordDate),
  customerIdIdx: index("idx_revenue_records_customer_id").on(table.customerId),
}));

export type RevenueRecord = typeof revenueRecords.$inferSelect;
export type InsertRevenueRecord = typeof revenueRecords.$inferInsert;

// ============ DAILY FINANCIAL SUMMARY (پوختەی دارایی ڕۆژانە) ============


// ============ DAILY FINANCIAL SUMMARY (پوختەی دارایی ڕۆژانە) ============
export const dailyFinancialSummary = mysqlTable("dailyFinancialSummary", {
  id: int("id").autoincrement().primaryKey(),
  
  // Date
  summaryDate: timestamp("summaryDate").notNull().unique(),
  
  // Revenue breakdown
  totalRevenue: decimal("totalRevenue", { precision: 14, scale: 2 }).default("0").notNull(),
  packageRevenue: decimal("packageRevenue", { precision: 14, scale: 2 }).default("0"),
  fullPackageRevenue: decimal("fullPackageRevenue", { precision: 14, scale: 2 }).default("0"),
  serviceRevenue: decimal("serviceRevenue", { precision: 14, scale: 2 }).default("0"),
  otherRevenue: decimal("otherRevenue", { precision: 14, scale: 2 }).default("0"),
  
  // Expense breakdown
  totalExpenses: decimal("totalExpenses", { precision: 14, scale: 2 }).default("0").notNull(),
  shippingExpenses: decimal("shippingExpenses", { precision: 14, scale: 2 }).default("0"),
  purchaseExpenses: decimal("purchaseExpenses", { precision: 14, scale: 2 }).default("0"),
  operationalExpenses: decimal("operationalExpenses", { precision: 14, scale: 2 }).default("0"),
  otherExpenses: decimal("otherExpenses", { precision: 14, scale: 2 }).default("0"),
  
  // Profit
  grossProfit: decimal("grossProfit", { precision: 14, scale: 2 }).default("0"),
  netProfit: decimal("netProfit", { precision: 14, scale: 2 }).default("0"),
  
  // Cash flow
  cashIn: decimal("cashIn", { precision: 14, scale: 2 }).default("0"),
  cashOut: decimal("cashOut", { precision: 14, scale: 2 }).default("0"),
  netCashFlow: decimal("netCashFlow", { precision: 14, scale: 2 }).default("0"),
  
  // Counts
  packagesDelivered: int("packagesDelivered").default(0),
  fullPackagesSold: int("fullPackagesSold").default(0),
  invoicesIssued: int("invoicesIssued").default(0),
  paymentsReceived: int("paymentsReceived").default(0),
  
  // Receivables & Payables
  totalReceivables: decimal("totalReceivables", { precision: 14, scale: 2 }).default("0"),
  totalPayables: decimal("totalPayables", { precision: 14, scale: 2 }).default("0"),
  
  // Status
  isFinalized: boolean("isFinalized").default(false).notNull(),
  finalizedAt: timestamp("finalizedAt"),
  finalizedById: int("finalizedById"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyFinancialSummary = typeof dailyFinancialSummary.$inferSelect;
export type InsertDailyFinancialSummary = typeof dailyFinancialSummary.$inferInsert;


// ============ BLOG POSTS (Announcements) ============


export const expenseAlerts = mysqlTable("expenseAlerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alertType", ["daily", "weekly", "monthly", "per_transaction"]).notNull(),
  thresholdAmount: decimal("thresholdAmount", { precision: 12, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["USD", "IQD"]).default("USD").notNull(),
  categoryId: int("categoryId"), // null = all categories, specific = only that category
  isEnabled: boolean("isEnabled").default(true).notNull(),
  notifyMethod: mysqlEnum("notifyMethod", ["system", "email", "both"]).default("system").notNull(),
  description: text("description"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExpenseAlert = typeof expenseAlerts.$inferSelect;
export type InsertExpenseAlert = typeof expenseAlerts.$inferInsert;


export const expenseAlertLogs = mysqlTable("expenseAlertLogs", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull(),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
  totalExpenses: decimal("totalExpenses", { precision: 12, scale: 2 }).notNull(),
  thresholdAmount: decimal("thresholdAmount", { precision: 12, scale: 2 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  expenseCount: int("expenseCount").default(0).notNull(),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  details: text("details"), // JSON with expense breakdown
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExpenseAlertLog = typeof expenseAlertLogs.$inferSelect;
export type InsertExpenseAlertLog = typeof expenseAlertLogs.$inferInsert;
