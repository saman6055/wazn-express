import express, { type NextFunction, type Request, type Response } from "express";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";

/**
 * How big a tRPC body may be, decided before it is read.
 *
 * A file arrives as base64 inside a tRPC call, so a signed-in person may send
 * up to 50 MB. Everybody else — no session, or one this server did not sign —
 * gets 100 KB: a login or a shop order is a few hundred bytes, and parsing
 * fifty megabytes for a stranger costs memory and time for nothing
 * (security audit, 2026-11-05). The signature is checked here, without the
 * database; who the person is, and what they may do, is still decided later.
 */
const large = express.json({ limit: "50mb" });
const small = express.json({ limit: "100kb" });

function sessionToken(req: Request): string | null {
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) return match[1];
  }
  const header = req.headers.authorization;
  const bearer = typeof header === "string" ? /^Bearer\s+(eyJ[\w-]+\.[\w-]+\.[\w-]+)$/i.exec(header.trim()) : null;
  return bearer?.[1] ?? null;
}

export async function signedBySelf(token: string | null): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export function trpcBodyParser(req: Request, res: Response, next: NextFunction): void {
  signedBySelf(sessionToken(req))
    .then((ok) => (ok ? large : small)(req, res, next))
    .catch(next);
}
