import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer, type Server } from "http";
import Jimp from "jimp";

vi.mock("./db", () => ({ getSetting: vi.fn() }));

import * as db from "./db";
import { registerAppIconRoutes } from "./services/appIcons.service";

/**
 * The home-screen icon — and whether the browser offers to install the app.
 *
 * With the company logo stored as a local upload, the icon route fetch()ed a
 * bare "/uploads/…" path, which fetch cannot do, so every icon the manifest
 * advertised answered 404 — and a manifest without one working icon is one
 * Chrome will not install. Then a redeploy took the logo file itself. These
 * tests pin both: our own upload is read from disk, and with nothing to
 * render from, the manifest points at the bundled brand icons.
 */

let tmpDir: string;
let server: Server;
let base: string;
const previous = process.env.UPLOADS_DIR;

const setLogo = (logoUrl: string | null) =>
  vi.mocked(db.getSetting).mockResolvedValue(
    JSON.stringify({ name: "Wazn Express", ...(logoUrl ? { logoUrl } : {}) }),
  );

const manifestIcons = async (): Promise<string[]> => {
  const manifest = await (await fetch(`${base}/manifest.json`)).json();
  return (manifest.icons as { src: string }[]).map((icon) => icon.src);
};

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wazn-icons-"));
  process.env.UPLOADS_DIR = tmpDir;
  // A black 40×20 bar stands in for the wordmark.
  const logo = await new Jimp(40, 20, 0x000000ff).getBufferAsync(Jimp.MIME_PNG);
  fs.writeFileSync(path.join(tmpDir, "logo-present.png"), logo);

  const app = express();
  registerAppIconRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("server did not bind");
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (previous === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previous;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("a logo stored as our own upload", () => {
  it("renders into a real icon, read from disk", async () => {
    setLogo("/uploads/logo-present.png");
    const res = await fetch(`${base}/app-icons/icon-192.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const icon = await Jimp.read(Buffer.from(await res.arrayBuffer()));
    expect([icon.bitmap.width, icon.bitmap.height]).toEqual([192, 192]);
    // A white tile with the mark in the middle — not a transparent square
    // that a black logo disappears into on a dark launcher.
    expect(icon.getPixelColor(0, 0)).toBe(0xffffffff);
    expect(icon.getPixelColor(96, 96)).toBe(0x000000ff);
  });

  it("is what the manifest advertises", async () => {
    setLogo("/uploads/logo-present.png");
    const icons = await manifestIcons();
    expect(icons.length).toBeGreaterThan(0);
    for (const src of icons) expect(src).toMatch(/^\/app-icons\/icon-\d+\.png\?v=/);
  });
});

describe("a logo whose file is gone, or no logo at all", () => {
  it("sends the manifest to the bundled brand icons", async () => {
    for (const logo of ["/uploads/P6kwp1Fivzn4.PNG", null]) {
      setLogo(logo);
      const icons = await manifestIcons();
      expect(icons.length, String(logo)).toBeGreaterThan(0);
      for (const src of icons) expect(src, String(logo)).toMatch(/^\/icons\/icon-\d+x\d+\.png$/);
    }
  });

  it("redirects an icon an older manifest still asks for to the bundled one", async () => {
    setLogo("/uploads/P6kwp1Fivzn4.PNG");
    const res = await fetch(`${base}/app-icons/icon-192.png`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/icons/icon-192x192.png");
  });
});
