import { storageGet, storagePut } from "./storage.service";
import { appLogger } from "../utils/logger";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import AdmZip from "adm-zip";

const streamPipeline = promisify(pipeline);

/**
 * Download a file from URL to local path
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const protocol = url.startsWith("https") ? https : http;
  
  return new Promise((resolve, reject) => {
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(destPath);
        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve();
        });
        fileStream.on("error", reject);
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on("error", reject);
  });
}

/**
 * Restore S3 files from a ZIP backup
 * @param filesZipUrl - URL to the ZIP file containing S3 files
 * @returns Number of files restored
 */
export async function restoreS3Files(filesZipUrl: string): Promise<number> {
  const tempDir = "/tmp/s3-restore-" + Date.now();
  const zipPath = path.join(tempDir, "files.zip");
  
  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    appLogger.info("[S3 Restore] Downloading ZIP from", { filesZipUrl });
    
    // Download ZIP file
    await downloadFile(filesZipUrl, zipPath);
    
    appLogger.info("[S3 Restore] Extracting ZIP...");
    
    // Extract ZIP
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    
    let restoredCount = 0;
    
    // Upload each file back to S3
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const fileData = entry.getData();
        const fileName = entry.entryName;
        
        appLogger.info("[S3 Restore] Uploading", { fileName });
        
        // Determine content type from file extension
        const ext = path.extname(fileName).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".png") contentType = "image/png";
        else if (ext === ".pdf") contentType = "application/pdf";
        else if (ext === ".zip") contentType = "application/zip";
        
        // Upload to S3
        await storagePut(fileName, fileData, contentType);
        restoredCount++;
      }
    }
    
    appLogger.info("[S3 Restore] Restored files", { restoredCount });
    
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return restoredCount;
    
  } catch (error) {
    appLogger.error("[S3 Restore] Error", { error: error instanceof Error ? error.message : String(error) });
    
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    throw error;
  }
}
