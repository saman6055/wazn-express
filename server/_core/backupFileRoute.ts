import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import fsp from "fs/promises";
import { eq } from "drizzle-orm";
import { sdk } from "./sdk";
import { getDb } from "../db/connection";
import { backups } from "../../drizzle/schema";
import { getLocalBackupFilePath, LOCAL_BACKUP_PREFIX } from "../services/zipBackup.service";
import {
  beginUploadedBackup,
  finishUploadedBackup,
  uploadingBackup,
  uploadPartPath,
} from "../services/fullBackup.service";
import { cleanUploadedName, MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES } from "../lib/backupFormat";
import { appLogger } from "../utils/logger";
import { registerAutoBackupRoutes } from "./autoBackupRoute";

/**
 * Backup file download (admin only): serves a local ZIP/JSON or redirects to
 * the stored remote URL.
 *
 * The Backups screen links here for every backup. The route existed only in
 * the dev server, so in production the link fell through to the page
 * catch-all and the "download" saved the app's own index.html — the one copy
 * of the data an owner reaches for in an emergency was a web page. Both
 * entries register it from here.
 *
 * And the way back in: a backup kept on the owner's own computer, uploaded
 * here in pieces (main admin only), checked whole, and listed beside the
 * others — from where the Restore button puts the system back to it.
 */
export function registerBackupFileRoute(app: Express): void {
  app.get("/api/backup-file/:id", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user || user.isCustomer || (user.role !== "super_admin" && user.role !== "admin")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid backup id" });
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });
      const [backup] = await db.select().from(backups).where(eq(backups.id, id));
      if (!backup || !backup.fileUrl) return res.status(404).json({ error: "Backup not found" });
      if (backup.fileUrl.startsWith(LOCAL_BACKUP_PREFIX)) {
        const ext = backup.filename?.endsWith(".json") ? "json" : "zip";
        const localPath = getLocalBackupFilePath(id, ext);
        if (!fs.existsSync(localPath)) {
          return res
            .status(404)
            .type("text/plain; charset=utf-8")
            .send("فایلی ئەم بەکاپە لەسەر سێرڤەر نەماوە (Redeploy دەیسڕێتەوە). بەکاپێکی نوێ دروست بکە و ڕاستەوخۆ دایبەزێنە.");
        }
        return res.download(localPath, backup.filename || `backup-${id}.${ext}`, (err) => {
          if (err && !res.headersSent) res.status(500).json({ error: "Download failed" });
        });
      }
      return res.redirect(302, backup.fileUrl);
    } catch {
      return res.status(403).json({ error: "Forbidden" });
    }
  });

  registerBackupUploadRoutes(app);
  // The owner's computer, taking its daily backup with the backup key.
  registerAutoBackupRoutes(app);
}

/** The main admin, or an answer saying why not. */
async function mainAdmin(req: Request, res: Response): Promise<{ id: number; name: string | null } | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user && !user.isCustomer && user.role === "super_admin") return { id: user.id, name: user.name ?? null };
  } catch {
    // Falls through to the refusal.
  }
  res.status(403).json({ error: "تەنها ئادمینی سەرەکی دەتوانێت بەکاپ بار بکات و بیگەڕێنێتەوە." });
  return null;
}

function refuse(res: Response, status: number, error: string, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ error, ...extra });
}

function registerBackupUploadRoutes(app: Express): void {
  // 1. Open a place for the file. Body: { name, size }.
  app.post("/api/backup-upload/start", async (req, res) => {
    const by = await mainAdmin(req, res);
    if (!by) return;
    const size = Number((req.body ?? {}).size);
    if (!Number.isFinite(size) || size <= 0) return refuse(res, 400, "قەبارەی فایلەکە نەزانراوە.");
    if (size > MAX_UPLOAD_BYTES) return refuse(res, 413, "فایلەکە زۆر گەورەیە (زیاتر لە 20 GB).");
    try {
      const id = await beginUploadedBackup(cleanUploadedName((req.body ?? {}).name), by);
      const db = await getDb();
      // The size it promised, kept on the row, so the last piece can be checked against it.
      await db?.update(backups).set({ fileSize: Math.trunc(size) }).where(eq(backups.id, id));
      return res.json({ id, chunkSize: UPLOAD_CHUNK_BYTES });
    } catch (err) {
      return refuse(res, 409, err instanceof Error ? err.message : String(err));
    }
  });

  // 2. One piece, at the offset it belongs. A piece sent twice, or one that
  //    arrives after a dropped connection, is answered with where the file
  //    really stands, so the page carries on from there.
  app.put(
    "/api/backup-upload/:id/chunk",
    express.raw({ type: () => true, limit: UPLOAD_CHUNK_BYTES + 1024 }),
    async (req, res) => {
      const by = await mainAdmin(req, res);
      if (!by) return;
      const id = parseInt(req.params.id, 10);
      const offset = Number(req.query.offset);
      const row = Number.isFinite(id) ? await uploadingBackup(id) : null;
      if (!row) return refuse(res, 404, "ئەم بارکردنە نەدۆزرایەوە یان تەواو بووە.");
      const part = uploadPartPath(id);
      const current = fs.existsSync(part) ? (await fsp.stat(part)).size : 0;
      if (!Number.isFinite(offset) || offset !== current) return refuse(res, 409, "offset", { size: current });
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (body.length === 0) return refuse(res, 400, "پارچەکە بەتاڵە.");
      if (row.fileSize && current + body.length > row.fileSize) return refuse(res, 400, "زیاتر لە قەبارەی فایلەکە نێردرا.");
      await fsp.appendFile(part, body);
      return res.json({ size: current + body.length });
    },
  );

  // 3. Every piece is here: check the ZIP whole and list it.
  app.post("/api/backup-upload/:id/finish", async (req, res) => {
    const by = await mainAdmin(req, res);
    if (!by) return;
    const id = parseInt(req.params.id, 10);
    const row = Number.isFinite(id) ? await uploadingBackup(id) : null;
    if (!row) return refuse(res, 404, "ئەم بارکردنە نەدۆزرایەوە یان تەواو بووە.");
    const part = uploadPartPath(id);
    const size = fs.existsSync(part) ? (await fsp.stat(part)).size : 0;
    if (row.fileSize && size !== row.fileSize) {
      return refuse(res, 409, "هەموو فایلەکە نەگەیشتووە — دووبارە هەوڵ بدەرەوە.", { size });
    }
    try {
      const result = await finishUploadedBackup(id);
      if (!result.ok) return refuse(res, 400, result.problem);
      appLogger.info("[Backup upload] Accepted", { id, by: by.id, tables: result.manifest.database.tables.length });
      return res.json({
        id,
        createdAt: result.manifest.createdAt,
        tables: result.manifest.database.tables.length,
        rows: result.manifest.database.totalRows,
        files: result.manifest.uploads.files,
      });
    } catch (err) {
      return refuse(res, 500, err instanceof Error ? err.message : String(err));
    }
  });
}
