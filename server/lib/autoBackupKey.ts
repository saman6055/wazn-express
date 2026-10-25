import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * The key the owner's own computer uses to take the daily backup.
 *
 * The owner, 2026-10-25: «خۆکار باشە بە خۆی لە ناو کۆمپیوتەری من ڕۆژانە
 * باکئەپ بکات، پاش ئەوەی هی ئەمڕۆ تەواو بوو هی دوێنێ بسڕێتەوە».
 *
 * A script that runs at night cannot type a password, and a password saved
 * in a file on a computer is the main admin's whole account waiting to be
 * copied. So the script gets a key that does one thing: make a complete
 * backup, fetch it, and delete the server's copy of a backup it made itself.
 * It cannot sign in, read a page, change a figure or restore anything.
 *
 * What it can do is still a lot — a backup is every table — so:
 *   - only its fingerprint (sha256) is stored; the key itself is shown once,
 *     to the main admin, when it is made;
 *   - making a new one ends the old one, and it can be switched off;
 *   - every use is in the audit log.
 */

export const AUTO_BACKUP_SETTING = "auto_backup_key";
const PREFIX = "wbk_";

export interface StoredAutoKey {
  hash: string;
  /** The first characters, so the owner can tell which key is current. */
  hint: string;
  createdAt: string;
  createdById: number;
  lastUsedAt?: string | null;
}

/** A new key: shown once, never stored. */
export function newAutoBackupKey(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

export function fingerprint(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function keyHint(key: string): string {
  return `${key.slice(0, PREFIX.length + 4)}…`;
}

/** The key a request carries, if it carries one of ours. */
export function keyFromHeader(header: unknown): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  // The scheme's name is case-insensitive in HTTP; the key itself is not touched.
  const m = /^Bearer\s+(wbk_[A-Za-z0-9_-]{40,60})$/i.exec(value.trim());
  return m ? m[1] : null;
}

/** Does this key match the stored fingerprint? Compared in constant time. */
export function keyMatches(key: string | null, stored: StoredAutoKey | null): boolean {
  if (!key || !stored?.hash || !/^[0-9a-f]{64}$/.test(stored.hash)) return false;
  const a = Buffer.from(fingerprint(key), "hex");
  const b = Buffer.from(stored.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseStoredKey(raw: string | null): StoredAutoKey | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StoredAutoKey;
    return v && typeof v.hash === "string" ? v : null;
  } catch {
    return null;
  }
}
