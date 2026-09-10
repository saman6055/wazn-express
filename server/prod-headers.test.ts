import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * What the production server says about caching, content and missing things.
 * prod-entry.ts is what customers hit; the dev server is not.
 */
const PROD = fs.readFileSync(path.resolve(__dirname, "_core/prod-entry.ts"), "utf8");

const at = (token: string) => {
  const i = PROD.indexOf(token);
  expect(i, `missing: ${token}`).toBeGreaterThan(-1);
  return i;
};

describe("production caching", () => {
  it("no API answer is kept by a browser or a proxy", () => {
    at('app.use("/api", (_req, res, next) => {\n    res.setHeader("Cache-Control", "no-store");'.replace(/\n/g, PROD.includes("\r\n") ? "\r\n" : "\n"));
  });

  it("index.html is asked for every time; hashed build files are kept for a year", () => {
    at('if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");');
    at('"public, max-age=31536000, immutable"');
    const catchAll = at('app.use("*"');
    expect(PROD.slice(catchAll, catchAll + 160)).toContain('res.setHeader("Cache-Control", "no-cache")');
  });

  it("uploads are private to the browser that asked", () => {
    at('res.setHeader("Cache-Control", "private, max-age=604800")');
    expect(PROD).not.toContain('express.static(uploadsDir, { maxAge: "7d" })');
  });
});

describe("production answers for things that are not there", () => {
  it("an unknown /api address is a JSON 404, registered after every real API route", () => {
    const notFound = at('res.status(404).json({ error: "Not found" })');
    expect(at("createExpressMiddleware(")).toBeLessThan(notFound);
    expect(at("registerAppIconRoutes(app)")).toBeLessThan(notFound);
    expect(notFound).toBeLessThan(at("serveStatic(app);"));
  });

  it("a missing build file is a 404, never the page shell", () => {
    const missing = at('app.use("/assets", (_req, res) => {');
    expect(missing).toBeLessThan(at('app.use("*"'));
  });
});

describe("production security policy", () => {
  it("allows the tutorial player and photo previews, keeps scripts to 'self'", () => {
    at('"frame-src": ["\'self\'", "https://www.youtube.com", "https://www.youtube-nocookie.com"]');
    at('"img-src": ["\'self\'", "data:", "blob:", "https://i.ytimg.com", "https:"]');
    expect(PROD).not.toMatch(/script-src[^\n]*unsafe-inline/);
  });

  it("trusts exactly the configured number of proxy hops, before any rate limiter", () => {
    expect(at('app.set("trust proxy"')).toBeLessThan(at("app.use(globalLimiter)"));
    expect(PROD).not.toMatch(/app\.set\("trust proxy",\s*true\)/);
  });
});
