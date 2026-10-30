import type { Express, Request, Response } from "express";
import fs from "fs";
import { and, eq, like, lt } from "drizzle-orm";
import { getDb } from "../db/connection";
import { backups } from "../../drizzle/schema";
import * as db from "../db";
import { getLocalBackupFilePath } from "../services/zipBackup.service";
import { backupIsBusy, getBackupJob, removeBackup, startFullBackup } from "../services/fullBackup.service";
import { AUTO_KEY_PREFIX } from "../lib/backupFormat";
import rateLimit from "express-rate-limit";
import {
  AUTO_BACKUP_PENDING_SETTING,
  AUTO_BACKUP_SETTING,
  PAIR_MINUTES,
  cleanComputerName,
  isFingerprint,
  keyFromHeader,
  keyMatches,
  livePending,
  newPairCode,
  parseStoredKey,
  type PendingPairing,
  type StoredAutoKey,
} from "../lib/autoBackupKey";
import { appLogger } from "../utils/logger";
import { asyncRoute } from "./asyncRoute";

/**
 * Where the owner's computer takes its daily backup (tools/auto-backup).
 *
 * Four answers, all for the backup key and nothing else, and all limited to
 * the backups that key itself made: start one, ask how it is going, fetch
 * it, and delete the server's copy once it is safely on the computer.
 * A session cookie is not accepted here, and the key is accepted nowhere
 * else (server/lib/autoBackupKey.ts).
 */

/** The server keeps an automatic backup two days at most: the computer has it by then. */
const SERVER_KEEPS_MS = 2 * 24 * 60 * 60 * 1000;

async function storedKey(): Promise<StoredAutoKey | null> {
  return parseStoredKey(await db.getSetting(AUTO_BACKUP_SETTING));
}

/** The stored key, if the request carries it; otherwise a 401 has been sent. */
async function keyHolder(req: Request, res: Response): Promise<StoredAutoKey | null> {
  const stored = await storedKey();
  if (keyMatches(keyFromHeader(req.headers.authorization), stored)) return stored;
  res.status(401).json({ error: "کلیلی بەکاپی خۆکار هەڵەیە یان ڕاگیراوە. لە «بەڕێوەبردنی بەکاپ» کلیلێکی نوێ دروست بکە و دووبارە دایبنێ." });
  return null;
}

/** One of the key's own backups, or a 404 has been sent. */
async function ownBackup(req: Request, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  const database = await getDb();
  const [row] = Number.isFinite(id) && database ? await database.select().from(backups).where(eq(backups.id, id)) : [];
  if (!row || !row.fileKey.startsWith(AUTO_KEY_PREFIX)) {
    res.status(404).json({ error: "ئەم بەکاپە نەدۆزرایەوە." });
    return null;
  }
  return row;
}

async function noteUse(stored: StoredAutoKey, action: string, backupId: number): Promise<void> {
  try {
    await db.setSetting(AUTO_BACKUP_SETTING, JSON.stringify({ ...stored, lastUsedAt: new Date().toISOString() }));
    await db.createAuditLog({
      userId: stored.createdById,
      userRole: "super_admin",
      action,
      entityType: "backup",
      entityId: backupId,
      newValues: { by: "auto-backup key", hint: stored.hint },
    });
  } catch (err) {
    appLogger.warn("[Auto backup] Could not record use", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** Server copies the computer never collected, older than two days. */
async function dropStaleAutoBackups(): Promise<void> {
  const database = await getDb();
  if (!database) return;
  const old = await database
    .select({ id: backups.id })
    .from(backups)
    .where(and(like(backups.fileKey, `${AUTO_KEY_PREFIX}%`), lt(backups.createdAt, new Date(Date.now() - SERVER_KEEPS_MS))));
  for (const row of old) if (!backupIsBusy(row.id)) await removeBackup(row.id).catch(() => undefined);
}

/** Asking to be connected is open to anyone, so it is held to a person's pace. */
const pairLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "داواکاری زۆر بوو. 15 خولەک چاوەڕێ بکە و دووبارە هەوڵ بدەرەوە." });
  },
});

