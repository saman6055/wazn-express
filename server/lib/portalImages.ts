/**
 * Photos in the portal's lists travel as short links, not as the photos.
 *
 * Order and parcel photos are stored as base64 data URIs — one is 200–330 KB
 * — and the portal's lists carry them. Five screens load those lists and poll
 * them every twenty seconds, so a customer with twenty orders was sent several
 * megabytes again and again to draw small thumbnails: the main reason the
 * portal felt slow on a phone (2026-10-30).
 *
 * In a list each data URI becomes `/api/portal/img/<o|p>/<id>/<hash>`. The
 * hash is of the photo itself, so the same photo is the same link wherever it
 * appears (dedupePhotos still counts it once) and a changed photo is a new
 * link. The browser fetches each photo once and keeps it; the poll carries
 * only text. A photo that is already a link (an upload) is left alone.
 *
 * The route answers only the signed-in customer who owns the order or parcel.
 */
import { createHash } from "node:crypto";
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { getDb } from "../db/connection";
import { fullPackageOrders } from "../../drizzle/schema";
import { packages } from "../../drizzle/schema";
import { appLogger } from "../utils/logger";

// Raster photos only: an SVG served from our own origin could carry script.
const DATA_IMAGE = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,/i;

export function photoHash(dataUri: string): string {
  return createHash("sha1").update(dataUri).digest("hex").slice(0, 16);
}

function link(kind: "o" | "p", id: unknown, value: unknown): unknown {
  if (typeof value !== "string" || !DATA_IMAGE.test(value)) return value;
  return `/api/portal/img/${kind}/${Number(id)}/${photoHash(value)}`;
}

function linkList(kind: "o" | "p", id: unknown, value: unknown): unknown {
  return Array.isArray(value) ? value.map((v) => link(kind, id, v)) : value;
}

/** An order row for a list: its product photo (and gallery, if any) as links. */
export function linkOrderPhotos<T extends Record<string, any>>(order: T): T {
  if (!order || typeof order !== "object") return order;
  const out: Record<string, any> = { ...order };
  if ("productImage" in out) out.productImage = link("o", out.id, out.productImage);
  if ("productImages" in out) out.productImages = linkList("o", out.id, out.productImages);
  return out as T;
}

/** A parcel row for a list: its photos as links. */
export function linkParcelPhotos<T extends Record<string, any>>(row: T): T {
  if (!row || typeof row !== "object" || !("photos" in row)) return row;
  return { ...row, photos: linkList("p", row.id, row.photos) } as T;
}

export function linkOrdersPhotos<T extends Record<string, any>>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).map(linkOrderPhotos);
}

export function linkParcelsPhotos<T extends Record<string, any>>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).map(linkParcelPhotos);
}

/** Which of these photos the link names, if any. */
export function findPhoto(candidates: unknown[], hash: string): string | null {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      const hit = findPhoto(c, hash);
      if (hit) return hit;
    } else if (typeof c === "string" && DATA_IMAGE.test(c) && photoHash(c) === hash) {
      return c;
    }
  }
  return null;
}

export function registerPortalImageRoute(app: Express): void {
  app.get("/api/portal/img/:kind/:id/:hash", async (req, res) => {
    try {
      const { kind, hash } = req.params;
      const id = Number(req.params.id);
      if ((kind !== "o" && kind !== "p") || !Number.isInteger(id) || id <= 0 || !/^[0-9a-f]{16}$/.test(hash)) {
        return res.status(404).end();
      }
      let user: { id: number; isCustomer?: boolean } | null = null;
      try {
        user = (await sdk.authenticateRequest(req)) as any;
      } catch {
        user = null;
      }
      if (!user || !user.isCustomer) return res.status(401).end();

      const db = await getDb();
      if (!db) return res.status(503).end();

      let candidates: unknown[] = [];
      if (kind === "o") {
        const [row] = await db
          .select({ customerId: fullPackageOrders.customerId, productImage: fullPackageOrders.productImage, productImages: fullPackageOrders.productImages })
          .from(fullPackageOrders)
          .where(eq(fullPackageOrders.id, id))
          .limit(1);
        // Someone else's order is "not here", never "forbidden": an id says nothing.
        if (!row || Number(row.customerId) !== Number(user.id)) return res.status(404).end();
        candidates = [row.productImage, row.productImages];
      } else {
        const [row] = await db
          .select({ customerId: packages.customerId, photos: packages.photos })
          .from(packages)
          .where(eq(packages.id, id))
          .limit(1);
        if (!row || Number(row.customerId) !== Number(user.id)) return res.status(404).end();
        candidates = [row.photos];
      }

      const photo = findPhoto(candidates, hash);
      if (!photo) return res.status(404).end();
      const m = DATA_IMAGE.exec(photo)!;
      const bytes = Buffer.from(photo.slice(m[0].length), "base64");
      res.setHeader("Content-Type", m[1].toLowerCase());
      // The link names the photo's content, so it never changes under it.
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).end(bytes);
    } catch (err) {
      appLogger.error("[Portal] photo could not be served", { error: err instanceof Error ? err.message : String(err) });
      try { res.status(500).end(); } catch { /* sent */ }
    }
  });
}
