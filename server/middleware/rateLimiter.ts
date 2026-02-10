import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

/** Global: 100 requests per minute per IP */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

/** Auth routes (login): 5 attempts per 15 minutes per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

/** Data mutation routes: 30 requests per minute per IP */
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many mutations, please try again later." },
});

/** File upload routes: 10 per minute per IP */
export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
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
