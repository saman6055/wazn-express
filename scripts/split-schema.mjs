/**
 * Splits drizzle/schema.ts into logical modules under drizzle/schema/.
 * Run: node scripts/split-schema.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_PATH = path.join(__dirname, "..", "drizzle", "schema.ts");
const OUT_DIR = path.join(__dirname, "..", "drizzle", "schema");

const TABLE_TO_MODULE = {
  users: "users",
  customers: "users",
  customerCodePrefixes: "users",
  customerAddresses: "users",
  vipCustomers: "users",
  countries: "settings",
  warehouses: "settings",
  pricingRules: "settings",
  batches: "batches",
  batchPricingTiers: "batches",
  batchCustomerPricing: "batches",
  packages: "packages",
  packageScans: "packages",
  packageStatusHistory: "packages",
  scanDevices: "packages",
  packageQrCodes: "packages",
  packageClaimRequests: "packages",
  invoices: "invoices",
  invoiceTemplates: "invoices",
  exchangeRates: "finance",
  customerAccounts: "finance",
  ledgerTransactions: "finance",
  paymentRecords: "finance",
  creditAdjustments: "finance",
  paymentReminders: "finance",
  expenseCategories: "finance",
  expenses: "finance",
  partners: "finance",
  partnerTransactions: "finance",
  companyDebts: "finance",
  debtPayments: "finance",
  cashAccounts: "finance",
  cashTransactions: "finance",
  financialPeriods: "finance",
  revenueRecords: "finance",
  dailyFinancialSummary: "finance",
  expenseAlerts: "finance",
  expenseAlertLogs: "finance",
  suppliers: "fullPackage",
  fullPackageOrders: "fullPackage",
  fullPackageStatusHistory: "fullPackage",
  systemSettings: "settings",
  notificationSettings: "settings",
  notificationLogs: "notifications",
  notificationTemplates: "notifications",
  customerNotificationPrefs: "notifications",
  customerNotifications: "notifications",
  customerMessages: "notifications",
  scheduledTasksLog: "notifications",
  activityAlerts: "notifications",
  supportChats: "notifications",
  chatMessages: "notifications",
  productCategories: "services",
  serviceTypes: "services",
  extraServices: "services",
  stockCategories: "services",
  stockProducts: "services",
  stockPurchases: "services",
  stockPurchaseItems: "services",
  stockSales: "services",
  stockSaleItems: "services",
  stockMovements: "services",
  labelTemplates: "services",
  blogPosts: "services",
  auditLogs: "admin",
  permissions: "admin",
  subPermissions: "admin",
  backups: "admin",
  deletionLogs: "admin",
  currencies: "settings",
  taxRates: "settings",
  emailTemplates: "settings",
  ipWhitelist: "settings",
  scanHistory: "admin",
};

const DRIZZLE_IMPORT =
  'import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";';

function extractBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^export const (\w+) = mysqlTable/);
    if (match) {
      const tableName = match[1];
      let start = i;
      // include preceding comment if any
      if (start > 0 && lines[start - 1].trim().startsWith("//")) {
        let j = start - 1;
        while (j > 0 && (lines[j].trim().startsWith("//") || lines[j].trim() === "")) j--;
        start = j + 1;
      }
      let end = i + 1;
      while (end < lines.length && !lines[end].match(/^export const \w+ = mysqlTable/)) {
        end++;
      }
      blocks.push({ tableName, lines: lines.slice(start, end).join("\n") });
      i = end;
    } else {
      i++;
    }
  }
  return blocks;
}

function main() {
  const raw = fs.readFileSync(SCHEMA_PATH, "utf8");
  const blocks = extractBlocks(raw);

  const byModule = {};
  for (const { tableName, lines } of blocks) {
    const mod = TABLE_TO_MODULE[tableName];
    if (!mod) {
      console.warn("Unknown table:", tableName);
      continue;
    }
    if (!byModule[mod]) byModule[mod] = [];
    byModule[mod].push(lines);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const moduleOrder = [
    "users",
    "packages",
    "batches",
    "finance",
    "invoices",
    "fullPackage",
    "settings",
    "services",
    "notifications",
    "admin",
  ];

  for (const mod of moduleOrder) {
    const chunks = byModule[mod];
    if (!chunks || chunks.length === 0) continue;
    const content = DRIZZLE_IMPORT + "\n\n" + chunks.join("\n\n");
    const outPath = path.join(OUT_DIR, `${mod}.schema.ts`);
    fs.writeFileSync(outPath, content, "utf8");
    console.log("Wrote", outPath);
  }

  const indexLines = moduleOrder
    .filter((m) => byModule[m]?.length)
    .map((m) => `export * from "./${m}.schema";`);
  fs.writeFileSync(path.join(OUT_DIR, "index.ts"), indexLines.join("\n") + "\n", "utf8");
  console.log("Wrote", path.join(OUT_DIR, "index.ts"));

  const barrel = `// Re-export everything from split schema modules (backward compatible)\nexport * from "./schema/index";\n`;
  fs.writeFileSync(SCHEMA_PATH, barrel, "utf8");
  console.log("Updated", SCHEMA_PATH, "as barrel file");
}

main();
