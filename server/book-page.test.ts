import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import express from "express";
import { createServer, type Server } from "http";

/**
 * waznexpress.com/book — the booklet, for a phone.
 *
 * It is a plain static page under client/public, so it is served by the same
 * express.static that serves the app build. Two things about it can break
 * silently, and both are checked here:
 *
 *   1. Production runs no inline script (helmet, script-src 'self'). A
 *      <script> with code in it, or an onclick=, works perfectly on a laptop
 *      with the dev server and is refused in production — the language
 *      switch and the share button would simply stop.
 *   2. Everything it names — the two PDFs, the fonts, the pictures — has to
 *      be on disk, because nothing imports them. A renamed asset is a broken
 *      page that no build step complains about.
 */
const BOOK = path.resolve(import.meta.dirname, "..", "client", "public", "book");
const html = fs.readFileSync(path.join(BOOK, "index.html"), "utf8");

describe("the book page", () => {
  it("runs no inline script — production would refuse it", () => {
    const scripts = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    for (const tag of scripts) {
      const open = tag.slice(0, tag.indexOf(">") + 1);
      const body = tag.slice(open.length, tag.lastIndexOf("<"));
      expect(open, `inline <script> body: ${body.trim().slice(0, 60)}`).toMatch(/\ssrc=/);
      expect(body.trim()).toBe("");
    }
    expect(html, "inline event handler").not.toMatch(/\son[a-z]+\s*=\s*["']/i);
  });

  it("keeps its behaviour in book.js", () => {
    expect(html).toContain('<script src="book.js"></script>');
    const js = fs.readFileSync(path.join(BOOK, "book.js"), "utf8");
    expect(js).toContain("lang-ku");          // the language switch
    expect(js).toContain("navigator.share");  // the share button
    expect(js).toContain("contextmenu");      // copying stays off
  });

  it("has every file it points at", () => {
    const refs = [...html.matchAll(/(?:src|href)="(?!https?:|tel:|mailto:|#|\/)([^"]+)"/g)]
      .map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of new Set(refs)) {
      expect(fs.existsSync(path.join(BOOK, ref)), `missing ${ref}`).toBe(true);
    }
  });

  it("offers both booklets, and they are real PDFs of a readable size", () => {
    for (const name of ["wazn-booklet-ar.pdf", "wazn-booklet-ku.pdf"]) {
      const file = path.join(BOOK, name);
      const head = fs.readFileSync(file).subarray(0, 5).toString("latin1");
      expect(head, `${name} is not a PDF`).toBe("%PDF-");
      expect(fs.statSync(file).size).toBeGreaterThan(100_000);
    }
  });

  it("says the same thing in both languages — no half-translated block", () => {
    const ar = (html.match(/<span class="ar">/g) ?? []).length;
    const ku = (html.match(/<span class="ku">/g) ?? []).length;
    expect(ar).toBe(ku);
    expect(ar).toBeGreaterThan(40);
  });

  it("has no id twice — a glyph and a section once shared one", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const seen = new Set<string>();
    const twice = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(twice, `duplicate id(s): ${twice.join(", ")}`).toEqual([]);
  });

  it("can put the portal on a phone's home screen", () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.json">');
    expect(html).toMatch(/<section id="install"/);
    const js = fs.readFileSync(path.join(BOOK, "book.js"), "utf8");
    // Chrome hands the page a prompt; Safari never does and is told by hand.
    expect(js).toContain("beforeinstallprompt");
    expect(js).toContain("display-mode: standalone");
    // and it will not offer at all without a worker that answers fetches
    expect(js).toContain('navigator.serviceWorker.register("/sw.js")');
    expect(fs.existsSync(path.resolve(BOOK, "..", "sw.js"))).toBe(true);
  });

  it("opens the portal demo, which needs no account", () => {
    expect(html).toContain('href="/portal?demo=1"');
  });

  it("carries a landscape picture for the WhatsApp preview", () => {
    expect(html).toMatch(/property="og:image" content="https:\/\/waznexpress\.com\/book\/assets\/share\.jpg"/);
    expect(fs.existsSync(path.join(BOOK, "assets", "share.jpg"))).toBe(true);
  });
});

/**
 * waznexpress.com/book is the address on the printed card, with no trailing
 * slash. It has to reach the page and not the app shell — the SPA catch-all
 * answers everything static does not, so if the directory were not served
 * the customer would land in the portal login with no idea why.
 */
describe("the /book address", () => {
  const PUBLIC = path.resolve(import.meta.dirname, "..", "client", "public");
  const SPA = "<!doctype html><title>spa fallback</title>";
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.static(PUBLIC));          // as serveStatic() registers it
    app.use("*", (_req, res) => res.type("html").send(SPA));
    server = createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("server did not bind");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    // fetch keeps its socket alive, and close() waits for it.
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("sends /book on to /book/", async () => {
    const res = await fetch(`${base}/book`, { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toMatch(/\/book\/$/);
  });

  it("serves the page itself, not the app shell", async () => {
    const res = await fetch(`${base}/book/`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).not.toContain(SPA);
    expect(body).toContain('<script src="book.js"></script>');
  });

  it("hands over the booklet as a PDF", async () => {
    const res = await fetch(`${base}/book/wazn-booklet-ar.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
  });
});
