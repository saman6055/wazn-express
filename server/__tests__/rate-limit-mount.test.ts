import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "http";
import { authLimiterMiddleware, requestPath, writeLimiterMiddleware } from "./middleware/rateLimiter";

/**
 * The login limiter has to fire where it is mounted.
 *
 * It is mounted with `app.use("/api/trpc", …)`, and inside a mount Express
 * strips the mount from `req.path`: a login arrives as `/auth.staffLogin`.
 * The limiter asked whether that started with `/api/trpc`, and the answer
 * was no, every time, for every request, since the day it was written. So
 * twenty wrong passwords a quarter-hour was the rule on paper and a thousand
 * requests a minute the rule in fact. This test mounts the real middleware
 * the real way and counts.
 */
describe("the login limiter fires under the /api/trpc mount", () => {
  let server: Server;
  let base = "";
  const seen: string[] = [];

  beforeAll(async () => {
    const app = express();
    app.use(
      "/api/trpc",
      (req, _res, next) => {
        seen.push(requestPath(req));
        next();
      },
      authLimiterMiddleware,
      writeLimiterMiddleware,
      (_req, res) => res.status(401).json({ error: "wrong password" }),
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterAll(() => server?.close());

  it("sees the full path the client sent, not the mount-relative one", async () => {
    await fetch(`${base}/api/trpc/auth.staffLogin?batch=1`, { method: "POST" });
    expect(seen[0]).toBe("/api/trpc/auth.staffLogin");
  });

  it("answers the twenty-first failed login with 429, in tRPC's own envelope", async () => {
    // One request already went above; the limiter counts failures (401s).
    let last = 0;
    let body: unknown = null;
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${base}/api/trpc/auth.staffLogin?batch=1`, { method: "POST" });
      last = res.status;
      body = await res.json();
      if (last === 429) break;
    }
    expect(last).toBe(429);
    expect(Array.isArray(body)).toBe(true);
    expect((body as { error: { json: { data: { code: string } } } }[])[0].error.json.data.code).toBe("TOO_MANY_REQUESTS");
  }, 20_000);
});