export function registerAutoBackupRoutes(app: Express): void {
  // A computer asks to be connected: it sends its key's fingerprint, never
  // the key, and gets the six-digit code the Backups page will show beside
  // the main admin's «بیبەستەوە» button (server/lib/autoBackupKey.ts).
  app.post("/api/auto-backup/pair", pairLimiter, asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { fingerprint?: unknown; computer?: unknown };
    if (!isFingerprint(body.fingerprint)) return res.status(400).json({ error: "داواکارییەکە دروست نییە." });
    // One request at a time: while the owner's own code is still live, a
    // second computer waits — otherwise anyone could keep replacing it.
    const current = livePending(await db.getSetting(AUTO_BACKUP_PENDING_SETTING));
    if (current && current.fingerprint !== body.fingerprint) {
      return res.status(409).json({ error: `کۆمپیوتەرێکی تر لە پەیوەستبووندایە. ${PAIR_MINUTES} خولەک چاوەڕێ بکە.` });
    }
    const pending: PendingPairing = {
      fingerprint: body.fingerprint,
      code: newPairCode(),
      computer: cleanComputerName(body.computer),
      requestedAt: new Date().toISOString(),
    };
    await db.setSetting(AUTO_BACKUP_PENDING_SETTING, JSON.stringify(pending));
    appLogger.info("[Auto backup] A computer asked to be connected", { computer: pending.computer });
    return res.json({ code: pending.code, minutes: PAIR_MINUTES });
  }));

  // The setup on the computer asks this once: is the key right, and is the
  // server new enough to know what a backup key is?
  app.get("/api/auto-backup/check", asyncRoute(async (req, res) => {
    if (!(await keyHolder(req, res))) return;
    return res.json({ ok: true });
  }));

  app.post("/api/auto-backup/start", asyncRoute(async (req, res) => {
    const stored = await keyHolder(req, res);
    if (!stored) return;
    try {
      await dropStaleAutoBackups();
      const { id, filename } = await startFullBackup({ createdByName: "بەکاپی خۆکار — کۆمپیوتەری خاوەن", automatic: true });
      await noteUse(stored, "auto_backup_start", id);
      return res.json({ id, filename });
    } catch (err) {
      return res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }));

  app.get("/api/auto-backup/:id", asyncRoute(async (req, res) => {
    if (!(await keyHolder(req, res))) return;
    const row = await ownBackup(req, res);
    if (!row) return;
    const job = getBackupJob(row.id);
    return res.json({
      id: row.id,
      filename: row.filename,
      status: row.status,
      fileSize: row.fileSize ?? null,
      error: row.errorMessage ?? null,
      step: job?.step ?? null,
      done: job?.done ?? null,
      total: job?.total ?? null,
    });
  }));

  app.get("/api/auto-backup/:id/file", asyncRoute(async (req, res) => {
    const stored = await keyHolder(req, res);
    if (!stored) return;
    const row = await ownBackup(req, res);
    if (!row) return;
    const file = getLocalBackupFilePath(row.id, "zip");
    if (row.status !== "completed" || !fs.existsSync(file)) {
      return res.status(409).json({ error: "ئەم بەکاپە هێشتا ئامادە نییە." });
    }
    await noteUse(stored, "auto_backup_download", row.id);
    return res.download(file, row.filename, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: "دابەزاندن سەرکەوتوو نەبوو." });
    });
  }));

  app.delete("/api/auto-backup/:id", asyncRoute(async (req, res) => {
    const stored = await keyHolder(req, res);
    if (!stored) return;
    const row = await ownBackup(req, res);
    if (!row) return;
    if (backupIsBusy(row.id)) return res.status(409).json({ error: "ئەم بەکاپە ئێستا کاری لەسەر دەکرێت." });
    await removeBackup(row.id);
    await noteUse(stored, "auto_backup_delete", row.id);
    return res.json({ deleted: row.id });
  }));
}
