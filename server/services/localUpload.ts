import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { localUploadFileName } from "../lib/photoUrls";

const UPLOADS_DIR = "uploads";

/** URL prefix these files are served under. Must match the static route. */
export const UPLOADS_ROUTE = "/uploads";

/**
 * Where uploaded files live on disk.
 *
 * Override with UPLOADS_DIR to point at a mounted volume. Inside a container
 * the default sits on the container's own filesystem, which is rebuilt on
 * every deploy — so without a volume every photo taken at the China warehouse
 * is gone the next time the app is redeployed.
 */
export function getUploadsDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), UPLOADS_DIR);
}

/**
 * Save file to local disk and return public URL.
 * Used when Forge storage is not configured.
 */
export function localUpload(
  fileName: string,
  data: Buffer,
  _contentType?: string
): { key: string; url: string } {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const ext = path.extname(fileName) || ".jpg";
  const uniqueName = `${nanoid(12)}${ext}`;
  const absolutePath = path.join(dir, uniqueName);
  fs.writeFileSync(absolutePath, data);
  const url = `${UPLOADS_ROUTE}/${uniqueName}`;
  return { key: path.join(UPLOADS_DIR, uniqueName), url };
}

/**
 * True only when `url` names a file in our own uploads folder and that file is
 * not there — a logo or photo a redeploy took with it. Object storage, inline
 * images and unknown paths are never reported missing: a file absent from
 * this disk proves nothing about them.
 */
export function localUploadIsMissing(url: unknown): boolean {
  const name = localUploadFileName(url);
  return name !== null && !fs.existsSync(path.join(getUploadsDir(), name));
}
