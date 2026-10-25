import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { once } from "events";
import { Readable } from "stream";
import archiver from "archiver";
import yauzl from "yauzl";
import mysqlCore from "mysql2";
import mysql from "mysql2/promise";
import { and, eq, like } from "drizzle-orm";
import { getDb } from "../db";
import { backups } from "../../drizzle/schema";
import { getUploadsDir } from "./localUpload";
import { getLocalBackupFilePath, LOCAL_BACKUP_PREFIX } from "./zipBackup.service";
import { appLogger } from "../utils/logger";
import { retryFix, withFix } from "@shared/fixAdvice";
import { cacheClear } from "../db/cache";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  RESTORE_KEEPS,
  V6_KEY_PREFIX,
  backupFileName,
  insertStatements,
  manifestProblem,
  parseTableEntry,
  tableEntries,
  uploadEntryName,
  type BackupManifest,
} from "../lib/backupFormat";

/**
 * A complete backup, and the way back from one (server/lib/backupFormat.ts
 * says what is inside and why).
 *
 * Both run in the background: a backup with every photo in it takes
 * minutes, and a request that waited for it would be cut off by the proxy
 * long before it finished. The screen asks how far along it is.
 */

// ─── Progress ────────────────────────────────────────────────────────────

export interface BackupJob {
  kind: "backup" | "restore";
  backupId: number;
  step: string;
  done: number;
  total: number;
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
  message?: string;
  /** The copy taken just before a restore — the way back if it was a mistake. */
  safetyBackupId?: number;
  /** The copy a restore takes of the present: part of that restore, not a job of its own. */
  partOfRestore?: boolean;
}

const jobs = new Map<number, BackupJob>();
let running: BackupJob | null = null;
/** Held while a start is being checked, so two clicks cannot both begin. */
let starting = false;

function claimStart(): void {
  if (running || starting) throw new Error(withFix(busyMessage(), WAIT_FIX));
  starting = true;
}

export function getBackupJob(backupId: number): BackupJob | null {
  return jobs.get(backupId) ?? null;
}

/** The backup or restore running now, or the last one, for the screen. */
export function currentBackupJob(): BackupJob | null {
  if (running) return running;
  let last: BackupJob | null = null;
  jobs.forEach((j) => {
    // The safety copy starts after its restore; showing it would hide how the restore ended.
    if (j.partOfRestore) return;
    if (!last || j.startedAt > last.startedAt) last = j;
  });
  return last;
}

