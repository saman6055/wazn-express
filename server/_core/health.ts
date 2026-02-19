/**
 * Health check endpoints for load balancers and container orchestration.
 * Version is read from package.json when available (e.g. dev); in Docker/bundle
 * package.json may be missing, so we fallback to a default.
 */
import type { Express, Request, Response } from "express";
import { createRequire } from "node:module";
import { getDb } from "../db/connection";
import { sql } from "drizzle-orm";

let appVersion = "1.0.0";
try {
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version?: string };
  if (pkg?.version) appVersion = pkg.version;
} catch {
  // In Docker/bundled build, package.json is often not copied; use fallback.
}

export function registerHealthRoutes(app: Express) {
  // Basic liveness/readiness: process is up
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: appVersion,
    });
  });

  // Database connectivity check
  app.get("/api/health/db", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        return res.status(503).json({
          status: "error",
          message: "Database not configured",
        });
      }
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "ok",
        message: "Database connection OK",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        status: "error",
        message: "Database ping failed",
        error: message,
      });
    }
  });
}
