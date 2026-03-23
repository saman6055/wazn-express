import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV === "development";

/** Global: 500 requests per minute per IP (dev: 10000 to avoid HMR/refresh limits) */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

/** Auth routes (login): 10 attempts per 15 minutes per IP (dev: 50 for testing) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

/** Data mutation routes: 100 requests per minute per IP (dev: 500) */
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many mutations, please try again later." },
});

/** File upload routes: 30 per minute per IP (dev: 100) */
export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many file uploads, please try again later." },
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