/** 25/10/2026 12:21 — the day/month/year and Erbil clock the office reads everywhere else. */
export function erbilTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const at = new Date(d.getTime() + 3 * 60 * 60 * 1000); // Iraq keeps UTC+3 all year
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(at.getUTCDate())}/${p(at.getUTCMonth() + 1)}/${at.getUTCFullYear()} ${p(at.getUTCHours())}:${p(at.getUTCMinutes())}`;
}

/** What to do when a file is not a backup this system made. */
const NOT_A_BACKUP_FIX = [
  "دڵنیا بە فایلەکە ئەو ZIP ـەیە کە لە «بەکاپی تەواو» دابەزاندووتە",
  "ئەگەر دابەزاندن نیوەچڵ بوو، دووبارە دایبەزێنە",
  "یەکێکی تر لە بەکاپەکانت هەڵبژێرە",
];
const WAIT_FIX = ["چەند خولەکێک چاوەڕێ بکە", "لاپەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدەرەوە"];

function busyMessage(): string {
  return running?.kind === "restore"
    ? "گەڕاندنەوەیەک ئێستا کار دەکات. چاوەڕێ بکە تا تەواو دەبێت."
    : "بەکاپێک ئێستا دروست دەکرێت. چاوەڕێ بکە تا تەواو دەبێت.";
}

// ─── The database, as MySQL keeps it ─────────────────────────────────────

/**
 * A connection that reads every value as MySQL wrote it.
 *
 * Every value comes back as the text MySQL itself prints — dates, decimals,
 * JSON, big numbers — and goes back in as that same text, so nothing is
 * rounded, re-zoned or re-parsed on the way. The session clock is UTC on
 * both sides, so a TIMESTAMP restores to the same instant on a server set to
 * any time zone. Binary columns are read as hex (see columnsOf).
 */
async function openRawConnection(): Promise<mysql.Connection> {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error(withFix("DATABASE_URL نییە — سیستەم بە داتابەیسەوە نەبەستراوە.", ["لە Coolify → Environment Variables، DATABASE_URL دابنێ", "Redeploy بکە"]));
  const conn = await mysql.createConnection({
    uri,
    charset: "utf8mb4",
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
    typeCast: (field: { string: (encoding?: string) => string | null }) => field.string("utf8"),
  } as mysql.ConnectionOptions);
  await conn.query("SET time_zone = '+00:00'");
  return conn;
}

/** A plain connection, for the migration runner after a restore. */
async function openPlainConnection(): Promise<mysql.Connection> {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error(withFix("DATABASE_URL نییە.", ["لە Coolify → Environment Variables، DATABASE_URL دابنێ", "Redeploy بکە"]));
  return mysql.createConnection({ uri, charset: "utf8mb4" });
}

const id = (name: string) => mysqlCore.escapeId(name);

const BINARY_TYPES = new Set([
  "binary", "varbinary", "tinyblob", "blob", "mediumblob", "longblob",
  "geometry", "point", "linestring", "polygon", "multipoint", "multilinestring", "multipolygon", "geometrycollection",
]);

interface ColumnInfo {
  name: string;
  /** text: as MySQL prints it, quoted. hex: binary bytes. bit: a BIT as its number. */
  kind: "text" | "hex" | "bit";
}

async function tableNames(conn: mysql.Connection): Promise<string[]> {
  const [rows] = await conn.query(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
  );
  return (rows as { name: string }[]).map((r) => r.name);
}

/** The columns a row is written with — generated ones are MySQL's to fill. */
async function columnsOf(conn: mysql.Connection, table: string): Promise<ColumnInfo[]> {
  const [rows] = await conn.query(
    "SELECT COLUMN_NAME AS name, DATA_TYPE AS type, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
    [table],
  );
  return (rows as { name: string; type: string; extra: string | null }[])
    .filter((c) => !/VIRTUAL GENERATED|STORED GENERATED/i.test(c.extra ?? ""))
    .map((c) => {
      const type = String(c.type).toLowerCase();
      return { name: c.name, kind: type === "bit" ? "bit" : BINARY_TYPES.has(type) ? "hex" : "text" };
    });
}

/** The one-column primary key a table can be read in order by, if it has one. */
async function singlePrimaryKey(conn: mysql.Connection, table: string): Promise<string | null> {
  const [rows] = await conn.query(
    "SELECT COLUMN_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION",
    [table],
  );
  const keys = rows as { name: string }[];
  return keys.length === 1 ? keys[0].name : null;
}

async function createStatementOf(conn: mysql.Connection, table: string): Promise<string> {
  const [rows] = await conn.query(`SHOW CREATE TABLE ${id(table)}`);
  const row = (rows as Record<string, string>[])[0];
  const sql = row?.["Create Table"];
  if (!sql) throw new Error(`SHOW CREATE TABLE ${table} returned nothing`);
  return sql;
}

const PAGE_ROWS = 200;

/**
 * Every row of one table as INSERT lines, read a page at a time.
 *
 * A table with a one-column key is read after the last key seen; reading by
 * OFFSET would make MySQL walk past every earlier row again for each page,
 * and the parcels table carries photos in its rows.
 */
async function* tableRowLines(
  conn: mysql.Connection,
  table: string,
  counter: { rows: number },
): AsyncGenerator<Buffer> {
  const columns = await columnsOf(conn, table);
  if (columns.length === 0) return;
  const pk = await singlePrimaryKey(conn, table);
  const pkIndex = pk ? columns.findIndex((c) => c.name === pk && c.kind === "text") : -1;
  const selectList = columns
    .map((c) =>
      c.kind === "hex" ? `HEX(${id(c.name)}) AS ${id(c.name)}`
        : c.kind === "bit" ? `CAST(${id(c.name)} AS UNSIGNED) AS ${id(c.name)}`
          : id(c.name),
    )
    .join(",");
  const encode = columns.map((c) => {
    if (c.kind === "hex") return (v: unknown) => (v == null ? "NULL" : `X'${String(v)}'`);
    if (c.kind === "bit") return (v: unknown) => (v == null ? "NULL" : String(v).replace(/[^0-9]/g, "") || "0");
    return (v: unknown) => mysqlCore.escape(v);
  });
  const names = columns.map((c) => c.name);

  let last: string | null = null;
  let offset = 0;
  for (;;) {
    const query: { sql: string; values: unknown[]; rowsAsArray: true } =
      pkIndex >= 0
        ? {
            sql: `SELECT ${selectList} FROM ${id(table)}${last !== null ? ` WHERE ${id(pk!)} > ?` : ""} ORDER BY ${id(pk!)} LIMIT ${PAGE_ROWS}`,
            values: last !== null ? [last] : [],
            rowsAsArray: true,
          }
        : { sql: `SELECT ${selectList} FROM ${id(table)} LIMIT ${PAGE_ROWS} OFFSET ${offset}`, values: [], rowsAsArray: true };
    const [result] = await conn.query(query);
    const rows = result as unknown as unknown[][];
    if (rows.length === 0) break;
    const literal = rows.map((row) => row.map((v, i) => encode[i](v)));
    for (const line of insertStatements(table, names, literal, (v) => String(v), id)) {
      yield Buffer.from(line, "utf8");
    }
    counter.rows += rows.length;
    if (rows.length < PAGE_ROWS) break;
    if (pkIndex >= 0) last = String(rows[rows.length - 1][pkIndex]);
    else offset += PAGE_ROWS;
  }
}

// ─── Making a backup ─────────────────────────────────────────────────────

export interface FullBackupOptions {
  createdById?: number;
  createdByName?: string;
  /** False for the copy taken before a restore: a restore never deletes a photo. */
  includeUploads: boolean;
  reason: BackupManifest["reason"];
}

/** Files kept on object storage rather than in our folder — usually none. */
async function remoteFiles(): Promise<{ url: string; path: string }[]> {
  try {
    const { collectAllFileUrls } = await import("./s3Backup.service");
    const all = await collectAllFileUrls();
    return all.filter((f) => /^https:\/\//i.test(f.url)).map((f) => ({ url: f.url, path: f.path }));
  } catch (err) {
    appLogger.warn("[Full backup] Could not list remote files", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/** Is there room on the disk for this? A half-written backup is worse than a refusal. */
async function checkDiskRoom(dir: string, neededBytes: number): Promise<void> {
  const statfs = (fsp as unknown as { statfs?: (p: string) => Promise<{ bavail: number; bsize: number }> }).statfs;
  if (!statfs) return;
  try {
    const s = await statfs(dir);
    const free = s.bavail * s.bsize;
    if (free < neededBytes) {
      const mb = (n: number) => Math.round(n / 1024 / 1024);
      throw new Error(
        withFix(`جێگای پێویست لەسەر سێرڤەر نییە: ${mb(neededBytes)} MB پێویستە، تەنها ${mb(free)} MB بەتاڵە.`, [
          "بەکاپە کۆنەکان لە لیستەکە بسڕەوە (پاش ئەوەی دابەزاندنت)",
          "دووبارە هەوڵ بدەرەوە",
        ]),
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("جێگای")) throw err;
  }
}

async function writeBackup(backupId: number, filename: string, opts: FullBackupOptions, job: BackupJob): Promise<{
  fileSize: number;
  manifest: BackupManifest;
}> {
  const finalPath = getLocalBackupFilePath(backupId, "zip");
  const partPath = `${finalPath}.part`;
  await fsp.mkdir(path.dirname(finalPath), { recursive: true });

  // What goes in from the uploads folder: every plain file, under its own name.
  const uploadsDir = getUploadsDir();
  const uploads: { name: string; full: string; size: number }[] = [];
  if (opts.includeUploads && fs.existsSync(uploadsDir)) {
    for (const entry of await fsp.readdir(uploadsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !uploadEntryName(`uploads/${entry.name}`)) continue;
      const full = path.join(uploadsDir, entry.name);
      uploads.push({ name: entry.name, full, size: (await fsp.stat(full)).size });
    }
  }
  const uploadBytes = uploads.reduce((s, u) => s + u.size, 0);
  await checkDiskRoom(path.dirname(finalPath), uploadBytes + 200 * 1024 * 1024);

  const conn = await openRawConnection();
  const out = fs.createWriteStream(partPath);
  const archive = archiver("zip", { zlib: { level: 6 } });
  const closed = new Promise<void>((resolve, reject) => {
    out.on("close", resolve);
    out.on("error", reject);
    archive.on("error", reject);
  });
  // Awaited after finalize; until then a failure is reported by the step
  // that hit it, and this copy of it must not crash the process unheard.
  closed.catch(() => undefined);
  archive.pipe(out);

  /** Adds one entry and waits until it is written — one table at a time. */
  const add = async (source: string | Buffer | Readable, name: string) => {
    const written = once(archive, "entry");
    archive.append(source, { name });
    await written;
  };

  try {
    // One consistent picture of every table, as mysqldump --single-transaction takes.
    await conn.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await conn.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");

    const [[server]] = (await conn.query("SELECT VERSION() AS v, DATABASE() AS db")) as unknown as [{ v: string; db: string }[]];
    const tables = await tableNames(conn);
    const remote = opts.includeUploads ? await remoteFiles() : [];
    job.total = tables.length + uploads.length + remote.length;

    const counted: { name: string; rows: number }[] = [];
    for (const table of tables) {
      job.step = `خشتەی ${table}`;
      const entries = tableEntries(table);
      await add(`${await createStatementOf(conn, table)};\n`, entries.schema);
      const counter = { rows: 0 };
      await add(Readable.from(tableRowLines(conn, table, counter), { objectMode: false }), entries.rows);
      counted.push({ name: table, rows: counter.rows });
      job.done++;
    }
    await conn.query("COMMIT");

    job.step = "وێنە و فایلەکان";
    for (const u of uploads) {
      await add(fs.createReadStream(u.full), `uploads/${u.name}`);
      job.done++;
    }

    const remoteManifest: { key: string; url: string }[] = [];
    let remoteFailed = 0;
    for (const f of remote) {
      try {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await add(Buffer.from(await res.arrayBuffer()), `remote-files/${f.path}`);
        remoteManifest.push({ key: f.path, url: f.url });
      } catch {
        remoteFailed++;
      }
      job.done++;
    }
    if (remoteManifest.length) await add(JSON.stringify(remoteManifest, null, 2), "remote-files-manifest.json");

    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      createdBy: opts.createdByName || "System",
      reason: opts.reason,
      commit: process.env.SOURCE_COMMIT?.trim() || null,
      database: {
        name: server?.db ?? "",
        mysqlVersion: server?.v ?? "",
        tables: counted,
        totalRows: counted.reduce((s, t) => s + t.rows, 0),
      },
      uploads: { included: opts.includeUploads, files: uploads.length, bytes: uploadBytes },
      remoteFiles: { files: remoteManifest.length, failed: remoteFailed },
    };
    await add(JSON.stringify(manifest, null, 2), "manifest.json");

    job.step = "تەواوکردنی فایلەکە";
    await archive.finalize();
    await closed;
    await fsp.rename(partPath, finalPath);
    const { size } = await fsp.stat(finalPath);
    appLogger.info("[Full backup] Written", { backupId, filename, size, tables: tables.length, uploads: uploads.length });
    return { fileSize: size, manifest };
  } catch (err) {
    archive.abort();
    out.destroy();
    await fsp.rm(partPath, { force: true }).catch(() => undefined);
    throw err;
  } finally {
    await conn.end().catch(() => undefined);
  }
}

/** A backup left "in progress" by a server that restarted is not in progress. */
async function closeInterrupted(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const stuck = await db
    .select({ id: backups.id, fileKey: backups.fileKey, createdAt: backups.createdAt })
    .from(backups)
    .where(and(eq(backups.status, "in_progress"), like(backups.fileKey, `${V6_KEY_PREFIX}%`)));
  const halfDay = 12 * 60 * 60 * 1000;
  for (const row of stuck) {
    if (jobs.get(row.id) && jobs.get(row.id) === running) continue;
    // A file still arriving from somebody's computer is not stuck — unless it stopped half a day ago.
    const uploading = row.fileKey.startsWith(`${V6_KEY_PREFIX}uploaded/`);
    if (uploading && Date.now() - new Date(row.createdAt).getTime() < halfDay) continue;
    await db
      .update(backups)
      .set({ status: "failed", errorMessage: "نیوەچڵ ماوە — سێرڤەرەکە لە ناوەڕاستدا ڕاوەستا. ئەم بەکاپە بسڕەوە و یەکێکی نوێ دروست بکە.", completedAt: new Date() })
      .where(eq(backups.id, row.id));
  }
}

async function insertBackupRow(filename: string, opts: FullBackupOptions): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error(retryFix("داتابەیس بەردەست نییە."));
  const [result] = await db.insert(backups).values({
    filename,
    fileKey: `${V6_KEY_PREFIX}${filename}`,
    fileUrl: "",
    backupType: "manual",
    backupContent: opts.includeUploads ? "full" : "database_only",
    status: "in_progress",
    createdById: opts.createdById,
    createdByName: opts.reason === "before_restore" ? `${opts.createdByName ?? ""} — پێش گەڕاندنەوە`.trim() : opts.createdByName,
  });
  return Number((result as { insertId: number }).insertId);
}

async function runBackup(backupId: number, filename: string, opts: FullBackupOptions, job: BackupJob): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error(retryFix("داتابەیس بەردەست نییە."));
  try {
    const { fileSize, manifest } = await writeBackup(backupId, filename, opts, job);
    await db
      .update(backups)
      .set({
        fileUrl: `${LOCAL_BACKUP_PREFIX}${backupId}`,
        fileSize,
        status: "completed",
        tablesCount: manifest.database.tables.length,
        recordsCount: manifest.database.totalRows,
        filesCount: manifest.uploads.files + manifest.remoteFiles.files,
        databaseName: manifest.database.name.slice(0, 100),
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));
    job.ok = true;
    job.message = `${manifest.database.tables.length} خشتە، ${manifest.database.totalRows} تۆمار، ${manifest.uploads.files} فایل.`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appLogger.error("[Full backup] Failed", { backupId, error: message });
    await db
      .update(backups)
      .set({ status: "failed", errorMessage: message.slice(0, 2000), completedAt: new Date() })
      .where(eq(backups.id, backupId));
    job.ok = false;
    job.message = message;
    throw err;
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

/** Starts a complete backup and answers at once; the screen follows its progress. */
export async function startFullBackup(opts: Omit<FullBackupOptions, "reason" | "includeUploads">): Promise<{ id: number; filename: string }> {
  claimStart();
  let job: BackupJob;
  let backupId: number;
  let filename: string;
  try {
    await closeInterrupted();
    filename = backupFileName(new Date(), "manual");
    backupId = await insertBackupRow(filename, { ...opts, includeUploads: true, reason: "manual" });
    job = { kind: "backup", backupId, step: "دەستپێکردن", done: 0, total: 1, startedAt: new Date().toISOString() };
    jobs.set(backupId, job);
    running = job;
  } finally {
    starting = false;
  }
  void runBackup(backupId, filename, { ...opts, includeUploads: true, reason: "manual" }, job)
    .catch(() => undefined)
    .finally(() => {
      if (running === job) running = null;
    });
  return { id: backupId, filename };
}

// ─── Reading a backup ────────────────────────────────────────────────────

/**
 * keepOpen: the restore goes back to entries it set aside (see SIGN_IN_TABLES),
 * which needs the file still open after the last entry has been listed.
 */
function openZip(file: string, keepOpen = false): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: !keepOpen }, (err, zip) => (err || !zip ? reject(err ?? new Error("ZIP")) : resolve(zip)));
  });
}

/**
 * Rebuilt last, in the final moment of a restore.
 *
 * Every request checks its session against these rows. Rebuilt in their
 * alphabetical turn, they were missing for most of the restore, so the
 * person watching it was sent to the sign-in page halfway through and never
 * saw it end (found in the local app, 2026-10-25).
 */
const SIGN_IN_TABLES = new Set(["users", "customers"]);

function nextEntry(zip: yauzl.ZipFile): Promise<yauzl.Entry | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      zip.removeListener("entry", onEntry);
      zip.removeListener("end", onEnd);
      zip.removeListener("error", onError);
    };
    const onEntry = (e: yauzl.Entry) => { cleanup(); resolve(e); };
    const onEnd = () => { cleanup(); resolve(null); };
    const onError = (e: Error) => { cleanup(); reject(e); };
    zip.on("entry", onEntry);
    zip.on("end", onEnd);
    zip.on("error", onError);
    zip.readEntry();
  });
}

function entryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => (err || !stream ? reject(err ?? new Error("stream")) : resolve(stream)));
  });
}

async function entryText(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of await entryStream(zip, entry)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * What a ZIP says it holds, read without changing anything.
 *
 * Used to check an uploaded file before it is accepted, and again before a
 * restore touches a single table.
 */
export async function inspectBackupZip(file: string): Promise<{ manifest: BackupManifest | null; problem: string | null }> {
  let zip: yauzl.ZipFile;
  try {
    zip = await openZip(file);
  } catch {
    return { manifest: null, problem: "ئەم فایلە ZIP ی دروست نییە، یان بە تەواوی بار نەبووە." };
  }
  const names = new Set<string>();
  let manifest: unknown = null;
  try {
    for (let e = await nextEntry(zip); e; e = await nextEntry(zip)) {
      names.add(e.fileName);
      if (e.fileName === "manifest.json") {
        try {
          manifest = JSON.parse(await entryText(zip, e));
        } catch {
          manifest = null;
        }
      }
    }
  } catch {
    return { manifest: null, problem: "ئەم فایلە ZIP تێکچووە — ناخوێندرێتەوە." };
  } finally {
    zip.close();
  }
  const problem = manifestProblem(manifest, names);
  return { manifest: problem ? null : (manifest as BackupManifest), problem };
}

// ─── Restoring ───────────────────────────────────────────────────────────

/**
 * Statements from a rows file, one per line, run as they arrive.
 *
 * Only what a backup writes is run: an INSERT into this one table. The
 * connection refuses two statements in one query, so nothing can ride along
 * behind it. A backup is a file that has been on a computer; it is read as
 * data, not trusted as a script.
 */
async function runLines(conn: mysql.Connection, table: string, stream: Readable): Promise<void> {
  const expected = `INSERT INTO ${id(table)} (`;
  const run = async (line: string) => {
    if (!line.trim()) return;
    if (!line.startsWith(expected)) throw new Error(withFix(`خشتەی ${table}: دێڕێک لە بەکاپەکەدا وەک بەکاپ نییە — گەڕاندنەوە وەستا.`, NOT_A_BACKUP_FIX));
    await conn.query(line);
  };
  for await (const line of statementLines(stream)) await run(line);
}

/**
 * Splits on the newline byte and nothing else.
 *
 * Node's readline also ends a line at U+2028 and U+2029, which a customer's
 * note can hold and the SQL escaping leaves as it is — a statement cut there
 * is a syntax error in the middle of a restore (found by the real-MySQL
 * probe). A UTF-8 character never contains the byte 0x0A, and the escaping
 * turns every newline inside a value into \n, so 0x0A only ever ends a
 * statement.
 */
export async function* statementLines(stream: Readable): AsyncGenerator<string> {
  let pending: Buffer[] = [];
  for await (const chunk of stream) {
    let buf = chunk as Buffer;
    let at = buf.indexOf(0x0a);
    while (at !== -1) {
      pending.push(buf.subarray(0, at));
      yield Buffer.concat(pending).toString("utf8");
      pending = [];
      buf = buf.subarray(at + 1);
      at = buf.indexOf(0x0a);
    }
    if (buf.length) pending.push(buf);
  }
  if (pending.length) yield Buffer.concat(pending).toString("utf8");
}

/** The CREATE a backup holds for a table, and nothing else. */
function checkedCreate(table: string, text: string): string {
  const create = text.trim().replace(/;\s*$/, "");
  if (!create.startsWith(`CREATE TABLE ${id(table)} (`)) {
    throw new Error(withFix(`خشتەی ${table}: شێوەی خشتەکە لە بەکاپەکەدا وەک بەکاپ نییە — گەڕاندنەوە وەستا.`, NOT_A_BACKUP_FIX));
  }
  return create;
}

async function writeUpload(zip: yauzl.ZipFile, entry: yauzl.Entry, name: string): Promise<void> {
  const dir = getUploadsDir();
  await fsp.mkdir(dir, { recursive: true });
  const target = path.join(dir, name);
  const temp = path.join(dir, `.restoring-${process.pid}-${name}`);
  await new Promise<void>((resolve, reject) => {
    entryStream(zip, entry)
      .then((src) => {
        const dst = fs.createWriteStream(temp);
        src.on("error", reject);
        dst.on("error", reject);
        dst.on("close", resolve);
        src.pipe(dst);
      })
      .catch(reject);
  });
  await fsp.rename(temp, target);
}

async function runRestore(backupId: number, file: string, manifest: BackupManifest, job: BackupJob, by: { id: number; name?: string | null }): Promise<void> {
  // 1. The way back, before anything changes.
  job.step = "کۆپی دۆخی ئێستا (بۆ گەڕانەوە ئەگەر پێویست بوو)";
  const safetyName = backupFileName(new Date(), "before_restore");
  const safetyOpts: FullBackupOptions = { createdById: by.id, createdByName: by.name ?? undefined, includeUploads: false, reason: "before_restore" };
  const safetyId = await insertBackupRow(safetyName, safetyOpts);
  const safetyJob: BackupJob = { kind: "backup", backupId: safetyId, step: "", done: 0, total: 1, startedAt: new Date().toISOString(), partOfRestore: true };
  jobs.set(safetyId, safetyJob);
  await runBackup(safetyId, safetyName, safetyOpts, safetyJob);
  job.safetyBackupId = safetyId;

  // 2. Every table in the backup, as it was.
  const conn = await openRawConnection();
  const zip = await openZip(file, true);
  job.total = manifest.database.tables.length + manifest.uploads.files + manifest.remoteFiles.files;
  let restoredTables = 0;
  let restoredFiles = 0;
  const remote: { key: string; data: Buffer }[] = [];
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("SET UNIQUE_CHECKS = 0");
    await conn.query("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");

    const listed = new Set(manifest.database.tables.map((t) => t.name));
    const applyTable = async (e: yauzl.Entry, tableEntry: { table: string; kind: "schema" | "rows" }) => {
      if (tableEntry.kind === "schema") {
        job.step = `خشتەی ${tableEntry.table}`;
        const create = checkedCreate(tableEntry.table, await entryText(zip, e));
        await conn.query(`DROP TABLE IF EXISTS ${id(tableEntry.table)}`);
        await conn.query(create);
      } else {
        await runLines(conn, tableEntry.table, await entryStream(zip, e));
        restoredTables++;
        job.done++;
      }
    };
    const setAside: { e: yauzl.Entry; tableEntry: { table: string; kind: "schema" | "rows" } }[] = [];
    for (let e = await nextEntry(zip); e; e = await nextEntry(zip)) {
      const tableEntry = parseTableEntry(e.fileName);
      if (tableEntry) {
        if (RESTORE_KEEPS.has(tableEntry.table) || !listed.has(tableEntry.table)) continue;
        if (SIGN_IN_TABLES.has(tableEntry.table)) setAside.push({ e, tableEntry });
        else await applyTable(e, tableEntry);
        continue;
      }
      const uploadName = uploadEntryName(e.fileName);
      if (uploadName) {
        job.step = "وێنە و فایلەکان";
        await writeUpload(zip, e, uploadName);
        restoredFiles++;
        job.done++;
        continue;
      }
      if (e.fileName.startsWith("remote-files/") && !e.fileName.endsWith("/")) {
        const chunks: Buffer[] = [];
        for await (const c of await entryStream(zip, e)) chunks.push(c as Buffer);
        remote.push({ key: e.fileName.slice("remote-files/".length), data: Buffer.concat(chunks) });
        job.done++;
      }
    }
    // The sign-in tables, last: the session check had its rows until now.
    for (const { e, tableEntry } of setAside) await applyTable(e, tableEntry);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.query("SET UNIQUE_CHECKS = 1");
  } finally {
    zip.close();
    await conn.end().catch(() => undefined);
  }

  if (remote.length) {
    const { storagePut } = await import("./storage.service");
    for (const f of remote) {
      try {
        await storagePut(f.key, f.data);
        restoredFiles++;
      } catch (err) {
        appLogger.warn("[Restore] Remote file not put back", { key: f.key, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // 3. A backup older than the code: give its tables today's columns.
  job.step = "نوێکردنەوەی شێوەی خشتەکان";
  const plain = await openPlainConnection();
  try {
    const { runSchemaPatches, reconcileColumns } = await import("../_core/migrations");
    await runSchemaPatches({ connection: plain as never });
    await reconcileColumns({ connection: plain as never });
  } catch (err) {
    appLogger.warn("[Restore] Schema catch-up after restore", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    await plain.end().catch(() => undefined);
  }

  // 4. Nothing remembered from before may answer for what is there now.
  cacheClear();
  try {
    const { forgetDocumentNames } = await import("../_core/documentGuard");
    forgetDocumentNames();
  } catch {
    // The guard re-reads within a minute anyway.
  }

  job.ok = true;
  job.message = `سیستەم گەڕایەوە بۆ ${erbilTime(manifest.createdAt)}. ${restoredTables} خشتە، ${manifest.database.totalRows} تۆمار، ${restoredFiles} فایل. کۆپی پێش گەڕاندنەوە: ژمارە ${safetyId}.`;
  appLogger.info("[Restore] Finished", { backupId, restoredTables, restoredFiles, safetyId });
}

/**
 * Starts putting the system back to a backup; answers at once.
 *
 * Checked whole before anything changes; then a copy of the present is taken
 * (the way back); then every table in the backup is replaced by its copy,
 * with its own ids, and every file is written back under its own name.
 * Tables newer than the backup, and files it does not hold, are left alone.
 */
export async function startRestore(backupId: number, by: { id: number; name?: string | null }): Promise<{ started: true }> {
  claimStart();
  let job: BackupJob;
  let file: string;
  let manifest: BackupManifest;
  try {
    const db = await getDb();
    if (!db) throw new Error(retryFix("داتابەیس بەردەست نییە."));
    const [row] = await db.select().from(backups).where(eq(backups.id, backupId));
    if (!row) throw new Error(withFix("ئەم بەکاپە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە", "بەکاپەکە لە لیستەکە هەڵبژێرەوە"]));
    if (row.status !== "completed" || !row.fileKey.startsWith(V6_KEY_PREFIX) || !row.fileUrl.startsWith(LOCAL_BACKUP_PREFIX)) {
      throw new Error(withFix("ئەم بەکاپە بە شێوازە کۆنەکەیە یان تەواو نەبووە، و ناگەڕێندرێتەوە.", ["«دروستکردنی بەکاپی نوێ» → «بەکاپی تەواو» هەڵبژێرە", "ئەو بەکاپە نوێیە بگەڕێنەوە"]));
    }
    file = getLocalBackupFilePath(backupId, "zip");
    if (!fs.existsSync(file)) {
      throw new Error(withFix("فایلی ئەم بەکاپە لەسەر سێرڤەر نەماوە (لەوانەیە Redeploy سڕیبێتیەوە).", ["فایلەکە لە کۆمپیوتەرەکەت بار بکەرەوە بە «بارکردنی بەکاپ لە کۆمپیوتەر»", "پاشان ئەو بەکاپە نوێیە بگەڕێنەوە"]));
    }
    const inspected = await inspectBackupZip(file);
    if (inspected.problem || !inspected.manifest) throw new Error(withFix(inspected.problem ?? "بەکاپەکە ناخوێندرێتەوە.", NOT_A_BACKUP_FIX));
    manifest = inspected.manifest;

    await closeInterrupted();
    job = { kind: "restore", backupId, step: "پشکنینی فایلەکە", done: 0, total: 1, startedAt: new Date().toISOString() };
    jobs.set(backupId, job);
    running = job;
  } finally {
    starting = false;
  }
  void runRestore(backupId, file, manifest, job, by)
    .catch((err) => {
      job.ok = false;
      const reason = err instanceof Error ? err.message : String(err);
      job.message = job.safetyBackupId
        ? `گەڕاندنەوە لە ناوەڕاستدا وەستا: ${reason}\nبۆ گەڕانەوە بۆ پێش ئەم هەوڵە: بەکاپی ژمارە ${job.safetyBackupId} بگەڕێنەوە.`
        : `گەڕاندنەوە دەستی پێنەکرد (هیچ شتێک نەگۆڕا): ${reason}`;
      appLogger.error("[Restore] Failed", { backupId, error: reason, safetyBackupId: job.safetyBackupId });
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString();
      if (running === job) running = null;
    });
  return { started: true };
}

// ─── A backup brought from a computer ────────────────────────────────────

/** Opens a row for a ZIP about to arrive in pieces. Super admin only (the route checks). */
export async function beginUploadedBackup(filename: string, by: { id: number; name?: string | null }): Promise<number> {
  if (running?.kind === "restore") throw new Error(withFix(busyMessage(), WAIT_FIX));
  const db = await getDb();
  if (!db) throw new Error(retryFix("داتابەیس بەردەست نییە."));
  const [result] = await db.insert(backups).values({
    filename,
    fileKey: `${V6_KEY_PREFIX}uploaded/${filename}`,
    fileUrl: "",
    backupType: "manual",
    backupContent: "full",
    status: "in_progress",
    createdById: by.id,
    createdByName: `${by.name ?? ""} — بارکراو لە کۆمپیوتەر`.trim(),
  });
  const backupId = Number((result as { insertId: number }).insertId);
  const file = getLocalBackupFilePath(backupId, "zip");
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(`${file}.part`, Buffer.alloc(0));
  return backupId;
}

/** The uploaded backup's row, if it is one still arriving. */
export async function uploadingBackup(backupId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(backups).where(eq(backups.id, backupId));
  if (!row || row.status !== "in_progress" || !row.fileKey.startsWith(`${V6_KEY_PREFIX}uploaded/`)) return null;
  return row;
}

export function uploadPartPath(backupId: number): string {
  return `${getLocalBackupFilePath(backupId, "zip")}.part`;
}

/** The last piece has arrived: check it whole, then list it as a backup. */
export async function finishUploadedBackup(backupId: number): Promise<{ ok: true; manifest: BackupManifest } | { ok: false; problem: string }> {
  const db = await getDb();
  if (!db) return { ok: false, problem: "داتابەیس بەردەست نییە." };
  const part = uploadPartPath(backupId);
  const file = getLocalBackupFilePath(backupId, "zip");
  const { manifest, problem } = await inspectBackupZip(part);
  if (problem || !manifest) {
    await fsp.rm(part, { force: true }).catch(() => undefined);
    await db
      .update(backups)
      .set({ status: "failed", errorMessage: problem ?? "ناخوێندرێتەوە", completedAt: new Date() })
      .where(eq(backups.id, backupId));
    return { ok: false, problem: problem ?? "ناخوێندرێتەوە" };
  }
  await fsp.rename(part, file);
  const { size } = await fsp.stat(file);
  await db
    .update(backups)
    .set({
      fileUrl: `${LOCAL_BACKUP_PREFIX}${backupId}`,
      fileSize: size,
      status: "completed",
      tablesCount: manifest.database.tables.length,
      recordsCount: manifest.database.totalRows,
      filesCount: manifest.uploads.files + manifest.remoteFiles.files,
      databaseName: manifest.database.name.slice(0, 100),
      completedAt: new Date(),
    })
    .where(eq(backups.id, backupId));
  return { ok: true, manifest };
}
