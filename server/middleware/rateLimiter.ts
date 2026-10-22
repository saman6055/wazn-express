import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";

const isDev = process.env.NODE_ENV === "development";

/**
 * The path as the client sent it, whatever this middleware is mounted under.
 *
 * Inside `app.use("/api/trpc", …)` Express strips the mount from `req.path`:
 * a login arrives as `/auth.customerLogin`, not `/api/trpc/auth.customerLogin`.
 * Every check below asked "does this start with /api/trpc" and the answer was
 * always no — so the login limiter and the write limiters, mounted exactly
 * there, never ran once in production. Twenty wrong passwords a quarter-hour
 * was the rule on paper; a thousand requests a minute was the rule in fact.
 * `baseUrl` holds what the mount stripped.
 */
export function requestPath(req: Request): string {
  return `${req.baseUrl ?? ""}${req.path ?? ""}`;
}

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
    res.status(429).json(buildThrottleBody(requestPath(req), req.query.batch === "1", message));
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

/**
 * Is this cookie a session this server signed?
 *
 * The write limiters key on the session so that one office does not share
 * one bucket. Keyed on the cookie's bare value, though, every made-up cookie
 * was a fresh bucket: a script that changed the cookie on each request was
 * never counted at all. Only a token that verifies earns its own allowance;
 * anything else is counted with its address. Signature only — no database —
 * so this costs a hash per write and nothing more.
 */
async function isOurSession(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Who a limit applies to: the signed-in session, or the address when there
 * isn't one.
 *
 * Per-IP is the wrong unit for this office. Everybody there shares one public
 * address through NAT, so a per-IP write ceiling is really a ceiling on the
 * whole company at once — three people registering parcels on a busy intake
 * day would lock out the fourth, and the message would say "too many changes"
 * to somebody who had made two. That is why these two limiters sat unmounted
 * for as long as they did: switching them on would have throttled the
 * business rather than an abuser.
 *
 * Keyed on the session cookie, a bulk-scanning employee spends only their own
 * allowance. Anyone signed in is already someone we can identify and disable;
 * the limit is here to stop a script, not to police staff.
 *
 * The cookie value is hashed rather than used directly — it is a credential,
 * and rate-limiter keys end up in memory stores and, on some deployments, in
 * logs.
 */
async function sessionOrIpKey(req: Request): Promise<string> {
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match?.[1] && (await isOurSession(match[1]))) {
      return "s:" + createHash("sha256").update(match[1]).digest("hex").slice(0, 32);
    }
  }
  return "ip:" + (ipKeyGenerator(req.ip ?? "") || "unknown");
}

/**
 * Writes: a ceiling per signed-in person, not per office.
 *
 * Generous on purpose. A long bulk-registration session is a few hundred
 * writes an hour from one person, nowhere near this; a runaway script reaches
 * it in seconds.
 */
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 600,
  keyGenerator: sessionOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many changes at once, please try again in a minute."),
});

/**
 * Uploads: the same, lower, because each one carries a photo.
 *
 * A delivery run with a photo per box, or a customer attaching proof to a
 * claim, is well inside this.
 */
export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 200 : 120,
  keyGenerator: sessionOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many file uploads, please try again in a minute."),
});

/**
 * Writes anybody may make without signing in — today, an order in the shop.
 *
 * A stranger has no session to be counted by and no account to switch off,
 * so the only handle is the address, and the allowance has to be a person's:
 * a family ordering three things in an evening is inside it, a script
 * filling the orders list with rubbish is not.
 */
export const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: throttledHandler("Too many orders from this address, please try again later."),
});

/** tRPC procedure paths that are considered auth login (rate-limited strictly) */
const AUTH_LOGIN_PROCEDURES = [
  "auth.customerLogin",
  "auth.staffLogin",
];

/** Mutations open to anyone, held to publicWriteLimiter. */
const PUBLIC_WRITE_PROCEDURES = ["store.createOrder"];

function trpcProcedures(req: Request): string[] {
  const path = requestPath(req);
  if (!path.startsWith("/api/trpc")) return [];
  // tRPC sends procedure name in path: /api/trpc/auth.customerLogin or batch: /api/trpc/auth.customerLogin,other.procedure
  const segment = path.replace(/^\/api\/trpc\/?/, "").trim();
  return segment ? segment.split(",").map((p) => p.trim()) : [];
}

function isAuthLoginRequest(req: Request): boolean {
  if (req.method !== "POST") return false;
  return trpcProcedures(req).some((p) => AUTH_LOGIN_PROCEDURES.includes(p));
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

/**
 * Procedure names that carry a file, and so belong to the upload limiter
 * rather than the general write one.
 *
 * Matched on the suffix so a router rename does not silently drop the limit —
 * every one of these is "something with a photo or a document in it".
 */
const UPLOAD_PROCEDURE_HINTS = ["upload", "Photo", "Image", "Document", "Backup"];

function isUploadRequest(procedures: string[]): boolean {
  return procedures.some((p) => UPLOAD_PROCEDURE_HINTS.some((hint) => p.includes(hint)));
}

/**
 * The write limiters, applied only to writes.
 *
 * tRPC sends queries as GET and mutations as POST, so the method is the whole
 * test: a dashboard that polls a dozen read endpoints every few seconds never
 * touches this, and only a request that changes something is counted.
 *
 * Login is excluded — it is a POST, but `authLimiterMiddleware` already holds
 * it to a much stricter count, and running both would mean a failed login
 * spending two allowances.
 */
export function writeLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "POST") return next();
  const procedures = trpcProcedures(req);
  if (procedures.length === 0) return next();
  if (isAuthLoginRequest(req)) return next();

  if (procedures.some((p) => PUBLIC_WRITE_PROCEDURES.includes(p))) return publicWriteLimiter(req, res, next);
  if (isUploadRequest(procedures)) return fileUploadLimiter(req, res, next);
  return mutationLimiter(req, res, next);
}
