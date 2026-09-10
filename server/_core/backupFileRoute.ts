import type { Express } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "./sdk";
import { getDb } from "../db/connection";
import { backups } from "../../drizzle/schema";
import { getLocalBackupFilePath, LOCAL_BACKUP_PREFIX } from "../services/zipBackup.service";

/**
 * Backup file download (admin only): serves a local ZIP/JSON or redirects to
 * the stored remote URL.
 *
 * The Backups screen links here for every backup. The route existed only in
 * the dev server, so in production the link fell through to the page
 * catch-all and the "download" saved the app's own index.html — the one copy
 * of the data an owner reaches for in an emergency was a web page. Both
 * entries register it from here.
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
        return res.download(localPath, backup.filename || `backup-${id}.${ext}`, (err) => {
          if (err && !res.headersSent) res.status(500).json({ error: "Download failed" });
        });
      }
      return res.redirect(302, backup.fileUrl);
    } catch {
      return res.status(403).json({ error: "Forbidden" });
    }
  });
}
