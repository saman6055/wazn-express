import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import mysqlCore from "mysql2";
import {
  backupFileName,
  cleanUploadedName,
  insertStatements,
  manifestProblem,
  MAX_STATEMENT_BYTES,
  parseTableEntry,
  tableEntries,
  uploadEntryName,
  BACKUP_FORMAT,
} from "./lib/backupFormat";
import { erbilTime, statementLines } from "./services/fullBackup.service";

/**
 * A complete backup brings the system back to the moment it was taken.
 *
 * The old one held 71 of the 111 tables (no boxes, no box receipts, no
 * carton checks), left out every photo stored on the server, and restored
 * rows under new ids. The full round trip — every table's checksum and
 * every file's hash equal after a restore into an empty database, uploaded
 * over HTTP in pieces — was proved against real MySQL on 2026-10-25. These
 * tests hold the rules that made it true.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

describe("what goes into a backup", () => {
  const engine = read("services/fullBackup.service.ts");

  it("asks MySQL for every table rather than keeping a list by hand", () => {
    expect(engine).toContain("FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
    expect(engine).toContain("SHOW CREATE TABLE");
  });

  it("reads one consistent picture of the whole database", () => {
    expect(engine).toContain("START TRANSACTION WITH CONSISTENT SNAPSHOT");
  });

  it("takes every file in the uploads folder under its own name", () => {
    expect(engine).toContain("await fsp.readdir(uploadsDir, { withFileTypes: true })");
    expect(engine).toContain("`uploads/${u.name}`");
  });

  it("reads and writes values as MySQL prints them, on a UTC session clock", () => {
    expect(engine).toContain('typeCast: (field: { string: (encoding?: string) => string | null }) => field.string("utf8")');
    expect((engine.match(/SET time_zone = '\+00:00'/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("never writes a generated column (MySQL fills it)", () => {
    expect(engine).toContain("/VIRTUAL GENERATED|STORED GENERATED/i");
    // DEFAULT_GENERATED is an ordinary column with a default — it must stay.
    expect(engine).not.toMatch(/\/GENERATED\/i/);
  });
});

describe("what a restore does", () => {
  const engine = read("services/fullBackup.service.ts");

  it("takes a copy of the present before it changes anything", () => {
    const run = engine.slice(engine.indexOf("async function runRestore"));
    const safety = run.indexOf('reason: "before_restore"');
    const firstDrop = run.indexOf("DROP TABLE IF EXISTS");
    expect(safety).toBeGreaterThan(-1);
    expect(firstDrop).toBeGreaterThan(safety);
  });

  it("checks the whole file before it starts", () => {
    const start = engine.slice(engine.indexOf("export async function startRestore"));
    expect(start.indexOf("inspectBackupZip(file)")).toBeLessThan(start.indexOf("void runRestore("));
  });

  it("runs only what a backup writes: one CREATE and INSERTs into that table", () => {
    expect(engine).toContain("multipleStatements: false");
    expect(engine).toContain("if (!line.startsWith(expected))");
    expect(engine).toContain("if (!create.startsWith(`CREATE TABLE ${id(table)} (`))");
  });

  it("rebuilds the sign-in tables last, so the person watching is not signed out halfway", () => {
    expect(engine).toContain('const SIGN_IN_TABLES = new Set(["users", "customers"])');
    const run = engine.slice(engine.indexOf("async function runRestore"));
    expect(run.indexOf("for (const { e, tableEntry } of setAside) await applyTable(e, tableEntry);")).toBeGreaterThan(
      run.indexOf("for (let e = await nextEntry(zip); e; e = await nextEntry(zip))"),
    );
  });

  it("shows how the restore ended, not the safety copy it took", () => {
    expect(engine).toContain("if (j.partOfRestore) return;");
    expect(engine).toContain("partOfRestore: true");
  });

  it("keeps today's list of backups, and brings old tables up to today's columns", () => {
    expect(engine).toContain("RESTORE_KEEPS.has(tableEntry.table)");
    expect(engine).toContain("runSchemaPatches");
    expect(engine).toContain("reconcileColumns");
    expect(engine).toContain("cacheClear()");
  });
});

describe("who may bring a backup in and put the system back", () => {
  it("restore is the main admin's alone", () => {
    const router = read("routers/admin.router.ts");
    expect(router).toMatch(/restore: superAdminProcedure/);
  });

  it("the upload routes answer only the main admin", () => {
    const route = read("_core/backupFileRoute.ts");
    expect(route).toContain('user.role === "super_admin"');
    for (const p of ["/api/backup-upload/start", "/api/backup-upload/:id/chunk", "/api/backup-upload/:id/finish"]) {
      const at = route.indexOf(`"${p}"`);
      expect(at, p).toBeGreaterThan(-1);
      expect(route.slice(at, at + 400), p).toContain("await mainAdmin(req, res)");
    }
  });

  it("deleting a backup deletes its file — a backup with every photo would fill the disk", () => {
    const router = read("routers/admin.router.ts");
    const del = router.slice(router.indexOf("delete: adminProcedure"), router.indexOf("restore: superAdminProcedure"));
    expect(del).toContain("fsp.rm(file, { force: true })");
  });

  it("the old, incomplete ZIP format is refused rather than restored", () => {
    const router = read("routers/admin.router.ts");
    expect(router).not.toContain("restoreFromZipBackup(");
  });
});

describe("the file format", () => {
  it("names a table's two entries and reads them back", () => {
    const e = tableEntries("deliveryBoxes");
    expect(parseTableEntry(e.schema)).toEqual({ table: "deliveryBoxes", kind: "schema" });
    expect(parseTableEntry(e.rows)).toEqual({ table: "deliveryBoxes", kind: "rows" });
    expect(parseTableEntry("db/../x.rows.sql")).toBeNull();
    expect(parseTableEntry("db/a b.rows.sql")).toBeNull();
  });

  it("writes a file back only as a bare name inside the uploads folder", () => {
    expect(uploadEntryName("uploads/AbC_-1.jpg")).toBe("AbC_-1.jpg");
    expect(uploadEntryName("uploads/.document-names.json")).toBe(".document-names.json");
    for (const bad of ["uploads/../server.js", "uploads/a/b.jpg", "uploads/..", "uploads/c:\\x.jpg", "files/x.jpg"]) {
      expect(uploadEntryName(bad), bad).toBeNull();
    }
  });

  it("puts every row in a statement MySQL will accept, one statement per line", () => {
    const rows = Array.from({ length: 1300 }, (_, i) => [String(i), "x".repeat(2000)]);
    const lines = insertStatements("t", ["id", "v"], rows, (v) => mysqlCore.escape(v), (n) => mysqlCore.escapeId(n));
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) {
      expect(l.length).toBeLessThanOrEqual(MAX_STATEMENT_BYTES + 2100);
      expect(l.endsWith(";\n")).toBe(true);
      expect(l.slice(0, -1)).not.toContain("\n");
    }
    const total = lines.join("").match(/\('/g)?.length;
    expect(total).toBe(1300);
  });

  it("keeps a newline, a quote and a Unicode line separator inside one statement", async () => {
    const text = "a\nb\r\n'q' \\ \u2028 \u2029 😀";
    const [line] = insertStatements("t", ["v"], [[text]], (v) => mysqlCore.escape(v), (n) => mysqlCore.escapeId(n));
    const split: string[] = [];
    // Delivered in awkward pieces, the way a ZIP stream arrives.
    const bytes = Buffer.from(line + line, "utf8");
    const pieces = [bytes.subarray(0, 7), bytes.subarray(7, 50), bytes.subarray(50)];
    for await (const l of statementLines(Readable.from(pieces))) if (l) split.push(l);
    expect(split).toEqual([line.slice(0, -1), line.slice(0, -1)]);
  });

  it("refuses a manifest that is not a complete backup, before anything is touched", () => {
    const names = new Set(["manifest.json", ...Object.values(tableEntries("users"))]);
    const good = { format: BACKUP_FORMAT, version: "6.0", database: { tables: [{ name: "users", rows: 1 }] } };
    expect(manifestProblem(good, names)).toBeNull();
    expect(manifestProblem(null, names)).toBeTruthy();
    expect(manifestProblem({ ...good, format: "other" }, names)).toBeTruthy();
    expect(manifestProblem({ ...good, version: "5.0" }, names)).toContain("کۆن");
    expect(manifestProblem({ ...good, database: { tables: [{ name: "users" }, { name: "packages" }] } }, names)).toContain("packages");
    expect(manifestProblem({ ...good, database: { tables: [{ name: "customers" }] } }, new Set(["db/customers.schema.sql", "db/customers.rows.sql"]))).toContain("users");
  });

  it("tells the moment a restore went back to on the office's own clock", () => {
    expect(erbilTime("2026-10-25T09:21:25.632Z")).toBe("25/10/2026 12:21");
    expect(erbilTime("2026-12-31T22:30:00Z")).toBe("01/01/2027 01:30");
  });

  it("names files by when they were taken, and cleans a name from a computer", () => {
    expect(backupFileName(new Date("2026-10-25T09:05:07Z"), "manual")).toBe("wazn-full-2026-10-25-09-05-07.zip");
    expect(backupFileName(new Date("2026-10-25T09:05:07Z"), "before_restore")).toBe("wazn-before-restore-2026-10-25-09-05-07.zip");
    expect(cleanUploadedName("C:\\Users\\me\\Wazn Backup.zip")).toBe("Wazn-Backup.zip");
    expect(cleanUploadedName("../../etc/passwd")).toBe("passwd.zip");
    expect(cleanUploadedName("")).toBe("backup.zip");
  });
});
