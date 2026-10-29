import type { NextFunction, Request, RequestHandler, Response } from "express";
import { appLogger } from "../utils/logger";

/**
 * An async Express 4 handler that cannot leave a request hanging.
 *
 * Express 4 does not catch a rejected promise: a `throw` after an `await` —
 * the database away for a second, a full disk under a backup chunk — is an
 * unhandled rejection, and the browser waits on a request nobody will ever
 * answer. Wrapped here, the fault is logged under the route and the caller
 * gets a plain 500, so the page can say so and try again.
 */
export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err: unknown) => {
      appLogger.error("Route failed", {
        method: req.method,
        url: req.originalUrl?.split("?")[0],
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) res.status(500).json({ error: "داواکارییەکە سەرکەوتوو نەبوو — دووبارە هەوڵ بدەرەوە." });
    });
  };
}
