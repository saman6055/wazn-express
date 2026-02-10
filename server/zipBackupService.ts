import archiver from "archiver";
import { storagePut, storageGet } from "./storage.js";
import { getDb } from "./db.js";
import { backups } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import * as dbHelpers from "./db.js";
import { Readable } from "stream";

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
    console.log("[ZIP Backup] Starting complete backup...");

    // Create ZIP archive in memory
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];
    
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("warning", (err: any) => {
      console.warn("[ZIP Backup] Warning:", err);
    });

    archive.on("error", (err: any) => {
      throw err;
    });

    // Step 1: Export all database tables
    console.log("[ZIP Backup] Step 1: Exporting database...");
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

    // Add database.json to archive
    archive.append(JSON.stringify(databaseBackup, null, 2), { name: "database.json" });
    console.log(`[ZIP Backup] Database exported: ${exportResult.totalRecords} records from ${Object.keys(exportResult.data).length} tables`);

    // Step 2: Export all S3 files
    console.log("[ZIP Backup] Step 2: Exporting S3 files...");
    let filesCount = 0;
    
    try {
      // Collect all file URLs from database
      const { collectAllFileUrls } = await import("./s3BackupService.js");
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
            console.warn(`[ZIP Backup] Failed to download ${file.path}`);
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
            console.log(`[ZIP Backup] Exported ${filesCount} files...`);
          }
        } catch (fileError) {
          console.warn(`[ZIP Backup] Failed to export file ${file.path}:`, fileError);
        }
      }

      // Add files manifest
      archive.append(JSON.stringify(filesManifest, null, 2), { name: "files-manifest.json" });
      console.log(`[ZIP Backup] S3 files exported: ${filesCount} files`);
    } catch (s3Error) {
      console.warn("[ZIP Backup] S3 export failed, continuing with database only:", s3Error);
    }

    // Step 3: Create backup manifest
    const manifest = {
      version: "4.0",
      format: "wazn-complete-backup",
      createdAt: new Date().toISOString(),
      createdBy: options.createdByName || "System",
      backupType: options.backupType,
      contents: {
        database: true,
        files: filesCount > 0,
        databaseRecords: exportResult.totalRecords,
        databaseTables: Object.keys(exportResult.data).length,
        filesCount: filesCount,
      },
      restoreInstructions: "Use the Restore function in Data Management to restore this backup. All data will be replaced.",
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

    // Finalize archive and wait for completion
    await new Promise<void>((resolve, reject) => {
      archive.on("end", () => {
        console.log("[ZIP Backup] Archive finalized");
        resolve();
      });
      archive.on("error", (err) => {
        console.error("[ZIP Backup] Archive error:", err);
        reject(err);
      });
      archive.finalize();
    });

    // Combine chunks into single buffer
    const zipBuffer = Buffer.concat(chunks);
    const fileSize = zipBuffer.length;

    console.log(`[ZIP Backup] ZIP created: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Upload to S3
    console.log("[ZIP Backup] Uploading to S3...");
    const { url: fileUrl } = await storagePut(s3Key, zipBuffer, "application/zip");

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
      const { notifyOwner } = await import("./_core/notification.js");
      await notifyOwner({
        title: "✅ پاشەکەوتی تەواو سەرکەوتوو بوو",
        content: `پاشەکەوتێکی تەواو (ZIP) بە سەرکەوتوویی دروستکرا:\n\nناوی فایل: ${filename}\nقەبارە: ${(fileSize / 1024 / 1024).toFixed(2)} MB\nخشتەکان: ${Object.keys(exportResult.data).length} خشتە\nتۆمارەکان: ${exportResult.totalRecords}\nفایلەکان: ${filesCount}`,
      });
    } catch (notifError) {
      console.error("[ZIP Backup] Failed to send notification:", notifError);
    }

    console.log("[ZIP Backup] Complete backup finished successfully!");

    return {
      id: backupId,
      filename,
      fileUrl,
      fileSize,
      recordsCount: exportResult.totalRecords,
      filesCount,
    };
  } catch (error) {
    console.error("[ZIP Backup] Error:", error);
    
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
      const { notifyOwner } = await import("./_core/notification.js");
      await notifyOwner({
        title: "❌ پاشەکەوتی تەواو شکستی هێنا",
        content: `پاشەکەوتی تەواو شکستی هێنا:\n\nهەڵە: ${error instanceof Error ? error.message : String(error)}`,
      });
    } catch (notifError) {
      console.error("[ZIP Backup] Failed to send notification:", notifError);
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

  console.log("[ZIP Restore] Starting restore from:", backup.filename);

  const errors: string[] = [];
  let restoredRecords = 0;
  let restoredFiles = 0;

  try {
    // Download ZIP file
    console.log("[ZIP Restore] Downloading backup file...");
    const response = await fetch(backup.fileUrl);
    if (!response.ok) {
      throw new Error("Failed to download backup file");
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[ZIP Restore] Downloaded: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

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
    console.log("[ZIP Restore] Backup version:", manifest.version);
    console.log("[ZIP Restore] Contents:", manifest.contents);

    // Step 1: Restore database
    console.log("[ZIP Restore] Step 1: Restoring database...");
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
      console.log(`[ZIP Restore] ${category}: imported ${result.imported}, skipped ${result.skipped}`);
    }

    console.log(`[ZIP Restore] Database restored: ${restoredRecords} records`);

    // Step 2: Restore S3 files
    if (manifest.contents.files) {
      console.log("[ZIP Restore] Step 2: Restoring S3 files...");
      
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
                console.log(`[ZIP Restore] Restored ${restoredFiles} files...`);
              }
            }
          } catch (fileError) {
            console.warn(`[ZIP Restore] Failed to restore file ${fileInfo.key}:`, fileError);
            errors.push(`File ${fileInfo.key}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
          }
        }
        
        console.log(`[ZIP Restore] S3 files restored: ${restoredFiles} files`);
      }
    }

    const hasErrors = errors.length > 0;
    const message = `Restored ${restoredRecords} database records and ${restoredFiles} files${hasErrors ? ` (with ${errors.length} errors)` : ''}`;

    // Notify owner
    try {
      const { notifyOwner } = await import("./_core/notification.js");
      await notifyOwner({
        title: hasErrors ? "⚠️ گەڕاندنەوە تەواوبوو (بە هەڵە)" : "✅ گەڕاندنەوە سەرکەوتوو بوو",
        content: `گەڕاندنەوە لە پاشەکەوت:\n\nفایل: ${backup.filename}\nتۆمارەکان: ${restoredRecords}\nفایلەکان: ${restoredFiles}${hasErrors ? `\n\nهەڵەکان: ${errors.length}` : ''}`,
      });
    } catch (notifError) {
      console.error("[ZIP Restore] Failed to send notification:", notifError);
    }

    console.log("[ZIP Restore] Complete restore finished!");

    return {
      success: !hasErrors || restoredRecords > 0,
      message,
      restoredRecords,
      restoredFiles,
      errors,
    };
  } catch (error) {
    console.error("[ZIP Restore] Error:", error);
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
