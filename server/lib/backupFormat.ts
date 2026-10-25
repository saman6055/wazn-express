/**
 * The shape of a complete backup: one ZIP that brings the system back to the
 * moment it was taken.
 *
 * What the old "full backup" held was a JSON of 71 hand-listed tables, and
 * the system has 111: every delivery box, every box receipt, every box
 * discount, the carton check, tasks, the shop, the bell's pending credits —
 * none of it was ever in a backup. Its photos were fetched by address, and
 * an address like /uploads/abc.jpg cannot be fetched from inside the server,
 * so every photo was counted as failed and left out. And its restore gave
 * every row a new id unless the tables were wiped first, so a customer's
 * parcels pointed at somebody else.
 *
 * This format does what mysqldump does, from inside the app:
 *
 *   manifest.json            what is inside, counted, so a restore can check
 *                            before it touches anything
 *   db/<table>.schema.sql    the table's own CREATE, as MySQL wrote it
 *   db/<table>.rows.sql      every row, one INSERT statement per line, with
 *                            the row's own id
 *   uploads/<name>           every file in the uploads folder, under its own
 *                            name, so every stored link keeps working
 *   remote-files/...         files kept on object storage, when there is any
 *
 * Every table the database has is in it — the list is asked of MySQL, never
 * written by hand — so a table added next year is backed up before anybody
 * remembers to add it.
 */

export const BACKUP_FORMAT = "wazn-complete-backup";
export const BACKUP_VERSION = "6.0";

/** Marks a v6 backup's row in the backups table (fileKey prefix). */
export const V6_KEY_PREFIX = "backups/v6/";

/**
 * Tables a restore leaves exactly as they are.
 *
 * The backups list itself: restoring an older list would forget the backup
 * being restored — and the one taken a moment before it, which is the way
 * back if the restore was a mistake.
 */
export const RESTORE_KEEPS = new Set(["backups"]);

/** One statement stays well under MySQL's smallest max_allowed_packet (4 MB). */
export const MAX_STATEMENT_BYTES = 1_000_000;
export const MAX_ROWS_PER_STATEMENT = 500;

/** Upload from a computer: sent in pieces, so no proxy or timeout sees one huge request. */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 * 1024;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: string;
  createdAt: string;
  createdBy: string;
  /** Why it was taken: by hand, or the automatic copy before a restore. */
  reason: "manual" | "before_restore";
  /** The code it was taken under, when the deployment says. */
  commit: string | null;
  database: {
    name: string;
    mysqlVersion: string;
    tables: { name: string; rows: number }[];
    totalRows: number;
  };
  uploads: { included: boolean; files: number; bytes: number };
  remoteFiles: { files: number; failed: number };
}

/** The ZIP entry names for one table. */
export function tableEntries(table: string): { schema: string; rows: string } {
  return { schema: `db/${table}.schema.sql`, rows: `db/${table}.rows.sql` };
}

/** Which table, and which half of it, an entry name holds — or null. */
export function parseTableEntry(entry: string): { table: string; kind: "schema" | "rows" } | null {
  const m = /^db\/([A-Za-z0-9_$]{1,64})\.(schema|rows)\.sql$/.exec(entry);
  return m ? { table: m[1], kind: m[2] as "schema" | "rows" } : null;
}

/**
 * The file name an uploads/ entry may be written back under, or null.
 *
 * A bare name inside the uploads folder and nothing else: no folder, no
 * parent hop, no drive letter. A backup is somebody's file once it has been
 * on a computer, and a name in it must not be able to reach outside the
 * folder it is restored into.
 */
export function uploadEntryName(entry: string): string | null {
  if (!entry.startsWith("uploads/")) return null;
  const name = entry.slice("uploads/".length);
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(name)) return null;
  if (name === "." || name === ".." || name.includes("..")) return null;
  return name;
}

/**
 * Is this manifest one a restore can trust enough to start?
 *
 * Returns what is wrong, in the owner's language with the cure, or null.
 * Checked before a single table is touched.
 */
export function manifestProblem(manifest: unknown, entryNames: ReadonlySet<string>): string | null {
  const m = manifest as Partial<BackupManifest> | null;
  if (!m || typeof m !== "object") return "فایلی manifest.json نییە یان تێکچووە.";
  if (m.format !== BACKUP_FORMAT) return "ئەم فایلە بەکاپی تەواوی وەزن نییە.";
  if (typeof m.version !== "string" || Number.parseFloat(m.version) < 6) {
    return "ئەم بەکاپە بە شێوازە کۆنەکەیە و ناتەواوە (نزیکەی 40 خشتە و وێنەکانی تێدا نییە).";
  }
  const tables = m.database?.tables;
  if (!Array.isArray(tables) || tables.length === 0) return "هیچ خشتەیەک لە بەکاپەکەدا نییە.";
  if (!tables.some((t) => t?.name === "users")) return "خشتەی users لە بەکاپەکەدا نییە — ئەم بەکاپە تەواو نییە.";
  for (const t of tables) {
    if (!t || typeof t.name !== "string" || !parseTableEntry(`db/${t.name}.schema.sql`)) {
      return "ناوی خشتەیەک لە بەکاپەکەدا هەڵەیە.";
    }
    const e = tableEntries(t.name);
    if (!entryNames.has(e.schema) || !entryNames.has(e.rows)) {
      return `خشتەی ${t.name} لە بەکاپەکەدا ناتەواوە — فایلەکە بە تەواوی دانەبەزیوە یان تێکچووە.`;
    }
  }
  return null;
}

/**
 * INSERT statements for a run of rows, each on one line.
 *
 * One line per statement is what lets a restore read the file as a stream
 * of lines: the escaping turns every newline inside a value into \n, so a
 * line break only ever ends a statement. A statement closes at
 * MAX_ROWS_PER_STATEMENT rows or MAX_STATEMENT_BYTES, whichever comes first,
 * so a table of base64 photos never builds a packet MySQL refuses.
 */
export function insertStatements(
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
  escape: (value: unknown) => string,
  escapeId: (name: string) => string,
): string[] {
  const head = `INSERT INTO ${escapeId(table)} (${columns.map(escapeId).join(",")}) VALUES `;
  const out: string[] = [];
  let values: string[] = [];
  let bytes = head.length;
  rows.forEach((row) => {
    const tuple = `(${row.map((v: unknown) => escape(v)).join(",")})`;
    if (values.length > 0 && (values.length >= MAX_ROWS_PER_STATEMENT || bytes + tuple.length + 1 > MAX_STATEMENT_BYTES)) {
      out.push(`${head}${values.join(",")};\n`);
      values = [];
      bytes = head.length;
    }
    values.push(tuple);
    bytes += tuple.length + 1;
  });
  if (values.length > 0) out.push(`${head}${values.join(",")};\n`);
  return out;
}

/** A file name for the downloaded ZIP: the date and time it was taken. */
export function backupFileName(at: Date, reason: BackupManifest["reason"]): string {
  const stamp = at.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return reason === "before_restore" ? `wazn-before-restore-${stamp}.zip` : `wazn-full-${stamp}.zip`;
}

/** A name a person gave a file, made safe to store and show. */
export function cleanUploadedName(name: unknown): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const safe = base.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const named = safe || "backup";
  return named.toLowerCase().endsWith(".zip") ? named : `${named}.zip`;
}
