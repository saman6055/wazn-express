import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import { storagePut, storageGet } from "./storage.service";
import { getDb } from "../db";
import { appLogger } from "../utils/logger";
import { backups } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import * as dbHelpers from "../db";
import { Readable } from "stream";

/** Prefix for backup fileUrl when stored locally (no S3/Forge). Download via GET /api/backup-file/:id */
export const LOCAL_BACKUP_PREFIX = "local:";

/** Path on disk for a local backup file (when storage is not configured). ext: 'zip' | 'json' */
export function getLocalBackupFilePath(backupId: number, ext: "zip" | "json" = "zip"): string {
  return path.join(process.cwd(), "data", "backups", `${backupId}.${ext}`);
}

interface ZipBackupOptions {
  backupType: "manual" | "scheduled";
  schedule?: "daily" | "weekly" | "monthly";
  createdById?: number;
  createdByName?: string;
}

/**
 * Create a complete ZIP backup containing:
 * - All database tables as JSON
 * - All S3 files
 * - System metadata
 */
export async function createZipBackup(options: ZipBackupOptions): Promise<{
  id: number;
  filename: string;
  fileUrl: string;
  fileSize: number;
  recordsCount: number;
  filesCount: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `wazn-backup-${timestamp}.zip`;
  const s3Key = `backups/complete/${filename}`;

  // Create backup record
  const [result] = await db.insert(backups).values({
    filename,
    fileKey: s3Key,
    fileUrl: "",
    backupType: options.backupType,
    backupContent: "full",
    schedule: options.schedule,
    status: "in_progress",
    createdById: options.createdById,
    createdByName: options.createdByName,
  });

  const backupId = Number(result.insertId);

  try {
    appLogger.info("[ZIP Backup] Starting complete backup...");

    // Create ZIP archive in memory
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];
    
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("warning", (err: unknown) => {
      appLogger.warn("[ZIP Backup] Warning", { error: err instanceof Error ? err.message : String(err) });
    });

    archive.on("error", (err: unknown) => {
      throw err;
    });

    // Step 1: Export all database tables
    appLogger.info("[ZIP Backup] Step 1: Exporting database...");
    const exportResult = await dbHelpers.exportAllData();
    
    if (!exportResult.success) {
      throw new Error("Failed to export database");
    }

    // Create database JSON with metadata
    const databaseBackup = {
      version: "4.0", // Version 4.0 = Complete ZIP backup
      type: "complete_backup",
      createdAt: new Date().toISOString(),
      createdBy: options.createdByName || "System",
      backupType: options.backupType,
      totalRecords: exportResult.totalRecords,
      tableCount: exportResult.tableCount || Object.keys(exportResult.data).length,
      tables: exportResult.data,
    };

    const dbJsonString = JSON.stringify(databaseBackup, null, 2);
    const crypto = await import("crypto");
    const databaseHash = crypto.createHash("sha256").update(dbJsonString).digest("hex");

    // Add database.json to archive
    archive.append(dbJsonString, { name: "database.json" });
    appLogger.info(`[ZIP Backup] Database exported: ${exportResult.totalRecords} records from ${Object.keys(exportResult.data).length} tables`);

    // Step 2: Export all S3 files
    appLogger.info("[ZIP Backup] Step 2: Exporting S3 files...");
    let filesCount = 0;
    let failedFiles = 0;

    try {
      // Collect all file URLs from database
      const { collectAllFileUrls } = await import("./s3Backup.service");
      const s3Files = await collectAllFileUrls();

      // Create files manifest
      const filesManifest: Array<{
        key: string;
        url: string;
        size: number;
        contentType: string;
      }> = [];

      for (const file of s3Files) {
        try {
          // Download file content
          const response = await fetch(file.url);
          if (!response.ok) {
            appLogger.warn(`[ZIP Backup] Failed to download ${file.path}`);
            failedFiles++;
            continue;
          }

          const fileContent = Buffer.from(await response.arrayBuffer());

          // Add file to archive under "files/" directory
          archive.append(fileContent, { name: `files/${file.path}` });

          filesManifest.push({
            key: file.path,
            url: file.url,
            size: fileContent.length,
            contentType: "application/octet-stream",
          });

          filesCount++;

          if (filesCount % 10 === 0) {
            appLogger.info(`[ZIP Backup] Exported ${filesCount} files...`);
          }
        } catch (fileError) {
          appLogger.warn("[ZIP Backup] Failed to export file", { path: file.path, error: fileError instanceof Error ? fileError.message : String(fileError) });
          failedFiles++;
        }
      }

      // Add files manifest
      archive.append(JSON.stringify(filesManifest, null, 2), { name: "files-manifest.json" });
      appLogger.info(`[ZIP Backup] S3 files exported: ${filesCount} files`);
    } catch (s3Error) {
      appLogger.warn("[ZIP Backup] S3 export failed, continuing with database only", { error: s3Error instanceof Error ? s3Error.message : String(s3Error) });
    }

    // Step 3: Create backup manifest with integrity data
    const tableRowCounts: Record<string, number> = {};
    for (const [tableName, rows] of Object.entries(exportResult.data)) {
      tableRowCounts[tableName] = Array.isArray(rows) ? rows.length : 0;
    }

    const manifest = {
      version: "5.0",
      format: "wazn-complete-backup",
      createdAt: new Date().toISOString(),
      createdBy: options.createdByName || "System",
      backupType: options.backupType,
      system: {
        name: "Wazn Express",
        backupVersion: "5.0",
      },
      contents: {
        database: {
          included: true,
          totalRecords: exportResult.totalRecords,
          totalTables: Object.keys(exportResult.data).length,
          tableRowCounts,
        },
        files: {
          included: filesCount > 0,
          totalFiles: filesCount,
          failedFiles,
        },
      },
      integrity: {
        databaseHash,
        manifestCreatedAt: new Date().toISOString(),
      },
      restoreInstructions: {
        en: "Use the Restore function in Data Management to restore this backup.",
        ku: "Use Restore in Data Management.",
      },
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

    // Finalize archive and wait for completion
    await new Promise<void>((resolve, reject) => {
      archive.on("end", () => {
        appLogger.info("[ZIP Backup] Archive finalized");
        resolve();
      });
      archive.on("error", (err) => {
        appLogger.error("[ZIP Backup] Archive error", { error: err instanceof Error ? err.message : String(err) });
        reject(err);
      });
      archive.finalize();
    });

    // Combine chunks into single buffer
    const zipBuffer = Buffer.concat(chunks);
    const fileSize = zipBuffer.length;

    appLogger.info(`[ZIP Backup] ZIP created: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    let fileUrl: string;
    try {
      appLogger.info("[ZIP Backup] Uploading to storage...");
      const result = await storagePut(s3Key, zipBuffer, "application/zip");
      fileUrl = result.url;
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      const isStorageMissing = /Storage proxy credentials missing|BUILT_IN_FORGE/i.test(msg);
      if (isStorageMissing) {
        // Save ZIP to local disk so backup still works without S3/Forge
        const localPath = getLocalBackupFilePath(backupId);
        const dir = path.dirname(localPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(localPath, zipBuffer);
        fileUrl = LOCAL_BACKUP_PREFIX + String(backupId);
        appLogger.info("[ZIP Backup] Storage not configured; saved locally", { path: localPath });
      } else {
        throw uploadErr;
      }
    }

    // Update backup record
    await db.update(backups)
      .set({
        fileUrl,
        fileSize,
        recordsCount: exportResult.totalRecords,
        filesCount,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));

    // Notify owner
    try {
      const { notifyOwner } = await import("../_core/notification.js");
      await notifyOwner({
        title: "✅ پاشەکەوتی تەواو سەرکەوتوو بوو",
        content: `پاشەکەوتێکی تەواو (ZIP) بە سەرکەوتوویی دروستکرا:\n\nناوی فایل: ${filename}\nقەبارە: ${(fileSize / 1024 / 1024).toFixed(2)} MB\nخشتەکان: ${Object.keys(exportResult.data).length}\nتۆمارەکان: ${exportResult.totalRecords}\nفایلەکان: ${filesCount} (${failedFiles} شکستی)\n\nDB Hash: ${databaseHash.substring(0, 16)}...`,
      });
    } catch (notifError) {
      appLogger.error("[ZIP Backup] Failed to send notification", { error: notifError instanceof Error ? notifError.message : String(notifError) });
    }

    appLogger.info("[ZIP Backup] Complete backup finished successfully!");

    return {
      id: backupId,
      filename,
      fileUrl,
      fileSize,
      recordsCount: exportResult.totalRecords,
      filesCount,
    };
  } catch (error) {
    appLogger.error("[ZIP Backup] Error", { error: error instanceof Error ? error.message : String(error) });
    
    // Update backup record with error
    await db.update(backups)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));

    // Notify owner of failure
    try {
      const { notifyOwner } = await import("../_core/notification.js");
      await notifyOwner({
        title: "❌ پاشەکەوتی تەواو شکستی هێنا",
        content: `پاشەکەوتی تەواو شکستی هێنا:\n\nهەڵە: ${error instanceof Error ? error.message : String(error)}`,
      });
    } catch (notifError) {
      appLogger.error("[ZIP Backup] Failed to send notification", { error: notifError instanceof Error ? notifError.message : String(notifError) });
    }

    throw error;
  }
}

/**
 * Restore complete system from ZIP backup
 * This will:
 * 1. Clear existing data (optional)
 * 2. Restore all database tables
 * 3. Restore all S3 files
 */
export async function restoreFromZipBackup(backupId: number, clearExisting: boolean = false): Promise<{
  success: boolean;
  message: string;
  restoredRecords: number;
  restoredFiles: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get backup record
  const [backup] = await db.select().from(backups).where(eq(backups.id, backupId));
  
  if (!backup) {
    throw new Error("Backup not found");
  }

  if (!backup.fileUrl) {
    throw new Error("Backup file URL not found");
  }

  appLogger.info("[ZIP Restore] Starting restore from", { filename: backup.filename });

  const errors: string[] = [];
  let restoredRecords = 0;
  let restoredFiles = 0;

  try {
    let zipBuffer: Buffer;
    if (backup.fileUrl.startsWith(LOCAL_BACKUP_PREFIX)) {
      const localId = backup.fileUrl.slice(LOCAL_BACKUP_PREFIX.length);
      const localPath = getLocalBackupFilePath(Number(localId));
      appLogger.info("[ZIP Restore] Reading local backup file...", { path: localPath });
      zipBuffer = await fs.readFile(localPath);
    } else {
      appLogger.info("[ZIP Restore] Downloading backup file...");
      const response = await fetch(backup.fileUrl);
      if (!response.ok) {
        throw new Error("Failed to download backup file");
      }
      zipBuffer = Buffer.from(await response.arrayBuffer());
    }
    appLogger.info(`[ZIP Restore] Downloaded: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Extract ZIP contents
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // Find and read manifest
    const manifestEntry = zipEntries.find(e => e.entryName === "manifest.json");
    if (!manifestEntry) {
      throw new Error("Invalid backup: manifest.json not found");
    }

    const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
    appLogger.info("[ZIP Restore] Backup version", { version: manifest.version });
    appLogger.info("[ZIP Restore] Contents", { contents: manifest.contents });

    // Verify manifest version
    if (!manifest.version || parseFloat(manifest.version) < 4.0) {
      appLogger.warn("[ZIP Restore] Old backup format version:", manifest.version);
    }

    // Log expected vs actual
    const contentsDb = manifest.contents?.database;
    if (typeof contentsDb === "object" && contentsDb?.totalRecords != null) {
      appLogger.info("[ZIP Restore] Expected records: " + contentsDb.totalRecords);
    }
    if (typeof contentsDb === "object" && contentsDb?.totalTables != null) {
      appLogger.info("[ZIP Restore] Expected tables: " + contentsDb.totalTables);
    }

    // Step 1: Restore database
    appLogger.info("[ZIP Restore] Step 1: Restoring database...");
    const databaseEntry = zipEntries.find(e => e.entryName === "database.json");
    if (!databaseEntry) {
      throw new Error("Invalid backup: database.json not found");
    }

    const databaseBackup = JSON.parse(databaseEntry.getData().toString("utf8"));
    
    if (!databaseBackup.tables) {
      throw new Error("Invalid backup format - missing tables data");
    }

    // Import all tables
    const importResult = await dbHelpers.importAllData(databaseBackup.tables, clearExisting);
    restoredRecords = importResult.totalImported;

    // Collect errors from each category
    for (const [category, result] of Object.entries(importResult.categoryResults)) {
      if (result.errors.length > 0) {
        errors.push(`${category}: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? ` (+${result.errors.length - 3} more)` : ''}`);
      }
      appLogger.info(`[ZIP Restore] ${category}: imported ${result.imported}, skipped ${result.skipped}`);
    }

    appLogger.info(`[ZIP Restore] Database restored: ${restoredRecords} records`);

    // Verify restored count
    const expectedRecords = typeof contentsDb === "object" && contentsDb?.totalRecords != null ? contentsDb.totalRecords : 0;
    if (expectedRecords > 0) {
      const actualRecords = restoredRecords;
      const percentage = Math.round((actualRecords / expectedRecords) * 100);
      appLogger.info(`[ZIP Restore] Verification: ${actualRecords}/${expectedRecords} records restored (${percentage}%)`);
      if (percentage < 90) {
        errors.push(`Warning: Only ${percentage}% of expected records were restored (${actualRecords}/${expectedRecords})`);
      }
    }

    // Step 2: Restore S3 files
    const contentsFiles = manifest.contents?.files;
    const filesIncluded = contentsFiles === true || (typeof contentsFiles === "object" && contentsFiles?.included);
    if (filesIncluded) {
      appLogger.info("[ZIP Restore] Step 2: Restoring S3 files...");
      
      const filesManifestEntry = zipEntries.find(e => e.entryName === "files-manifest.json");
      if (filesManifestEntry) {
        const filesManifest = JSON.parse(filesManifestEntry.getData().toString("utf8"));
        
        for (const fileInfo of filesManifest) {
          try {
            const fileEntry = zipEntries.find(e => e.entryName === `files/${fileInfo.key}`);
            if (fileEntry) {
              const fileContent = fileEntry.getData();
              await storagePut(fileInfo.key, fileContent, fileInfo.contentType);
              restoredFiles++;
              
              if (restoredFiles % 10 === 0) {
                appLogger.info(`[ZIP Restore] Restored ${restoredFiles} files...`);
              }
            }
          } catch (fileError) {
            appLogger.warn("[ZIP Restore] Failed to restore file", { key: fileInfo.key, error: fileError instanceof Error ? fileError.message : String(fileError) });
            errors.push(`File ${fileInfo.key}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
          }
        }
        
        appLogger.info(`[ZIP Restore] S3 files restored: ${restoredFiles} files`);
      }
    }

    const hasErrors = errors.length > 0;
    const message = `Restored ${restoredRecords} database records and ${restoredFiles} files${hasErrors ? ` (with ${errors.length} errors)` : ''}`;

    // Notify owner
    try {
      const { notifyOwner } = await import("../_core/notification.js");
      await notifyOwner({
        title: hasErrors ? "⚠️ گەڕاندنەوە تەواوبوو (بە هەڵە)" : "✅ گەڕاندنەوە سەرکەوتوو بوو",
        content: `گەڕاندنەوە لە پاشەکەوت:\n\nفایل: ${backup.filename}\nتۆمارەکان: ${restoredRecords}\nفایلەکان: ${restoredFiles}${hasErrors ? `\n\nهەڵەکان: ${errors.length}` : ''}`,
      });
    } catch (notifError) {
      appLogger.error("[ZIP Restore] Failed to send notification", { error: notifError instanceof Error ? notifError.message : String(notifError) });
    }

    appLogger.info("[ZIP Restore] Complete restore finished!");

    return {
      success: !hasErrors || restoredRecords > 0,
      message,
      restoredRecords,
      restoredFiles,
      errors,
    };
  } catch (error) {
    appLogger.error("[ZIP Restore] Error", { error: error instanceof Error ? error.message : String(error) });
    errors.push(error instanceof Error ? error.message : String(error));
    
    return {
      success: false,
      message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
      restoredRecords,
      restoredFiles,
      errors,
    };
  }
}
