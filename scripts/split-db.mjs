/**
 * Splits server/db.ts into feature modules under server/db/.
 * Run from repo root: node scripts/split-db.mjs
 * Creates: connection.ts (already exists), utils.db.ts (already exists),
 * and customers.db.ts, packages.db.ts, batches.db.ts, scanning.db.ts,
 * finance.db.ts, invoices.db.ts, fullPackage.db.ts, reports.db.ts,
 * settings.db.ts, portal.db.ts, admin.db.ts, services.db.ts.
 * index.ts is written to re-export everything.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(process.cwd(), 'server', 'db.ts');
const OUT_DIR = path.join(process.cwd(), 'server', 'db');

// Section header regex: // ============ SECTION NAME ============
const SECTION_RE = /^\/\/\s*=+\s*(.+?)\s*=+\s*$/;

// Map section name (partial match) -> module file name (without .db.ts)
const SECTION_TO_MODULE = {
  'USER OPERATIONS': 'admin',
  'CUSTOMER OPERATIONS': 'customers',
  'CUSTOMER CODE PREFIX': 'customers',
  'COUNTRY OPERATIONS': 'settings',
  'WAREHOUSE OPERATIONS': 'settings',
  'PRICING OPERATIONS': 'settings',
  'BATCH OPERATIONS': 'batches',
  'BATCH HELPERS': 'batches',
  'BATCH PRICING TIERS': 'batches',
  'BATCH CUSTOMER PRICING': 'batches',
  'PACKAGE OPERATIONS': 'packages',
  'LEDGER OPERATIONS': 'finance',
  'LEGACY LEDGER': 'finance',
  'INVOICE OPERATIONS': 'invoices',
  'EXCHANGE RATE': 'finance',
  'AUDIT LOG': 'admin',
  'NOTIFICATION LOG': 'admin',
  'SYSTEM SETTINGS': 'settings',
  'REPORTING HELPERS': 'reports',
  'FULL PACKAGE ORDER': 'fullPackage',
  'TRACKING ALERT': 'fullPackage',
  'SUPPLIERS': 'fullPackage',
  'FULL PACKAGE STATUS HISTORY': 'fullPackage',
  'FULL PACKAGE REPORTS': 'reports',
  'VIP CUSTOMER': 'customers',
  'QR CODE': 'scanning',
  'NOTIFICATION PREFERENCES': 'portal',
  'SCHEDULED TASKS': 'admin',
  'ADVANCED REPORTING': 'reports',
  'BARCODE SCANNING': 'scanning',
  'CUSTOMER LEDGER': 'finance',
  'UNIFIED CHARGE': 'finance',
  'CUSTOMER PORTAL': 'portal',
  'SMART SCANNER': 'scanning',
  'PRODUCT CATEGORIES': 'services',
  'UNCLAIMED PACKAGES': 'packages',
  'NOTIFICATION SETTINGS': 'settings',
  'COMPANY FINANCIAL': 'finance',
  'EXPENSE CATEGORIES': 'finance',
  'EXPENSES': 'finance',
  'PARTNERS': 'finance',
  'PARTNER TRANSACTIONS': 'finance',
  'COMPANY DEBTS': 'finance',
  'DEBT PAYMENTS': 'finance',
  'CASH ACCOUNTS': 'finance',
  'CASH TRANSACTIONS': 'finance',
  'FINANCIAL REPORTS': 'finance',
  'SCAN HISTORY': 'scanning',
  'SCAN REPORTS': 'scanning',
  'SERVICE TYPES': 'services',
  'EXTRA SERVICES': 'services',
  'PACKAGE CLAIM': 'portal',
  'CUSTOMER MESSAGES': 'portal',
  'CUSTOMER NOTIFICATIONS': 'portal',
  'CUSTOMER ADDRESSES': 'portal',
  'PROFESSIONAL DASHBOARD': 'reports',
  'INVOICE TEMPLATES': 'services',
  'NOTIFICATION TEMPLATES': 'services',
  'LABEL TEMPLATES': 'services',
  'ALERT SYSTEM': 'reports',
  'STOCK MANAGEMENT': 'admin',
  'FINANCE INTEGRATION': 'finance',
  'DATA MANAGEMENT': 'admin',
  'BLOG POSTS': 'services',
  'ADVANCED DATA MANAGEMENT': 'admin',
  'DELETION LOGS': 'admin',
  'DATA EXPORT': 'admin',
  'DATA IMPORT': 'admin',
  'PURCHASE REQUESTS': 'fullPackage',
  'PERMISSIONS': 'admin',
  'ADVANCED SETTINGS': 'settings',
  'CURRENCY MANAGEMENT': 'settings',
  'TAX RATE': 'settings',
  'IP WHITELIST': 'settings',
  'EMAIL TEMPLATE': 'settings',
  'BALANCE VALIDATION': 'finance',
  'PROFIT REPORTS': 'reports',
  'ACTIVITY ALERTS': 'admin',
  'SUPPORT CHAT': 'admin',
  'CHAT MESSAGE': 'admin',
  'PRE-RESET BACKUP': 'admin',
  'INVOICE REPORTS': 'invoices',
  'PURCHASE REQUEST WORKFLOW': 'fullPackage',
  'COMPREHENSIVE P&L': 'reports',
  'EXPENSE ALERT': 'finance',
  'DELETE STAFF USER': 'admin',
};

function findModule(sectionName) {
  for (const [key, mod] of Object.entries(SECTION_TO_MODULE)) {
    if (sectionName.includes(key)) return mod;
  }
  return null;
}

const FULL_SCHEMA_IMPORT = `import {
  InsertUser, users,
  customers, InsertCustomer, Customer,
  customerCodePrefixes, InsertCustomerCodePrefix, CustomerCodePrefix,
  countries, InsertCountry, Country,
  warehouses, InsertWarehouse, Warehouse,
  pricingRules, InsertPricingRule, PricingRule,
  batches, InsertBatch, Batch,
  packages, InsertPackage, Package,
  invoices, InsertInvoice, Invoice,
  exchangeRates, InsertExchangeRate, ExchangeRate,
  auditLogs, InsertAuditLog,
  permissions, subPermissions,
  notificationLogs, InsertNotificationLog,
  systemSettings, InsertSystemSetting,
  currencies, taxRates, emailTemplates, ipWhitelist,
  fullPackageOrders, InsertFullPackageOrder, FullPackageOrder,
  suppliers, InsertSupplier, Supplier,
  fullPackageStatusHistory, InsertFullPackageStatusHistory, FullPackageStatusHistory,
  customerNotificationPrefs, InsertCustomerNotificationPref, CustomerNotificationPref,
  vipCustomers, InsertVipCustomer, VipCustomer,
  packageQrCodes, InsertPackageQrCode, PackageQrCode,
  scheduledTasksLog, InsertScheduledTaskLog, ScheduledTaskLog,
  packageScans, InsertPackageScan, PackageScan,
  packageStatusHistory, InsertPackageStatusHistory, PackageStatusHistory,
  scanDevices, InsertScanDevice, ScanDevice,
  customerAccounts, InsertCustomerAccount, CustomerAccount,
  ledgerTransactions, InsertLedgerTransaction, LedgerTransaction,
  paymentRecords, InsertPaymentRecord, PaymentRecord,
  creditAdjustments, InsertCreditAdjustment, CreditAdjustment,
  paymentReminders, InsertPaymentReminder, PaymentReminder,
  productCategories, InsertProductCategory, ProductCategory,
  batchPricingTiers, InsertBatchPricingTier, BatchPricingTier,
  batchCustomerPricing, InsertBatchCustomerPricing, BatchCustomerPricing,
  notificationSettings, InsertNotificationSetting, NotificationSetting,
  expenseCategories, InsertExpenseCategory, ExpenseCategory,
  expenses, InsertExpense, Expense,
  partners, InsertPartner, Partner,
  partnerTransactions, InsertPartnerTransaction, PartnerTransaction,
  companyDebts, InsertCompanyDebt, CompanyDebt,
  debtPayments, InsertDebtPayment, DebtPayment,
  cashAccounts, InsertCashAccount, CashAccount,
  cashTransactions, InsertCashTransaction, CashTransaction,
  financialPeriods, InsertFinancialPeriod, FinancialPeriod,
  scanHistory, InsertScanHistory, ScanHistory,
  serviceTypes, InsertServiceType, ServiceType,
  extraServices, InsertExtraService, ExtraService,
  packageClaimRequests, InsertPackageClaimRequest, PackageClaimRequest,
  stockCategories, InsertStockCategory, StockCategory,
  stockProducts, InsertStockProduct, StockProduct,
  stockPurchases, InsertStockPurchase, StockPurchase,
  stockPurchaseItems, InsertStockPurchaseItem, StockPurchaseItem,
  stockSales, InsertStockSale, StockSale,
  stockSaleItems, InsertStockSaleItem, StockSaleItem,
  stockMovements, InsertStockMovement, StockMovement,
  customerMessages, InsertCustomerMessage, CustomerMessage,
  customerAddresses, InsertCustomerAddress, CustomerAddress,
  notificationTemplates, InsertNotificationTemplate, NotificationTemplate,
  labelTemplates, InsertLabelTemplate, LabelTemplate,
  invoiceTemplates, InsertInvoiceTemplate, InvoiceTemplate,
  customerNotifications, InsertCustomerNotification, CustomerNotification,
  revenueRecords, InsertRevenueRecord, RevenueRecord,
  dailyFinancialSummary, InsertDailyFinancialSummary, DailyFinancialSummary,
  blogPosts, InsertBlogPost, BlogPost,
  deletionLogs, InsertDeletionLog, DeletionLog,
  activityAlerts, InsertActivityAlert, ActivityAlert,
  supportChats, InsertSupportChat, SupportChat,
  chatMessages, InsertChatMessage, ChatMessage,
  backups, InsertBackup, Backup,
  expenseAlerts, InsertExpenseAlert, ExpenseAlert,
  expenseAlertLogs, InsertExpenseAlertLog, ExpenseAlertLog
} from "../../drizzle/schema";`;

const DRIZZLE_OPS = `import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";`;

function buildPreamble(moduleContent, modName) {
  const needsUtils = moduleContent.includes('generateAccountNumber') || moduleContent.includes('generateTransactionNumber') || moduleContent.includes('generatePaymentNumber');
  const needsInvoiceGen = moduleContent.includes('generatePackageInvoice') || moduleContent.includes('generatePaymentReceipt');
  const needsStorage = moduleContent.includes('storagePut');
  const needsEnv = moduleContent.includes('ENV.');

  let imports = `import { getDb } from './connection';\n${DRIZZLE_OPS}\n`;
  if (needsUtils) imports += `import { generateAccountNumber, generateTransactionNumber, generatePaymentNumber } from './utils.db';\n`;
  if (needsInvoiceGen) imports += `import { generatePackageInvoice, generatePaymentReceipt } from '../invoiceGenerator';\n`;
  if (needsStorage) imports += `import { storagePut } from '../storage';\n`;
  if (needsEnv) imports += `import { ENV } from '../_core/env';\n`;
  imports += FULL_SCHEMA_IMPORT + '\n\n';
  return imports;
}

// Remove the three generator functions from finance content (they're in utils.db.ts)
function stripGeneratorFunctions(content) {
  const start = content.indexOf('// Generate unique account number');
  if (start === -1) return content;
  const end = content.indexOf('// Create customer account');
  if (end === -1) return content;
  return content.slice(0, start) + content.slice(end);
}

function main() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  // Find section boundaries (line numbers where // ============ ... appears)
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SECTION_RE);
    if (m) {
      const name = m[1].trim();
      const mod = findModule(name);
      sections.push({ lineIndex: i, name, mod });
    }
  }

  // Build content per module: from this section start to next section start (exclusive)
  const byModule = {};
  for (let i = 0; i < sections.length; i++) {
    const mod = sections[i].mod;
    if (!mod) continue;
    const start = sections[i].lineIndex;
    const end = i + 1 < sections.length ? sections[i + 1].lineIndex : lines.length;
    const chunk = lines.slice(start, end).join('\n');
    if (!byModule[mod]) byModule[mod] = [];
    byModule[mod].push(chunk);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [mod, chunks] of Object.entries(byModule)) {
    let content = chunks.join('\n\n');
    if (mod === 'finance') {
      content = stripGeneratorFunctions(content);
    }
    const preamble = buildPreamble(content, mod);
    const full = preamble + content;
    const outPath = path.join(OUT_DIR, `${mod}.db.ts`);
    fs.writeFileSync(outPath, full, 'utf8');
    console.log('Wrote', outPath);
  }

  // Write index.ts
  const modules = ['connection', 'utils.db', 'admin', 'customers', 'packages', 'batches', 'scanning', 'finance', 'invoices', 'fullPackage', 'reports', 'settings', 'portal', 'services'];
  const indexLines = modules.map(m => {
    const base = m === 'utils.db' ? 'utils.db' : m === 'connection' ? 'connection' : `${m}.db`;
    return `export * from './${base}';`;
  });
  fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), indexLines.join('\n') + '\n', 'utf8');
  console.log('Wrote', path.join(OUT_DIR, 'index.ts'));
}

main();
