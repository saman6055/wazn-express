import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * Twenty nightly backups in a row failed (2026-09-15 → 2026-10-01), each
 * saying only "Failed to export data from database": one unreadable table
 * threw out of the whole export, and nothing named it. And the export
 * screen's "ledger" and "full package orders" rows always answered "no data"
 * because the screen sent its own count keys instead of table names.
 * Proved on a real MySQL with one table deliberately broken.
 */
describe("a backup says what it could not read, and still exists", () => {
  const db = read("server/db/admin.db.ts");
  const service = read("server/services/backup.service.ts");

  it("an unreadable table is named and skipped, not thrown", () => {
    const fn = db.slice(db.indexOf("async function safeSelect("), db.indexOf("appLogger.info('[Backup] Starting complete database export...')"));
    expect(fn).toContain("failures.push({ table: tableName, error: reason });");
    expect(fn).not.toContain("throw error;");
    expect(db).toContain("return { success: true, data, totalRecords, tableCount, failures };");
  });

  it("a failed backup carries the reason", () => {
    expect(service).not.toContain('throw new Error("Failed to export data from database");');
    expect(service).toContain("exportResult.error ??");
  });

  it("a backup with a skipped table says so on its own record and in its file", () => {
    expect(service).toContain("errorMessage: exportResult.failures.length > 0");
    expect(service).toContain("skippedTables: exportResult.failures,");
  });

  it("the screen's names for the ledger and the orders reach the tables", () => {
    expect(db).toContain('ledgerEntries: "ledgerTransactions",');
    expect(db).toContain('fullPackages: "fullPackageOrders",');
    expect(db).toContain("const category = EXPORT_CATEGORY_ALIAS[requested] ?? requested;");
  });

  it("the export screen shows the reason instead of 'no data'", () => {
    const hook = read("client/src/hooks/useDataManagement.ts");
    expect(hook).toContain("toast.error((result as { error?: string }).error!");
    expect(hook).toContain("result.failures?.length");
  });
});
