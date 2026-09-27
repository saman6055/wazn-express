/**
 * What a file sent in the staff chat may be (owner, 2026-09-27: attach,
 * screenshots, pasted pictures). One home for the server's check and the
 * chat's own, so they cannot disagree.
 */

/** 10 MB: a phone photo or a full-screen screenshot, not a video. */
export const STAFF_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const SENDABLE_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "ppt", "pptx", "zip", "rar", "7z",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "heic",
];

/**
 * Pictures, PDFs, office documents, text and archives. Anything a browser
 * would run (html, svg, js) is refused — the stored copy is served from our
 * own address.
 */
export function staffAttachmentAllowed(type: string, name: string): boolean {
  const t = String(type ?? "").toLowerCase();
  const ext = (String(name ?? "").split(".").pop() ?? "").toLowerCase();
  if (t === "image/svg+xml" || t.includes("html") || t.includes("javascript")) return false;
  if (["svg", "html", "htm", "js", "mjs", "xhtml"].includes(ext)) return false;
  if (/^image\/(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(t)) return true;
  return SENDABLE_EXTENSIONS.includes(ext);
}
