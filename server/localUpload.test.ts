import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer, type Server } from 'http';
import { localUpload, getUploadsDir, UPLOADS_ROUTE } from './services/localUpload';

/**
 * The contract that broke: whatever URL localUpload hands back must actually
 * serve the bytes it just wrote.
 *
 * Production never mounted the uploads route — only the dev server did. So a
 * photo taken at the China warehouse uploaded fine, its URL was saved on the
 * package, and fetching that URL fell through to the SPA catch-all and
 * returned index.html. The <img> rendered nothing, which looked exactly like
 * the photo had never been attached in the first place.
 *
 * These tests build the same two routes production builds, in the same order,
 * and go through a real HTTP request — so route ordering is exercised rather
 * than assumed.
 */

let tmpDir: string;
let server: Server;
let baseUrl: string;
const previousUploadsDir = process.env.UPLOADS_DIR;

const SPA_MARKER = '<!doctype html><title>spa fallback</title>';

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wazn-uploads-'));
  process.env.UPLOADS_DIR = tmpDir;

  const app = express();
  // Exactly what serveStatic() registers, in the same order.
  app.use(UPLOADS_ROUTE, express.static(getUploadsDir()));
  app.use('*', (_req, res) => res.type('html').send(SPA_MARKER));

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('server did not bind');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previousUploadsDir;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// A one-pixel JPEG is enough: this is about bytes surviving the round trip.
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

describe('localUpload — the URL it returns must actually serve the file', () => {
  it('serves back the exact bytes that were uploaded', async () => {
    const { url } = localUpload('parcel-photo.jpg', JPEG_BYTES, 'image/jpeg');

    const res = await fetch(`${baseUrl}${url}`);

    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(JPEG_BYTES)).toBe(true);
  });

  it('does not hand back the SPA shell in place of the image', async () => {
    // This is the failure that made photos look like they were never added:
    // status 200, but HTML where an image should be.
    const { url } = localUpload('parcel-photo.jpg', JPEG_BYTES, 'image/jpeg');

    const res = await fetch(`${baseUrl}${url}`);

    expect(res.headers.get('content-type')).toMatch(/image\/jpe?g/);
    expect(await res.clone().text()).not.toContain('spa fallback');
  });

  it('writes into UPLOADS_DIR so a mounted volume actually receives the file', async () => {
    // Without this the file lands inside the container and is wiped on the
    // next redeploy, taking every photo with it.
    const { url } = localUpload('parcel-photo.jpg', JPEG_BYTES, 'image/jpeg');

    const name = url.split('/').pop()!;
    expect(fs.existsSync(path.join(tmpDir, name))).toBe(true);
  });

  it('gives every upload its own name so two photos never collide', () => {
    const a = localUpload('photo.jpg', JPEG_BYTES, 'image/jpeg');
    const b = localUpload('photo.jpg', JPEG_BYTES, 'image/jpeg');

    expect(a.url).not.toBe(b.url);
  });

  it('keeps the file extension so the browser gets the right content type', () => {
    expect(localUpload('scan.png', JPEG_BYTES).url).toMatch(/\.png$/);
    expect(localUpload('no-extension', JPEG_BYTES).url).toMatch(/\.jpg$/);
  });

  it('serves the URL under the same route the server mounts', () => {
    expect(localUpload('photo.jpg', JPEG_BYTES).url.startsWith(`${UPLOADS_ROUTE}/`)).toBe(true);
  });

  it('still falls through to the SPA for a path that is not an upload', async () => {
    const res = await fetch(`${baseUrl}/packages/all`);

    expect(await res.text()).toContain('spa fallback');
  });

  it('does not serve a file that was never uploaded', async () => {
    const res = await fetch(`${baseUrl}${UPLOADS_ROUTE}/does-not-exist.jpg`);

    // Falls through to the SPA rather than exposing the directory.
    expect(await res.text()).toContain('spa fallback');
  });
});
