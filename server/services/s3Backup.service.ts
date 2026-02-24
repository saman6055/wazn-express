import { getDb } from "../db";
import { appLogger } from "../utils/logger";
import {
  packages,
  paymentRecords,
  expenses,
  fullPackageOrders,
  invoices,
  invoiceTemplates,
  packageQrCodes,
  packageScans,
  customerMessages,
  chatMessages,
  labelTemplates,
  stockCategories,
  stockProducts,
  blogPosts,
  systemSettings,
} from "../../drizzle/schema.js";
import { isNotNull } from "drizzle-orm";
import archiver from "archiver";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { storagePut } from "./storage.service";
import { getLocalBackupFilePath, LOCAL_BACKUP_PREFIX } from "./zipBackup.service";

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
 * Create a backup of all S3 files.
 * If backupId is provided and storage is not configured, saves ZIP locally and returns local URL.
 */
export async function backupS3Files(backupId?: number): Promise<S3BackupResult> {
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

    appLogger.info("[S3 Backup] Found files to backup", { count: fileUrls.length });

    // Download and add each file to ZIP
    for (const fileInfo of fileUrls) {
      try {
        // Download file from S3
        const response = await fetch(fileInfo.url);
        if (!response.ok) {
          appLogger.warn("[S3 Backup] Failed to download", { path: fileInfo.path });
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Add to ZIP archive with organized folder structure
        archive.append(buffer, { name: fileInfo.path });
        
        fileCount++;
        totalSize += buffer.length;

        if (fileCount % 10 === 0) {
          appLogger.info("[S3 Backup] Processed files", { fileCount, total: fileUrls.length });
        }
      } catch (error) {
        appLogger.error("[S3 Backup] Error processing file", { path: fileInfo.path, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Finalize ZIP archive
    await archive.finalize();

    // Wait for output stream to finish
    await new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      output.on("error", reject);
    });

    appLogger.info("[S3 Backup] ZIP created", { zipFilename, fileCount, totalSize });

    const zipBuffer = await fs.readFile(tempZipPath);
    const s3Key = `backups/files/${zipFilename}`;
    let zipUrl: string;
    try {
      const result = await storagePut(s3Key, zipBuffer, "application/zip");
      zipUrl = result.url;
    } catch (uploadErr: unknown) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      const isStorageMissing = /Storage proxy credentials missing|BUILT_IN_FORGE/i.test(msg);
      if (isStorageMissing && backupId != null) {
        const localPath = getLocalBackupFilePath(backupId, "zip");
        const dir = path.dirname(localPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(localPath, zipBuffer);
        zipUrl = LOCAL_BACKUP_PREFIX + String(backupId);
        appLogger.info("[S3 Backup] Storage not configured; saved locally", { path: localPath });
      } else {
        await fs.unlink(tempZipPath).catch(() => {});
        throw uploadErr;
      }
    }

    // Clean up temp file
    await fs.unlink(tempZipPath).catch(() => {});

    return {
      zipPath: s3Key,
      zipUrl,
      fileCount,
      totalSize,
    };
  } catch (error) {
    try {
      await fs.unlink(tempZipPath);
    } catch {}
    throw error;
  }
}

/**
 * Collect ALL file URLs from ALL database tables
 * This is the SINGLE SOURCE OF TRUTH for file backup
 *
 * IMPORTANT: When adding new file columns to ANY table,
 * you MUST add them here too!
 *
 * Last updated: covers 16 file sources across 15 tables
 */
export async function collectAllFileUrls(): Promise<Array<{
  url: string;
  path: string;
  source: string;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const fileUrls: Array<{ url: string; path: string; source: string }> = [];

  // Helper: safely add a URL (skip null, empty, or non-URL values)
  function addUrl(url: string | null | undefined, path: string, source: string) {
    if (!url || typeof url !== "string" || url.trim() === "") return;
    if (!url.startsWith("http") && !url.startsWith("/")) return;
    fileUrls.push({ url: url.trim(), path, source });
  }

  // Helper: safely add URLs from a JSON array
  function addUrlArray(urls: string[] | null | undefined, pathPrefix: string, source: string) {
    if (!urls || !Array.isArray(urls)) return;
    urls.forEach((url, index) => {
      addUrl(url, `${pathPrefix}-${index + 1}`, source);
    });
  }

  // Helper: run a table collection, skip if table doesn't exist
  async function safeCollect<T>(
    name: string,
    fn: () => Promise<T[]>,
    process: (rows: T[]) => void
  ): Promise<void> {
    try {
      const rows = await fn();
      process(rows);
      appLogger.info("[File Collection] " + name + ": " + rows.length + " rows");
    } catch (err) {
      appLogger.warn("[File Collection] Skipped " + name + " (table may not exist)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    appLogger.info("[File Collection] Starting complete file URL collection...");

    // ─── 1. packages.photos (JSON array) ───
    await safeCollect(
      "packages.photos",
      () =>
        db
          .select({ photos: packages.photos, trackingNumber: packages.trackingNumber })
          .from(packages)
          .where(isNotNull(packages.photos)),
      (pkgRows) => {
        for (const row of pkgRows) {
          addUrlArray(
            row.photos as string[] | null,
            `packages/${row.trackingNumber}`,
            "packages.photos"
          );
        }
      }
    );

    // ─── 2. paymentRecords.receiptPhoto ───
    await safeCollect(
      "paymentRecords.receiptPhoto",
      () =>
        db
          .select({ id: paymentRecords.id, receiptPhoto: paymentRecords.receiptPhoto })
          .from(paymentRecords)
          .where(isNotNull(paymentRecords.receiptPhoto)),
      (paymentRows) => {
        for (const row of paymentRows) {
          addUrl(row.receiptPhoto, `payments/receipt-${row.id}.jpg`, "paymentRecords.receiptPhoto");
        }
      }
    );

    // ─── 3. expenses.receiptUrl ───
    await safeCollect(
      "expenses.receiptUrl",
      () =>
        db
          .select({ id: expenses.id, receiptUrl: expenses.receiptUrl })
          .from(expenses)
          .where(isNotNull(expenses.receiptUrl)),
      (expenseRows) => {
        for (const row of expenseRows) {
          addUrl(row.receiptUrl, `expenses/receipt-${row.id}.jpg`, "expenses.receiptUrl");
        }
      }
    );

    // ─── 4. fullPackageOrders ───
    await safeCollect(
      "fullPackageOrders",
      () =>
        db.select({
          id: fullPackageOrders.id,
          productImages: fullPackageOrders.productImages,
          purchaseInvoiceUrl: fullPackageOrders.purchaseInvoiceUrl,
        }).from(fullPackageOrders),
      (fpRows) => {
        for (const row of fpRows) {
          addUrlArray(
            row.productImages as string[] | null,
            `full-packages/${row.id}/product`,
            "fullPackageOrders.productImages"
          );
          addUrl(
            row.purchaseInvoiceUrl,
            `full-packages/${row.id}/invoice.jpg`,
            "fullPackageOrders.purchaseInvoiceUrl"
          );
        }
      }
    );

    // ─── 5. invoices.pdfUrl ───
    await safeCollect(
      "invoices.pdfUrl",
      () =>
        db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            pdfUrl: invoices.pdfUrl,
          })
          .from(invoices)
          .where(isNotNull(invoices.pdfUrl)),
      (invoiceRows) => {
        for (const row of invoiceRows) {
          const name = row.invoiceNumber || "invoice-" + row.id;
          addUrl(row.pdfUrl, `invoices/${name}.pdf`, "invoices.pdfUrl");
        }
      }
    );

    // ─── 6. invoiceTemplates.logoUrl ───
    await safeCollect(
      "invoiceTemplates.logoUrl",
      () =>
        db
          .select({
            id: invoiceTemplates.id,
            name: invoiceTemplates.name,
            logoUrl: invoiceTemplates.logoUrl,
          })
          .from(invoiceTemplates)
          .where(isNotNull(invoiceTemplates.logoUrl)),
      (invoiceTplRows) => {
        for (const row of invoiceTplRows) {
          addUrl(row.logoUrl, `templates/invoice-logo-${row.id}.png`, "invoiceTemplates.logoUrl");
        }
      }
    );

    // ─── 7. packageQrCodes.qrImageUrl ───
    await safeCollect(
      "packageQrCodes.qrImageUrl",
      () =>
        db
          .select({
            id: packageQrCodes.id,
            packageId: packageQrCodes.packageId,
            qrImageUrl: packageQrCodes.qrImageUrl,
          })
          .from(packageQrCodes)
          .where(isNotNull(packageQrCodes.qrImageUrl)),
      (qrRows) => {
        for (const row of qrRows) {
          addUrl(
            row.qrImageUrl,
            `qr-codes/qr-${row.packageId ?? row.id}.png`,
            "packageQrCodes.qrImageUrl"
          );
        }
      }
    );

    // ─── 8. packageScans.photoUrl ───
    await safeCollect(
      "packageScans.photoUrl",
      () =>
        db
          .select({
            id: packageScans.id,
            trackingNumber: packageScans.trackingNumber,
            photoUrl: packageScans.photoUrl,
          })
          .from(packageScans)
          .where(isNotNull(packageScans.photoUrl)),
      (scanRows) => {
        for (const row of scanRows) {
          addUrl(
            row.photoUrl,
            `scans/${row.trackingNumber}-scan-${row.id}.jpg`,
            "packageScans.photoUrl"
          );
        }
      }
    );

    // ─── 9. customerMessages.attachmentUrl ───
    await safeCollect(
      "customerMessages.attachmentUrl",
      () =>
        db
          .select({
            id: customerMessages.id,
            attachmentUrl: customerMessages.attachmentUrl,
          })
          .from(customerMessages)
          .where(isNotNull(customerMessages.attachmentUrl)),
      (custMsgRows) => {
        for (const row of custMsgRows) {
          addUrl(row.attachmentUrl, `messages/attachment-${row.id}`, "customerMessages.attachmentUrl");
        }
      }
    );

    // ─── 10. chatMessages.attachmentUrl ───
    await safeCollect(
      "chatMessages.attachmentUrl",
      () =>
        db
          .select({
            id: chatMessages.id,
            attachmentUrl: chatMessages.attachmentUrl,
          })
          .from(chatMessages)
          .where(isNotNull(chatMessages.attachmentUrl)),
      (chatRows) => {
        for (const row of chatRows) {
          addUrl(row.attachmentUrl, `chat/attachment-${row.id}`, "chatMessages.attachmentUrl");
        }
      }
    );

    // ─── 11. labelTemplates.logoUrl ───
    await safeCollect(
      "labelTemplates.logoUrl",
      () =>
        db
          .select({ id: labelTemplates.id, logoUrl: labelTemplates.logoUrl })
          .from(labelTemplates)
          .where(isNotNull(labelTemplates.logoUrl)),
      (labelRows) => {
        for (const row of labelRows) {
          addUrl(row.logoUrl, `templates/label-logo-${row.id}.png`, "labelTemplates.logoUrl");
        }
      }
    );

    // ─── 12. stockCategories.image ───
    await safeCollect(
      "stockCategories.image",
      () =>
        db
          .select({ id: stockCategories.id, image: stockCategories.image })
          .from(stockCategories)
          .where(isNotNull(stockCategories.image)),
      (stockCatRows) => {
        for (const row of stockCatRows) {
          addUrl(row.image, `stock/category-${row.id}.jpg`, "stockCategories.image");
        }
      }
    );

    // ─── 13. stockProducts.images ───
    await safeCollect(
      "stockProducts.images",
      () =>
        db
          .select({ id: stockProducts.id, images: stockProducts.images })
          .from(stockProducts)
          .where(isNotNull(stockProducts.images)),
      (stockProdRows) => {
        for (const row of stockProdRows) {
          addUrlArray(
            row.images as string[] | null,
            `stock/product-${row.id}`,
            "stockProducts.images"
          );
        }
      }
    );

    // ─── 14. blogPosts.coverImageUrl ───
    await safeCollect(
      "blogPosts.coverImageUrl",
      () =>
        db
          .select({
            id: blogPosts.id,
            slug: blogPosts.slug,
            coverImageUrl: blogPosts.coverImageUrl,
          })
          .from(blogPosts)
          .where(isNotNull(blogPosts.coverImageUrl)),
      (blogRows) => {
        for (const row of blogRows) {
          addUrl(
            row.coverImageUrl,
            `blog/${row.slug || row.id}-cover.jpg`,
            "blogPosts.coverImageUrl"
          );
        }
      }
    );

    // ─── 15. systemSettings ───
    await safeCollect(
      "systemSettings",
      () =>
        db.select({
          settingKey: systemSettings.settingKey,
          settingValue: systemSettings.settingValue,
        }).from(systemSettings),
      (settingRows) => {
        for (const row of settingRows) {
          if (
            row.settingValue &&
            typeof row.settingValue === "string" &&
            (row.settingValue.startsWith("http") || row.settingValue.includes(".s3."))
          ) {
            addUrl(row.settingValue, `settings/${row.settingKey}`, "systemSettings.settingValue");
          }
        }
      }
    );

    // Deduplicate by URL
    const uniqueUrls = new Map<string, (typeof fileUrls)[0]>();
    for (const file of fileUrls) {
      if (!uniqueUrls.has(file.url)) {
        uniqueUrls.set(file.url, file);
      }
    }

    const result = Array.from(uniqueUrls.values());
    appLogger.info(
      "[File Collection] Complete! Found " + result.length + " unique files (" + fileUrls.length + " total references)"
    );

    return result;
  } catch (error) {
    appLogger.error("[File Collection] Error", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
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
    appLogger.error("[S3 Backup] Failed to estimate size", { error: error instanceof Error ? error.message : String(error) });
    return { fileCount: 0, estimatedSize: 0 };
  }
}
