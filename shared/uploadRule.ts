import { STAFF_ATTACHMENT_MAX_BYTES, staffAttachmentAllowed } from "./staffChatAttachment";

/**
 * What a file sent to the server may be — one rule for every door.
 *
 * Five procedures took a file as base64 and a name, and four of them asked
 * nothing about either: the name's extension became the file's extension on
 * disk, and the disk is served under /uploads to anyone with the link. So a
 * customer could send `notes.html` through the messenger, and the office
 * would open a page on the company's own address with whatever script the
 * file carried — running with the staff session that opened it. The staff
 * chat alone had a rule (staffChatAttachment); it is the rule now, here, and
 * the guard test holds every door to it.
 *
 * Nothing changed for a real upload: photos, PDFs, office files and archives
 * all pass. What is refused is what a browser would run — html, svg, js —
 * and anything over the size a phone photo or a screenshot reaches.
 */

/** 10 MB, the staff chat's ceiling: a phone photo or a screenshot, not a video. */
export const UPLOAD_MAX_BYTES = STAFF_ATTACHMENT_MAX_BYTES;

/** What a door accepts: pictures only, or pictures and documents. */
export type UploadPurpose = "image" | "file";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "heif"];

/** Never, under any name or type: a browser runs these. */
const RUNNABLE_EXTENSIONS = ["html", "htm", "xhtml", "svg", "xml", "js", "mjs", "cjs", "php", "shtml"];

/**
 * The extension a stored file gets: lower case, letters and digits, short.
 *
 * Empty when the name carries none worth keeping — the caller then picks a
 * default — and empty, too, for anything runnable, so a file that slips past
 * a door is still stored as something no browser will open as a page.
 */
export function safeUploadExtension(fileName: unknown): string {
  const name = typeof fileName === "string" ? fileName.trim() : "";
  const dot = name.lastIndexOf(".");
  if (dot === -1 || dot === name.length - 1) return "";
  const ext = name.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return "";
  if (RUNNABLE_EXTENSIONS.includes(ext)) return "";
  return ext;
}

export interface UploadCheck {
  fileName: unknown;
  contentType?: unknown;
  /** Decoded size — what will actually be written, not the base64 length. */
  bytes: number;
  purpose: UploadPurpose;
}

export type UploadRefusal = "empty" | "too_large" | "not_an_image" | "not_allowed";

/**
 * Why this file may not be stored, or null when it may.
 *
 * Purpose "image" wants a picture by extension and, when a type is given, by
 * type too. Purpose "file" is the staff chat's list: pictures, PDFs, office
 * documents, text and archives. Both refuse anything runnable first.
 */
export function uploadRefusal(input: UploadCheck): UploadRefusal | null {
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) return "empty";
  if (input.bytes > UPLOAD_MAX_BYTES) return "too_large";

  const name = typeof input.fileName === "string" ? input.fileName : "";
  const type = typeof input.contentType === "string" ? input.contentType.toLowerCase().trim() : "";
  const ext = safeUploadExtension(name);
  if (!ext) return "not_allowed";
  // Exact on xml: an Excel file's type is "…openxmlformats…", and it is fine.
  const runnableType =
    type === "image/svg+xml" || type === "text/xml" || type === "application/xml" || type.endsWith("+xml") ||
    type.includes("html") || type.includes("javascript");
  if (runnableType) return "not_allowed";

  if (input.purpose === "image") {
    if (!IMAGE_EXTENSIONS.includes(ext)) return "not_an_image";
    if (type && !type.startsWith("image/")) return "not_an_image";
    return null;
  }

  return staffAttachmentAllowed(type, name) ? null : "not_allowed";
}

/** How many bytes a base64 string decodes to, without decoding it. */
export function base64Bytes(base64: unknown): number {
  if (typeof base64 !== "string") return 0;
  const body = base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!body) return 0;
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
  return Math.floor((body.length * 3) / 4) - padding;
}

/**
 * Is this a link to a file we stored — and nothing else?
 *
 * A message's attachment is a link the sender typed as far as the server
 * knows, and two things later trust it: the office's screen, which puts it
 * in an <a href>, and the backup job, which fetches it from the server to
 * keep a copy. So a `javascript:` link, or an address inside the server's
 * own network, is refused at the door: either a path into our uploads
 * folder, or an https address with a real host name.
 */
export function isStoredFileUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000) return false;
  if (/^\/uploads\/[A-Za-z0-9_-]+(\.[a-z0-9]{1,8})?$/i.test(value)) return true;
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    // A name with a dot in it, not an address or a machine on our own network.
    if (!host.includes(".")) return false;
    if (/^[\d.]+$/.test(host) || host.includes(":") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}

/** The sentence the person sees, with what to do about it (shared/fixAdvice wraps it). */
export const UPLOAD_REFUSAL_TEXT: Record<UploadRefusal, { message: string; fix: string[] }> = {
  empty: {
    message: "فایلەکە بەتاڵە.",
    fix: ["فایلەکە دووبارە هەڵبژێرە"],
  },
  too_large: {
    message: "فایلەکە لە 10 MB گەورەترە.",
    fix: ["وێنەکە بچووکتر بکەرەوە یان تەنها بەشێکی شاشەکە بگرە", "فایلی گەورە بکە بە ZIP"],
  },
  not_an_image: {
    message: "تەنها وێنە لێرە وەردەگیرێت (JPG، PNG، WEBP، GIF).",
    fix: ["وێنەیەک هەڵبژێرە، نەک فایلێکی تر"],
  },
  not_allowed: {
    message: "ئەم جۆرە فایلە وەرناگیرێت.",
    fix: ["وێنە، PDF، فایلی ئۆفیس یان ZIP بنێرە", "ئەگەر پێویستە، فایلەکە بکە بە PDF یان ZIP پاشان بینێرەوە"],
  },
};
