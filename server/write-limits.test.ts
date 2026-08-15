import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { writeLimiterMiddleware } from "./middleware/rateLimiter";

/**
 * The write limiters were written and never mounted, for a good reason: keyed
 * per IP they would have throttled the office rather than an abuser, because
 * everybody there shares one public address. Keyed per session they are safe
 * to switch on.
 *
 * What has to hold now is that they apply to the right requests. A limiter on
 * the wrong path is worse than none: it blocks staff doing their job, and the
 * message tells them they have made too many changes when they have made two.
 *
 * The limiter itself is express-rate-limit's; what is tested here is the
 * routing decision in front of it — which requests reach a limiter at all.
 */

function request(method: string, path: string): Request {
  return { method, path, headers: {}, ip: "1.2.3.4", query: {} } as unknown as Request;
}

const response = () =>
  ({ status: () => ({ json: () => undefined, end: () => undefined }), setHeader: () => undefined }) as unknown as Response;

/** Did the request pass straight through, untouched by any limiter? */
function passesThrough(method: string, path: string): boolean {
  const next = vi.fn() as unknown as NextFunction;
  writeLimiterMiddleware(request(method, path), response(), next);
  // A limiter calls next() asynchronously through its own store; passing
  // through calls it synchronously and immediately.
  return (next as unknown as { mock: { calls: unknown[] } }).mock.calls.length === 1;
}

describe("reads are never limited", () => {
  it("lets a query through", () => {
    // tRPC sends queries as GET. A dashboard polling a dozen read endpoints
    // every few seconds must not spend a write allowance.
    expect(passesThrough("GET", "/api/trpc/dashboard.financialStats")).toBe(true);
    expect(passesThrough("GET", "/api/trpc/packages.list,customers.list")).toBe(true);
  });

  it("ignores anything that is not tRPC", () => {
    expect(passesThrough("POST", "/api/run-migration")).toBe(true);
    expect(passesThrough("POST", "/uploads/photo.jpg")).toBe(true);
  });
});

describe("login is left to its own limiter", () => {
  it("does not spend a write allowance as well", () => {
    // Both would mean a failed login costing two allowances, and the strict
    // auth limiter is the one that matters there.
    expect(passesThrough("POST", "/api/trpc/auth.staffLogin")).toBe(true);
    expect(passesThrough("POST", "/api/trpc/auth.customerLogin")).toBe(true);
  });
});

describe("writes are limited", () => {
  it("counts an ordinary mutation", () => {
    expect(passesThrough("POST", "/api/trpc/packages.create")).toBe(false);
    expect(passesThrough("POST", "/api/trpc/batches.updateStatus")).toBe(false);
  });

  it("counts a batched mutation", () => {
    expect(passesThrough("POST", "/api/trpc/packages.create,packages.update")).toBe(false);
  });
});

describe("uploads are counted separately", () => {
  it("routes anything carrying a file to the upload limiter", () => {
    // Not directly observable from the outside — both limiters call next() —
    // so what is asserted is that these are limited at all. The split matters
    // because an upload is a photo and a mutation is a row.
    for (const path of [
      "/api/trpc/storage.upload",
      "/api/trpc/customerPortal.setMyPhoto",
      "/api/trpc/customers.uploadDocument",
      "/api/trpc/backup.createBackup",
    ]) {
      expect(passesThrough("POST", path), path).toBe(false);
    }
  });
});
