import { getDb } from "./db.js";
import { packages, invoices, backups } from "../drizzle/schema.js";
import { isNotNull } from "drizzle-orm";
import archiver from "archiver";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { storagePut } from "./storage.js";

/**
 * S3 File Backup Service
 * Collects all files from S3 and creates a ZIP archive
 */

export interface S3BackupResult {
  zipPath: string;
  zipUrl: string;
  fileCount: number;
  totalSize: number;
}

/**
 * Create a backup of all S3 files
 */
export async function backupS3Files(): Promise<S3BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipFilename = `s3-backup-${timestamp}.zip`;
  const tempZipPath = `/tmp/${zipFilename}`;

  // Create write stream for ZIP file
  const output = createWriteStream(tempZipPath);
  const archive = archiver("zip", {
    zlib: { level: 9 } // Maximum compression
  });

  // Pipe archive to file
  archive.pipe(output);

  let fileCount = 0;
  let totalSize = 0;

  try {
    // Collect all file URLs from database
    const fileUrls = await collectAllFileUrls();

    console.log(`[S3 Backup] Found ${fileUrls.length} files to backup`);

    // Download and add each file to ZIP
    for (const fileInfo of fileUrls) {
      try {
        // Download file from S3
        const response = await fetch(fileInfo.url);
        if (!response.ok) {
          console.warn(`[S3 Backup] Failed to download ${fileInfo.path}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Add to ZIP archive with organized folder structure
        archive.append(buffer, { name: fileInfo.path });
        
        fileCount++;
        totalSize += buffer.length;

        if (fileCount % 10 === 0) {
          console.log(`[S3 Backup] Processed ${fileCount}/${fileUrls.length} files`);
        }
      } catch (error) {
        console.error(`[S3 Backup] Error processing file ${fileInfo.path}:`, error);
      }
    }

    // Finalize ZIP archive
    await archive.finalize();

    // Wait for output stream to finish
    await new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      output.on("error", reject);
    });

    console.log(`[S3 Backup] ZIP created: ${zipFilename} (${fileCount} files, ${totalSize} bytes)`);

    // Upload ZIP to S3
    const zipBuffer = await fs.readFile(tempZipPath);
    const s3Key = `backups/files/${zipFilename}`;
    const { url: zipUrl } = await storagePut(s3Key, zipBuffer, "application/zip");

    // Clean up temp file
    await fs.unlink(tempZipPath);

    return {
      zipPath: s3Key,
      zipUrl,
      fileCount,
      totalSize,
    };
  } catch (error) {
    // Clean up on error
    try {
      await fs.unlink(tempZipPath);
    } catch {}
    
    throw error;
  }
}

/**
 * Get estimated size of S3 backup
 */
/**
 * Collect all file URLs from database tables
 */
export async function collectAllFileUrls(): Promise<Array<{ url: string; path: string }>> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const fileUrls: Array<{ url: string; path: string }> = [];

  // Collect package photos
  const packagesWithPhotos = await db
    .select({ photos: packages.photos, trackingNumber: packages.trackingNumber })
    .from(packages)
    .where(isNotNull(packages.photos));

  for (const pkg of packagesWithPhotos) {
    if (pkg.photos && Array.isArray(pkg.photos)) {
      pkg.photos.forEach((photoUrl: string, index: number) => {
        fileUrls.push({
          url: photoUrl,
          path: `packages/${pkg.trackingNumber}-${index + 1}.jpg`,
        });
      });
    }
  }

  // Collect invoice PDFs (if any)
  const invoicesWithFiles = await db
    .select({ id: invoices.id })
    .from(invoices);
  // Note: Add invoice file URLs if they are stored in database

  // Collect backup SQL files
  const backupFiles = await db
    .select({ fileUrl: backups.fileUrl, filename: backups.filename })
    .from(backups)
    .where(isNotNull(backups.fileUrl));

  for (const backup of backupFiles) {
    if (backup.fileUrl && backup.filename) {
      fileUrls.push({
        url: backup.fileUrl,
        path: `backups/database/${backup.filename}`,
      });
    }
  }

  return fileUrls;
}

export async function estimateS3BackupSize(): Promise<{ fileCount: number; estimatedSize: number }> {
  try {
    const files = await collectAllFileUrls();
    
    // Estimate size (cannot determine without downloading)
    return {
      fileCount: files.length,
      estimatedSize: 0, // Unknown until files are downloaded
    };
  } catch (error) {
    console.error("[S3 Backup] Failed to estimate size:", error);
    return { fileCount: 0, estimatedSize: 0 };
  }
}
