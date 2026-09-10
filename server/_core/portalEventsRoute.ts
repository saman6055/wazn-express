import type { Express } from "express";
import { sdk } from "./sdk";
import { subscribePortalEvents } from "../services/portalEvents.service";
import { appLogger } from "../utils/logger";

/**
 * The portal's live-update stream (SSE).
 *
 * The portal layout opens an EventSource to this endpoint on every page;
 * without it, the live notices for package status changes, new invoices and
 * payments never fire.
 *
 * It lived only in the dev server (index.ts). Production runs prod-entry.ts,
 * so there /api/portal/events fell through to the page catch-all: every open
 * portal tab received the page shell instead of a stream, gave up, and asked
 * again within thirty seconds, for as long as it stayed open — and no live
 * notice ever arrived. The same class of bug as the uploads route and the
 * push scheduler: two entry points, one forgotten. Both register it from here.
 *
 * Requires a signed-in customer; answers 401 otherwise so the browser stops
 * retrying. Cleanup is attached to `req.on('close')`, so a dropped tab
 * releases its listener at once.
 */
export function registerPortalEventsRoute(app: Express): void {
  app.get("/api/portal/events", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user || !user.isCustomer) {
        return res.status(401).json({ error: "Customer login required" });
      }

      // Standard SSE response headers. `X-Accel-Buffering: no` disables
      // Nginx/proxy buffering so events actually reach the client live.
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      // Initial comment so the client knows the stream opened cleanly.
      res.write(`: connected\n\n`);

      const unsubscribe = subscribePortalEvents(user.id, (event) => {
        // SSE wire format: `data: <json>\n\n`. JSON.stringify is safe
        // because PortalEvent only carries primitive fields.
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          // Write after close — ignore; cleanup is handled by 'close'.
        }
      });

      // Heartbeat every 25s so proxies (and the client) don't time out an
      // otherwise idle connection. Comment lines are valid SSE and are
      // ignored by EventSource.
      const heartbeat = setInterval(() => {
        try { res.write(`: heartbeat\n\n`); } catch { /* socket gone */ }
      }, 25_000);

      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { res.end(); } catch { /* already closed */ }
      });
    } catch (err) {
      // A session that no longer verifies is a 401, like no session at all.
      const unauth = /session|token|jwt|forbidden|unauthori/i.test(err instanceof Error ? err.message : "");
      if (unauth) {
        try { return res.status(401).json({ error: "Customer login required" }); } catch { /* sent */ }
      }
      appLogger.error("[SSE] /api/portal/events failed to open", {
        error: err instanceof Error ? err.message : String(err),
      });
      try { res.status(500).end(); } catch { /* response already sent */ }
    }
  });
}
