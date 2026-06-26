/**
 * Dynamic PWA app-icon + manifest generation from the uploaded company logo.
 *
 * The icon a phone shows on its home screen comes from the web app manifest
 * (Android/Chrome) and the apple-touch-icon (iOS) — NOT from anything React
 * renders at runtime. Those were static files baked into the build, so
 * uploading a logo in Settings never changed the installed app icon.
 *
 * This module serves them live instead:
 *   • GET /app-icons/icon-:size.png  — the company logo, fetched from storage
 *     and resized with sharp into a square, aspect-preserved PNG of the
 *     requested size (small transparent margin so it isn't edge-to-edge).
 *   • GET /manifest.json             — a manifest whose icons point at the
 *     above when a logo is set (falls back to the bundled brand icons
 *     otherwise), plus the company name.
 *
 * Important OS caveat (documented for callers): an ALREADY-installed PWA
 * caches its icon at install time. Changing the logo updates new installs and
 * the browser tab, but existing home-screen installs only refresh after the
 * user removes and re-adds the app. That is an OS rule, not a server issue.
 */
import sharp from "sharp";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { appLogger } from "../utils/logger";

// Sizes we can render on demand. 192 + 512 are the PWA minimums; the rest
// cover Android density buckets, apple-touch (180), and the favicon (16/32).
const RENDERABLE_SIZES = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
// Sizes advertised in the manifest's icons array.
const MANIFEST_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const LOGO_TTL_MS = 60_000;
let logoCache: { url: string; bytes: Buffer; fetchedAt: number } | null = null;

async function getCompanyInfo(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await db.getSetting("company_info");
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readLogoUrl(info: Record<string, unknown> | null): string | null {
  const url = info?.logoUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

async function getLogoBytes(url: string): Promise<Buffer | null> {
  if (logoCache && logoCache.url === url && Date.now() - logoCache.fetchedAt < LOGO_TTL_MS) {
    return logoCache.bytes;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    logoCache = { url, bytes, fetchedAt: Date.now() };
    return bytes;
  } catch (err) {
    appLogger.warn("[appIcons] failed to fetch logo", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function renderIcon(bytes: Buffer, size: number): Promise<Buffer> {
  // Centre the logo on a transparent square with an 8% margin. fit:contain
  // preserves aspect ratio so non-square logos aren't distorted.
  const margin = Math.round(size * 0.08);
  const inner = Math.max(1, size - margin * 2);
  const resized = await sharp(bytes)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

// Small deterministic hash so the icon URLs change when the logo changes,
// busting browser/CDN caches (Math.random is avoided — must be stable).
function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function buildManifest(logoUrl: string | null, info: Record<string, unknown> | null) {
  const name = (info?.name as string) || "Wazn Express";
  const shortName = name.split(/\s+/)[0] || "Wazn";
  const icons = logoUrl
    ? MANIFEST_SIZES.map((size) => ({
        src: `/app-icons/icon-${size}.png?v=${hashString(logoUrl)}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any",
      }))
    : MANIFEST_SIZES.map((size) => ({
        src: `/icons/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "maskable any",
      }));

  return {
    name,
    short_name: shortName,
    description: "International Shipping & Logistics from China to Iraq",
    start_url: "/",
    display: "standalone",
    background_color: "#1e293b",
    theme_color: "#1e293b",
    orientation: "portrait-primary",
    scope: "/",
    lang: "ku",
    dir: "rtl",
    categories: ["business", "logistics", "shipping"],
    icons,
  };
}

export function registerAppIconRoutes(app: Express): void {
  app.get("/app-icons/icon-:size.png", async (req: Request, res: Response) => {
    const size = parseInt(req.params.size, 10);
    if (!RENDERABLE_SIZES.includes(size)) {
      res.status(404).end();
      return;
    }
    const url = readLogoUrl(await getCompanyInfo());
    if (!url) {
      res.status(404).end();
      return;
    }
    const bytes = await getLogoBytes(url);
    if (!bytes) {
      res.status(404).end();
      return;
    }
    try {
      const png = await renderIcon(bytes, size);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.end(png);
    } catch (err) {
      appLogger.warn("[appIcons] render failed", {
        size,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).end();
    }
  });

  app.get("/manifest.json", async (_req: Request, res: Response) => {
    try {
      const info = await getCompanyInfo();
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.json(buildManifest(readLogoUrl(info), info));
    } catch (err) {
      appLogger.warn("[appIcons] manifest failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).end();
    }
  });
}
