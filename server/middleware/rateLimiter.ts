import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV === "development";

/**
 * A throttled request used to answer with a bare `{ error: "..." }` body. The
 * tRPC client runs every response through superjson, which cannot read that
 * shape, so a 429 surfaced in the UI as the opaque
 * "Unable to transform response from server" — with no hint that the caller
 * had simply been rate-limited.
 *
 * For /api/trpc we now answer in tRPC's own error envelope so the client
 * deserializes it normally and shows the real message. Everything else keeps
 * the plain JSON body.
 *
 * httpBatchLink expects one result per batched procedure, so the reply is an
 * array of the right length when `?batch=1` is set.
 */
export function buildThrottleBody(path: string, isBatch: boolean, message: string): unknown {
  if (!path.startsWith("/api/trpc")) return { error: message };

  const envelope = {
    error: {
      json: {
        message,
        code: -32029, // JSON-RPC code tRPC maps to TOO_MANY_REQUESTS
        data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
      },
    },
  };

  const procedures = path.replace(/^\/api\/trpc\/?/, "").trim();
  const count = isBatch && procedures ? procedures.split(",").length : 1;
  return isBatch ? Array.from({ length: count }, () => envelope) : envelope;
}

function throttledHandler(message: string) {
  return (req: Request, res: Response): void => {
    res.status(429).json(buildThrottleBody(req.path, req.query.batch === "1", message));
  };
}

/**
 * Global: per-IP request ceiling. Generous on purpose — the dashboard is a
 * polling SPA and a whole office usually shares one public IP through NAT, so
 * a tight limit locked out real staff rather than abusers.
 * Requires `app.set("trust proxy", 1)`; without it every user shares one bucket.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many requests, please try again in a minute."),
});

/**
 * Login: brute-force protection. Only FAILED attempts count
 * (skipSuccessfulRequests), so a shared office IP can't lock itself out just
 * by having several people sign in normally.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many failed login attempts. Please wait a few minutes and try again."),
});

/** Data mutation routes: per-IP ceiling for writes. */
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many changes at once, please try again in a minute."),
});

/** File upload routes: per-IP ceiling for uploads. */
export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many file uploads, please try again in a minute."),
});

/** tRPC procedure paths that are considered auth login (rate-limited strictly) */
const AUTH_LOGIN_PROCEDURES = [
  "auth.customerLogin",
  "auth.staffLogin",
];

function isAuthLoginRequest(req: Request): boolean {
  if (req.method !== "POST" || !req.path.startsWith("/api/trpc")) return false;
  // tRPC sends procedure name in path: /api/trpc/auth.customerLogin or batch: /api/trpc/auth.customerLogin,other.procedure
  const pathSegment = req.path.replace(/^\/api\/trpc\/?/, "").trim();
  if (!pathSegment) return false;
  const procedures = pathSegment.split(",").map((p) => p.trim());
  return procedures.some((p) => AUTH_LOGIN_PROCEDURES.includes(p));
}

/**
 * Middleware that applies the strict auth limiter only when the request is to an auth login procedure.
 * Mount this before the global limiter on the /api/trpc route so login attempts are limited per IP.
 */
export function authLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isAuthLoginRequest(req)) {
    return authLimiter(req, res, next);
  }
  next();
}
