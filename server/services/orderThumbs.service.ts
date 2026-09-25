import Jimp from "jimp";
import { appLogger } from "../utils/logger";

/**
 * A product photo, small enough to put in a list.
 *
 * The owner, 2026-09-25: "the buy-at-cost table loads very heavily."
 *
 * It did. The list drew a forty-pixel thumbnail for each row — and to draw
 * it, shipped the whole photo. Product images are stored as base64 data URIs
 * in a MEDIUMTEXT column, compressed to a megabyte at 1200px on the way in,
 * which is right for the picture somebody opens and absurd for a square the
 * size of a fingernail. Three hundred orders was hundreds of megabytes over
 * the wire before the first row appeared.
 *
 * So the list no longer carries images at all, and asks for these instead:
 * 96px JPEGs, a few kilobytes each, made once and remembered. The whole
 * visible page of a table costs less than one of the old rows.
 */

/** 96px: twice the 40px the tables draw, so it stays sharp on a dense screen. */
const THUMB_PX = 96;
const THUMB_QUALITY = 70;

/**
 * Remembered by order id and the row's own updatedAt, so a replaced photo
 * makes a new thumbnail and an unchanged one is never resized twice.
 *
 * Bounded, and oldest-out: a warehouse screen left open all day must not
 * grow the server's memory by one image per order ever looked at.
 */
const MAX_CACHED = 500;
const cache = new Map<string, string>();

function remember(key: string, value: string): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** The first picture an order has, whichever column it is in. */
export function firstImageOf(order: {
  productImage?: string | null;
  productImages?: unknown;
}): string | null {
  const many = order.productImages;
  if (Array.isArray(many)) {
    const first = many.find((x) => typeof x === "string" && x.trim().length > 0);
    if (typeof first === "string") return first;
  }
  const one = (order.productImage ?? "").trim();
  return one.length > 0 ? one : null;
}

const DATA_URI = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

/**
 * One thumbnail, as a data URI, or null when there is no usable picture.
 *
 * Never throws: a corrupt or unreadable image is a missing thumbnail, not a
 * failed screen. The list falls back to its placeholder.
 */
export async function thumbnailFor(
  key: string,
  source: string | null | undefined,
): Promise<string | null> {
  if (!source) return null;
  const cached = cache.get(key);
  if (cached !== undefined) return cached || null;

  try {
    const match = DATA_URI.exec(source.trim());
    // A URL rather than a data URI needs no shrinking — it is already a
    // reference, and the browser fetches it itself.
    if (!match) {
      const passthrough = source.trim().startsWith("http") || source.trim().startsWith("/") ? source.trim() : "";
      remember(key, passthrough);
      return passthrough || null;
    }
    const image = await Jimp.read(Buffer.from(match[2]!, "base64"));
    // Inside a square, not cropped to it: the list shows what the thing is.
    image.scaleToFit(THUMB_PX, THUMB_PX).quality(THUMB_QUALITY);
    const out = await image.getBase64Async(Jimp.MIME_JPEG);
    remember(key, out);
    return out;
  } catch (err) {
    appLogger.warn("[Thumbs] could not shrink a product image", { key, err: String(err) });
    // Remembered as "none", so a broken picture is not re-decoded on every
    // scroll of the list it sits in.
    remember(key, "");
    return null;
  }
}

export interface ThumbSource {
  id: number;
  updatedAt?: Date | string | null;
  productImage?: string | null;
  productImages?: unknown;
}

/** Thumbnails for a page of rows, in one pass. */
export async function thumbnailsFor(rows: ThumbSource[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  for (const row of rows) {
    const stamp = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    const thumb = await thumbnailFor(`${row.id}:${stamp}`, firstImageOf(row));
    if (thumb) out[row.id] = thumb;
  }
  return out;
}

/** For the tests, and for a deploy that wants to start clean. */
export function clearThumbnailCache(): void {
  cache.clear();
}
