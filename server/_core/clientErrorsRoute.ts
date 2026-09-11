import type { Express, Request, Response } from "express";
import { mutationLimiter } from "../middleware/rateLimiter";
import { scrubText, scrubUrl } from "../lib/scrub";
import { appLogger } from "../utils/logger";

const KINDS = new Set(["render", "section", "unhandled", "rejection", "chunk"]);

/**
 * Where a browser tells the team that something broke.
 *
 * Until now a crash in someone's browser reached nobody: the error screens
 * showed a report with a copy button, and unless the reader pasted it into
 * WhatsApp, the office never learned it happened. The page now sends the
 * same facts here, quietly — scrubbed of phone numbers, tokens and e-mail
 * addresses, capped in length, and rate-limited per session — and they land
 * in the server log beside the server's own errors.
 *
 * Answers 204 whatever happens: reporting a failure must never be a second
 * failure on the page.
 */
export function registerClientErrorsRoute(app: Express): void {
  app.post("/api/client-errors", mutationLimiter, (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "unhandled";
      appLogger.warn("[client-error]", {
        kind,
        message: scrubText(body.message, 500),
        stack: scrubText(body.stack, 3000),
        page: scrubUrl(body.page),
        ref: typeof body.ref === "string" && /^[0-9A-F]{8}$/.test(body.ref) ? body.ref : undefined,
        agent: scrubText(req.headers["user-agent"], 200),
      });
    } catch {
      // Never answer a report with an error.
    }
    res.status(204).end();
  });
}
