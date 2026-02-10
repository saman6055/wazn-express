/**
 * One-time script to extract router blocks from server/routers/root.ts
 * and write them to the correct feature files.
 * Run from project root: node scripts/split-routers.mjs
 */
import fs from "fs";
import path from "path";

const rootPath = path.join(process.cwd(), "server", "routers", "root.ts");
const content = fs.readFileSync(rootPath, "utf8");
const lines = content.split("\n");

// Find start of each top-level router: "  name: router({" or "  name: systemRouter,"
const routerStarts = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^\s{2}([a-zA-Z]+):\s*(router\(|systemRouter)/);
  if (match) {
    routerStarts.push({ name: match[1], lineIndex: i, isSystemRouter: match[2] === "systemRouter" });
  }
}

// Find end of each block: the next line that is exactly "  })," (closes this top-level router)
function findBlockEnd(startIndex) {
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i] === "  }),") return i;
    if (lines[i] === "  };") return i - 1;
  }
  return -1;
}

const blocks = [];
for (let i = 0; i < routerStarts.length; i++) {
  const start = routerStarts[i];
  if (start.isSystemRouter) {
    blocks.push({ name: start.name, start: start.lineIndex, end: start.lineIndex, isSystemRouter: true });
  } else {
    const end = findBlockEnd(start.lineIndex);
    blocks.push({ name: start.name, start: start.lineIndex, end, isSystemRouter: false });
  }
}

// Map router name to output file
const fileMap = {
  system: "admin",
  migration: "admin",
  dataManagement: "admin",
  dashboard: "admin",
  users: "admin",
  auditLogs: "admin",
  activityAlerts: "admin",
  adminMessages: "admin",
  backup: "admin",
  permissions: "admin",
  supportChat: "admin",
  public: "admin",
  suppliers: "admin",
  customers: "customers",
  customerCodePrefixes: "customers",
  vip: "customers",
  packages: "packages",
  batches: "batches",
  qrCodes: "scanning",
  scanning: "scanning",
  scanHistory: "scanning",
  scanReports: "scanning",
  ledger: "finance",
  exchangeRates: "finance",
  expenseCategories: "finance",
  expenses: "finance",
  expenseAlerts: "finance",
  partners: "finance",
  companyDebts: "finance",
  cashAccounts: "finance",
  financialReports: "finance",
  financeIntegration: "finance",
  invoices: "invoices",
  invoiceTemplates: "invoices",
  fullPackage: "fullPackage",
  reports: "reports",
  countries: "settings",
  warehouses: "settings",
  pricing: "settings",
  settings: "settings",
  productCategories: "settings",
  advancedSettings: "settings",
  customerPortal: "portal",
  extraServices: "services",
  notificationTemplates: "services",
  labelTemplates: "services",
  alerts: "services",
  blog: "services",
  storage: "services",
  notifications: "admin",
};

// Group blocks by file
const byFile = {};
for (const block of blocks) {
  const file = fileMap[block.name];
  if (!file) continue;
  if (!byFile[file]) byFile[file] = [];
  byFile[file].push(block);
}

// Output extracted content for each router (for debugging / manual use)
const outDir = path.join(process.cwd(), "server", "routers", "split-output");
try {
  fs.mkdirSync(outDir, { recursive: true });
} catch (_) {}

for (const [file, fileBlocks] of Object.entries(byFile)) {
  const fileContent = [];
  for (const block of fileBlocks) {
    if (block.isSystemRouter) {
      fileContent.push(`  // ${block.name}: systemRouter (import from _core)`);
    } else {
      const blockLines = lines.slice(block.start, block.end + 1);
      fileContent.push(blockLines.join("\n"));
    }
  }
  fs.writeFileSync(path.join(outDir, `${file}.txt`), fileContent.join("\n\n"), "utf8");
}

// Generate actual .router.ts files
const routersDir = path.join(process.cwd(), "server", "routers");
const baseImports = `import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";
`;

function toRouterName(name) {
  return name.charAt(0).toLowerCase() + name.slice(1) + "Router";
}

for (const [file, fileBlocks] of Object.entries(byFile)) {
  const parts = [];
  const exportNames = [];

  for (const block of fileBlocks) {
    if (block.isSystemRouter) {
      exportNames.push({ name: block.name, isSystem: true });
      continue;
    }
    const blockLines = lines.slice(block.start, block.end + 1);
    let blockContent = blockLines.join("\n");
    const routerConstName = toRouterName(block.name);
    blockContent = blockContent.replace(/^\s{2}([a-zA-Z]+):\s*router\(\{/, `const ${routerConstName} = router({`);
    blockContent = blockContent.replace(/\n  \}\),\s*$/, "\n});");
    parts.push(blockContent);
    exportNames.push({ name: block.name, constName: routerConstName });
  }

  let fileBody = baseImports + "\n";

  if (file === "admin") {
    fileBody += `import { systemRouter } from "../_core/systemRouter";
import { getConfig } from "../config";
import { runMigration } from "../runMigration";

export const migrationRouter = router({
  run: adminProcedure
    .input(z.object({ secret: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      if (input.secret !== getConfig().migrationSecret) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid migration secret" });
      }
      return runMigration();
    }),
});

`;
    const adminBlocks = fileBlocks.filter((b) => !b.isSystemRouter);
    for (let i = 0; i < adminBlocks.length; i++) {
      const block = adminBlocks[i];
      const blockLines = lines.slice(block.start, block.end + 1);
      let blockContent = blockLines.join("\n");
      const routerConstName = toRouterName(block.name);
      blockContent = blockContent.replace(/^\s{2}([a-zA-Z]+):\s*router\(\{/, `export const ${routerConstName} = router({`);
      blockContent = blockContent.replace(/\n  \}\),\s*$/, "\n});");
      fileBody += blockContent + "\n\n";
    }
    fileBody += "export const adminRouters = {\n  system: systemRouter,\n  migration: migrationRouter,\n";
    for (const block of fileBlocks) {
      if (block.isSystemRouter) continue;
      fileBody += `  ${block.name}: ${toRouterName(block.name)},\n`;
    }
    fileBody += "};\n";
  } else {
    let partIdx = 0;
    for (const block of fileBlocks) {
      if (block.isSystemRouter) continue;
      fileBody += "export " + parts[partIdx++] + "\n\n";
    }
    if (exportNames.filter((e) => !e.isSystem).length > 1) {
      const name = file.charAt(0).toUpperCase() + file.slice(1);
      fileBody += `export const ${file}Routers = {\n`;
      for (const e of exportNames) {
        if (e.isSystem) continue;
        fileBody += `  ${e.name}: ${e.constName},\n`;
      }
      fileBody += "};\n";
    }
  }

  const outPath = path.join(routersDir, `${file}.router.ts`);
  fs.writeFileSync(outPath, fileBody, "utf8");
  console.log("Wrote", outPath);
}

console.log("Extraction and codegen done.");
console.log("Blocks per file:", Object.fromEntries(Object.entries(byFile).map(([k, v]) => [k, v.length])));
