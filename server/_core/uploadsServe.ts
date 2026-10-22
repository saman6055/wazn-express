import path from "path";
import express, { type Response } from "express";

type StaticOptions = NonNullable<Parameters<typeof express.static>[1]>;

/**
 * How a stored upload is handed back — the same from both server entries.
 *
 * Two things ride on these headers:
 *
 *  - Privacy. A photo is one person's business, so a shared proxy or CDN
 *    must not keep a copy for the next visitor; a customer's passport or
 *    ID card (marked by the document guard) is not kept at all, not even by
 *    the browser that asked.
 *
 *  - Inertness. The folder has held files for a year under whatever
 *    extension the uploader's name carried, and nothing on the way in asked
 *    what it was (shared/uploadRule does now). A page or an SVG with a script
 *    inside, opened from /uploads on the company's own address, would run
 *    that script as the signed-in member of staff who clicked it. So anything
 *    a browser could run as a document is served with a policy that lets it
 *    run nothing, and a page is handed over as a download rather than shown.
 *    Pictures and PDFs are untouched: the PDF viewer and <img> never see a
 *    difference.
 */

/** Served as a document by a browser, and so able to carry a script. */
const RUNNABLE = new Set([".html", ".htm", ".xhtml", ".svg", ".xml", ".js", ".mjs", ".cjs"]);

/** Runs nothing, loads nothing, reaches nothing. */
export const INERT_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export function uploadHeaders(res: Response, filePath: string): void {
  res.setHeader("Cache-Control", res.locals?.customerDocument ? "private, no-store" : "private, max-age=604800");
  const ext = path.extname(filePath).toLowerCase();
  if (RUNNABLE.has(ext)) {
    res.setHeader("Content-Security-Policy", INERT_POLICY);
    // An SVG may still be drawn inside <img>, where no script runs anyway.
    // Everything else runnable is a file to save, never a page to open.
    if (ext !== ".svg") res.setHeader("Content-Disposition", "attachment");
  }
}

export const uploadsStaticOptions: StaticOptions = {
  setHeaders: uploadHeaders,
};
