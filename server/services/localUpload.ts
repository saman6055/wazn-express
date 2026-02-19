import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const UPLOADS_DIR = "uploads";

/**
 * Save file to local disk (project root / uploads) and return public URL.
 * Used when Forge storage is not configured.
 */
export function localUpload(
  fileName: string,
  data: Buffer,
  _contentType?: string
): { key: string; url: string } {
  const dir = path.join(process.cwd(), UPLOADS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const ext = path.extname(fileName) || ".jpg";
  const uniqueName = `${nanoid(12)}${ext}`;
  const key = path.join(UPLOADS_DIR, uniqueName);
  const absolutePath = path.join(process.cwd(), key);
  fs.writeFileSync(absolutePath, data);
  const url = `/${UPLOADS_DIR}/${uniqueName}`;
  return { key, url };
}
