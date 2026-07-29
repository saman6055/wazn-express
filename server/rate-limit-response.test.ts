import { describe, it, expect } from "vitest";
import { buildThrottleBody } from "./middleware/rateLimiter";

/**
 * A throttled request used to answer with a bare `{ error: "..." }` body. The
 * tRPC client runs every response through superjson, which cannot read that
 * shape, so being rate-limited surfaced in the UI as
 * "Unable to transform response from server" — the production report. The
 * body must now match the envelope tRPC v11 + superjson expects:
 *   [{ error: { json: { message, data: { code, httpStatus } } } }]
 * (documented in client/src/main.tsx).
 */
const MSG = "Too many requests, please try again in a minute.";

describe("buildThrottleBody", () => {
  it("wraps a single tRPC call in the superjson error envelope", () => {
    const body = buildThrottleBody("/api/trpc/auth.staffLogin", false, MSG) as any;
    expect(body.error.json.message).toBe(MSG);
    expect(body.error.json.data.code).toBe("TOO_MANY_REQUESTS");
    expect(body.error.json.data.httpStatus).toBe(429);
  });

  it("returns one result per procedure for a batched call", () => {
    // httpBatchLink expects the array length to match the batch it sent.
    const body = buildThrottleBody("/api/trpc/a.one,b.two,c.three", true, MSG) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
    expect(body[2].error.json.data.code).toBe("TOO_MANY_REQUESTS");
  });

  it("returns a single-element array for a batch of one", () => {
    const body = buildThrottleBody("/api/trpc/auth.staffLogin", true, MSG) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("carries the message so the operator learns they were throttled", () => {
    const login = "Too many failed login attempts. Please wait a few minutes and try again.";
    const body = buildThrottleBody("/api/trpc/auth.staffLogin", true, login) as any[];
    expect(body[0].error.json.message).toBe(login);
  });

  it("keeps a plain body for non-tRPC routes", () => {
    expect(buildThrottleBody("/api/backup-file/3", false, MSG)).toEqual({ error: MSG });
    // Even if something odd sets batch=1 on a REST path.
    expect(buildThrottleBody("/uploads/x.png", true, MSG)).toEqual({ error: MSG });
  });

  it("still answers a bare /api/trpc batch with an array of one", () => {
    // No procedure names in the path, but the client asked for a batch, so the
    // reply must stay an array or httpBatchLink cannot match it up.
    const body = buildThrottleBody("/api/trpc", true, MSG) as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].error.json.data.httpStatus).toBe(429);
  });

  it("never emits the shape that could not be deserialized", () => {
    // The old body was `{ error: "<string>" }` — superjson chokes on it.
    const body = buildThrottleBody("/api/trpc/auth.staffLogin", true, MSG) as any[];
    expect(typeof body[0].error).toBe("object");
    expect(body[0].error).toHaveProperty("json");
  });
});
