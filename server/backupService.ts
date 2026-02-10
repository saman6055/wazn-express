import { storagePut } from "./storage.js";
import { getDb } from "./db";
import { backups } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import * as dbHelpers from "./db";

interface BackupOptions {
  backupType: "manual" | "scheduled";
  backupContent: "database_only" | "files_only" | "full";
  schedule?: "daily" | "weekly" | "monthly";
  createdById?: number;
  createdByName?: string;
}

/**
 * Create a database backup using database API and upload to S3
 * Optionally includes S3 files backup
 */
export async function createBackup(options: BackupOptions) {
  if (options.backupContent === "full") {
    return await createFullBackup(options);
  } else if (options.backupContent === "files_only") {
    return await createFilesBackup(options);
  } else {
    return await createDatabaseBackup(options);
  }
}

/**
 * Create database-only backup using database API
 * This exports all data as JSON instead of using mysqldump
 */
async function createDatabaseBackup(options: BackupOptions) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json`;
  const tempPath = `/tmp/${filename}`;

  // Generate S3 key
  const s3Key = `backups/${filename}`;
  
  // Create backup record
  const [result] = await db.insert(backups).values({
    filename,
    fileKey: s3Key,
    fileUrl: "", // Will be updated after upload
    backupType: options.backupType,
    backupContent: "database_only",
    schedule: options.schedule,
    status: "in_progress",
    createdById: options.createdById,
    createdByName: options.createdByName,
  });

  const backupId = Number(result.insertId);

  try {
    console.log(`[Backup] Starting database backup...`);
    
    // Export all data using database API
    const exportResult = await dbHelpers.exportAllData();
    
    if (!exportResult.success) {
      throw new Error("Failed to export data from database");
    }

    // Create backup JSON with metadata
    const backupData = {
      version: "3.0", // Version 3.0 includes ALL database tables
      createdAt: new Date().toISOString(),
      createdBy: options.createdByName || "System",
      backupType: options.backupType,
      totalRecords: exportResult.totalRecords,
      tableCount: exportResult.tableCount || Object.keys(exportResult.data).length,
      tables: exportResult.data
    };

    // Convert to JSON string
    const jsonContent = JSON.stringify(backupData, null, 2);
    const fileBuffer = Buffer.from(jsonContent, 'utf-8');
    const fileSize = fileBuffer.length;

    console.log(`[Backup] Exported ${exportResult.totalRecords} records, file size: ${(fileSize / 1024).toFixed(2)} KB`);

    // Upload to S3
    const { url: fileUrl } = await storagePut(s3Key, fileBuffer, "application/json");

    // Update backup record
    await db.update(backups)
      .set({
        fileUrl,
        fileSize,
        recordsCount: exportResult.totalRecords,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));

    // Notify owner of successful backup
    try {
      const { notifyOwner } = await import("./_core/notification.js");
      const tableCount = exportResult.tableCount || Object.keys(exportResult.data).length;
      await notifyOwner({
        title: "✅ بەکاپی داتابەیس سەرکەوتوو بوو",
        content: `بەکاپێکی تەواو بە سەرکەوتوویی دروستکرا:\n\nناوی فایل: ${filename}\nقەبارە: ${(fileSize / 1024).toFixed(2)} KB\nخشتەکان: ${tableCount} خشتە\nتۆمارەکان: ${exportResult.totalRecords}\nجۆر: ${options.backupType}${options.schedule ? ` (${options.schedule})` : ""}`,
      });
    } catch (notifError) {
      console.error("[Backup] Failed to send notification:", notifError);
    }

    return { id: backupId, filename, fileUrl, fileSize, backupContent: options.backupContent, recordsCount: exportResult.totalRecords };
  } catch (error) {
    console.error("[Backup] Error:", error);
    // Update backup record with error
    await db.update(backups)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));

    // Notify owner of backup failure
    try {
      const { notifyOwner } = await import("./_core/notification.js");
      await notifyOwner({
        title: "❌ بەکاپی داتابەیس شکستی هێنا",
        content: `بەکاپێک شکستی هێنا:\n\nناوی فایل: ${filename}\nجۆر: ${options.backupType}${options.schedule ? ` (${options.schedule})` : ""}\n\nهەڵە: ${error instanceof Error ? error.message : String(error)}`,
      });
    } catch (notifError) {
      console.error("[Backup] Failed to send notification:", notifError);
    }

    throw error;
  }
}

/**
 * Create files-only backup
 */
async function createFilesBackup(options: BackupOptions) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Create backup record
  const [result] = await db.insert(backups).values({
    filename: "files-backup.zip",
    fileKey: "",
    fileUrl: "",
    backupType: options.backupType,
    backupContent: "files_only",
    schedule: options.schedule,
    status: "in_progress",
    createdById: options.createdById,
    createdByName: options.createdByName,
  });

  const backupId = Number(result.insertId);

  try {
    // Import S3 backup service
    const { backupS3Files } = await import("./s3BackupService.js");
    
    // Create S3 files backup
    const s3Result = await backupS3Files();

    // Update backup record
    await db.update(backups)
      .set({
        filesZipUrl: s3Result.zipUrl,
        filesZipSize: s3Result.totalSize,
        filesCount: s3Result.fileCount,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));

    return { id: backupId, zipUrl: s3Result.zipUrl, fileCount: s3Result.fileCount, backupContent: "files_only" };
  } catch (error) {
    await db.update(backups)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));
    throw error;
  }
}

/**
 * Create full backup (database + files)
 */
async function createFullBackup(options: BackupOptions) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `full-backup-${timestamp}.json`;

  // Create backup record
  const [result] = await db.insert(backups).values({
    filename,
    fileKey: "",
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
    // Step 1: Create database backup
    console.log("[Full Backup] Step 1: Creating database backup...");
    const dbBackup = await createDatabaseBackup({
      ...options,
      backupContent: "database_only",
    });
    console.log("[Full Backup] Database backup completed:", dbBackup.filename);

    // Step 2: Create S3 files backup
    console.log("[Full Backup] Step 2: Creating S3 files backup...");
    const { backupS3Files } = await import("./s3BackupService.js");
    const s3Result = await backupS3Files();
    console.log("[Full Backup] S3 backup completed:", s3Result.fileCount, "files");

    // Update backup record with both results
    await db.update(backups)
      .set({
        filename: dbBackup.filename,
        fileKey: dbBackup.filename,
        fileUrl: dbBackup.fileUrl,
        fileSize: dbBackup.fileSize,
        recordsCount: dbBackup.recordsCount,
        filesZipUrl: s3Result.zipUrl,
        filesZipSize: s3Result.totalSize,
        filesCount: s3Result.fileCount,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(backups.id, backupId));

    // Notify owner
    try {
      const { notifyOwner } = await import("./_core/notification.js");
      await notifyOwner({
        title: "✅ بەکاپی تەواو سەرکەوتوو بوو",
        content: `بەکاپێکی تەواو (database + files) بە سەرکەوتوویی دروستکرا:\n\nداتابەیس: ${(dbBackup.fileSize / 1024).toFixed(2)} KB (${dbBackup.recordsCount} تۆمار)\nفایلەکان: ${s3Result.fileCount} فایل (${(s3Result.totalSize / 1024 / 1024).toFixed(2)} MB)`,
      });
    } catch (notifError) {
      console.error("[Backup] Failed to send notification:", notifError);
    }

    return { 
      id: backupId, 
      databaseUrl: dbBackup.fileUrl, 
      filesZipUrl: s3Result.zipUrl,
      backupContent: "full",
      recordsCount: dbBackup.recordsCount,
    };
  } catch (error) {
    console.error("[Full Backup] Error:", error);
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
        title: "❌ بەکاپی تەواو شکستی هێنا",
        content: `بەکاپی تەواو شکستی هێنا:\n\nهەڵە: ${error instanceof Error ? error.message : String(error)}`,
      });
    } catch (notifError) {
      console.error("[Backup] Failed to send notification:", notifError);
    }

    throw error;
  }
}

/**
 * Restore database from a backup file
 * Uses database API instead of mysql command
 */
export async function restoreBackup(backupId: number) {
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

  console.log("[Restore] Starting restore from:", backup.filename);

  try {
    // Download backup file from S3
    const response = await fetch(backup.fileUrl);
    if (!response.ok) {
      throw new Error("Failed to download backup file");
    }

    const content = await response.text();
    
    // Parse the backup data
    let backupData: any;
    try {
      backupData = JSON.parse(content);
    } catch (parseError) {
      throw new Error("Invalid backup file format - expected JSON");
    }

    // Validate backup format
    if (!backupData.tables) {
      throw new Error("Invalid backup format - missing tables data");
    }

    console.log("[Restore] Backup version:", backupData.version || "1.0");
    console.log("[Restore] Total records:", backupData.totalRecords || "unknown");

    // Restore all tables using importAllData
    const tables = backupData.tables;
    
    console.log(`[Restore] Starting restore of ${Object.keys(tables).length} tables...`);
    
    const importResult = await dbHelpers.importAllData(tables, true);
    
    const restoredCount = importResult.totalImported;
    const errors: string[] = [];
    
    // Collect errors from each category
    for (const [category, result] of Object.entries(importResult.categoryResults)) {
      if (result.errors.length > 0) {
        errors.push(`${category}: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? ` (+${result.errors.length - 3} more)` : ''}`);
      }
      console.log(`[Restore] ${category}: imported ${result.imported}, skipped ${result.skipped}`);
    }

    // If this is a full backup, also restore S3 files
    let filesRestored = 0;
    if (backup.backupContent === "full" && backup.filesZipUrl) {
      try {
        console.log("[Restore] Restoring S3 files from:", backup.filesZipUrl);
        const { restoreS3Files } = await import("./s3RestoreService.js");
        filesRestored = await restoreS3Files(backup.filesZipUrl);
        console.log(`[Restore] Restored ${filesRestored} S3 files`);
      } catch (s3Error) {
        console.error("[Restore] Failed to restore S3 files:", s3Error);
        errors.push(`S3 files: ${s3Error instanceof Error ? s3Error.message : String(s3Error)}`);
      }
    }

    const hasErrors = errors.length > 0;
    const message = backup.backupContent === "full" 
      ? `Restored ${restoredCount} database records and ${filesRestored} files${hasErrors ? ` (with ${errors.length} errors)` : ''}`
      : `Restored ${restoredCount} database records${hasErrors ? ` (with ${errors.length} errors)` : ''}`;

    return { 
      success: !hasErrors || restoredCount > 0,
      message,
      restoredCount,
      filesRestored,
      errors: hasErrors ? errors : undefined
    };
  } catch (error) {
    console.error("[Restore] Error:", error);
    throw error;
  }
}

/**
 * Delete old backups (cleanup)
 */
export async function cleanupOldBackups(daysToKeep: number = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  // Find old backups
  const oldBackups = await db.select()
    .from(backups)
    .where(eq(backups.status, "completed"));

  let deletedCount = 0;

  for (const backup of oldBackups) {
    if (backup.createdAt && backup.createdAt < cutoffDate) {
      // Delete from database
      await db.delete(backups).where(eq(backups.id, backup.id));
      deletedCount++;
    }
  }

  return { deletedCount };
}
