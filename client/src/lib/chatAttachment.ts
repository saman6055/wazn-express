/**
 * Files for the staff chat: a picture pasted with Ctrl+V, a screenshot taken
 * from the chat itself, a file picked or dropped (owner, 2026-09-27).
 *
 * The server keeps the file where it keeps every upload and refuses anything
 * a browser would run; this side only makes pictures light enough to travel.
 */

import { STAFF_ATTACHMENT_MAX_BYTES } from "@shared/staffChatAttachment";

/** The server's own limit (shared/staffChatAttachment). */
export const CHAT_ATTACHMENT_MAX_BYTES = STAFF_ATTACHMENT_MAX_BYTES;

export function isImageType(type: string | null | undefined): boolean {
  return /^image\/(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(String(type ?? ""));
}

/** Longest side a picture keeps. A 4K screenshot reads fine at this size. */
const MAX_SIDE = 2560;
/** Below this a picture is sent exactly as it is — a screenshot stays sharp PNG. */
const LEAVE_ALONE_BYTES = 1.5 * 1024 * 1024;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The picture could not be read."));
    };
    img.src = url;
  });
}

/**
 * A lighter copy of a big picture: at most 2560px on its longest side, as a
 * JPEG. Small pictures, GIFs (which would lose their movement) and anything
 * the browser cannot draw are returned untouched.
 */
export async function shrinkImage(blob: Blob): Promise<Blob> {
  if (blob.size <= LEAVE_ALONE_BYTES || /gif|heic|heif/i.test(blob.type)) return blob;
  try {
    const img = await loadImage(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    // JPEG has no transparency: a white page under it rather than black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}

/** The file as base64 without its data: prefix — what the send call carries. */
export function fileToBase64(blob: Blob): Promise<string> {
  if (blob.size > CHAT_ATTACHMENT_MAX_BYTES) {
    return Promise.reject(
      new Error("فایلەکە لە 10 MB گەورەترە. تەنها بەشێکی شاشەکە بگرە (Win+Shift+S) یان فایلەکە بکە بە ZIP."),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(blob);
  });
}

/** Whether this browser can take a screenshot itself (desktop Chrome, Edge, Firefox). */
export function canCaptureScreen(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/**
 * One still of a screen, window or tab the person picks in the browser's own
 * "share" window, as a PNG. The capture stops the moment the frame is taken.
 */
export async function captureScreen(): Promise<Blob | null> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // One frame for the picture to settle after the picker closes.
    await new Promise((r) => setTimeout(r, 250));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}
