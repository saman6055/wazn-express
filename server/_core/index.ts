import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { scheduleTrackingAlertNotifications } from "../services/trackingAlert.service";
import { runMigration } from "../services/migration.service";
import { initializeScheduledBackups } from "../services/scheduledBackups.service";
import { serveStatic } from "./static";
import { loadConfig, getConfig } from "../config";
import { globalLimiter, authLimiterMiddleware } from "../middleware/rateLimiter";
import { registerHealthRoutes } from "./health";
import { appLogger, requestLoggingMiddleware } from "../utils/logger";
import { closeDb } from "../db/connection";

function listenAsync(server: ReturnType<typeof createServer>, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function startServer() {
  loadConfig(); // Validates required env vars (DATABASE_URL, JWT_SECRET, MIGRATION_SECRET); throws if missing
  const app = express();
  const server = createServer(app);

  // Security headers (CSP disabled in dev - Vite HMR and React Refresh need inline scripts)
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "development" ? false : undefined,
    })
  );

  // CORS: only allow origins from ALLOWED_ORIGINS (comma-separated)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: true,
    })
  );

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Request logging (method, url, status, duration)
  app.use(requestLoggingMiddleware(appLogger));

  // Rate limiting: global first, then auth-specific for login on /api/trpc
  app.use(globalLimiter);

  // Health checks (no auth, for load balancers / k8s)
  registerHealthRoutes(app);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Migration endpoint (one-time use, protected by secret)
  app.post("/api/run-migration", async (req, res) => {
    const { secret } = req.body;
    if (secret !== getConfig().migrationSecret) {
      return res.status(403).json({ error: "Invalid secret" });
    }
    try {
      const result = await runMigration();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Backup file download (admin only; serves local ZIP or redirects to remote URL)
  app.get("/api/backup-file/:id", async (req, res) => {
    try {
      const { sdk } = await import("./sdk.js");
      const user = await sdk.authenticateRequest(req);
      if (!user || user.isCustomer || (user.role !== "super_admin" && user.role !== "admin")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid backup id" });
      const { getDb } = await import("../db/connection.js");
      const { backups } = await import("../../drizzle/schema.js");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });
      const [backup] = await db.select().from(backups).where(eq(backups.id, id));
      if (!backup || !backup.fileUrl) return res.status(404).json({ error: "Backup not found" });
      const { getLocalBackupFilePath, LOCAL_BACKUP_PREFIX } = await import("../services/zipBackup.service.js");
      if (backup.fileUrl.startsWith(LOCAL_BACKUP_PREFIX)) {
        const localPath = getLocalBackupFilePath(id);
        return res.download(localPath, backup.filename || `backup-${id}.zip`, (err) => {
          if (err && !res.headersSent) res.status(500).json({ error: "Download failed" });
        });
      }
      return res.redirect(302, backup.fileUrl);
    } catch {
      return res.status(403).json({ error: "Forbidden" });
    }
  });

  // tRPC API (auth limiter applies strict limit to login procedures only)
  app.use(
    "/api/trpc",
    authLimiterMiddleware,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Local uploads (when Forge is not configured)
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    // Dynamic import to avoid loading vite in production
    // This file path is intentionally a string literal to prevent esbuild from bundling it
    const vitePath = "./vite.js";
    const { setupVite } = await import(/* @vite-ignore */ vitePath);
    await setupVite(app, server);
  } else {
    // Production mode: serve static files
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3500", 10) || 3500;
  const host = "0.0.0.0";

  // Run database migration on startup
  try {
    appLogger.info("Running database migration on startup");
    const migrationResult = await runMigration();
    if (migrationResult.success) {
      appLogger.info("Migration completed", { message: migrationResult.message, tables: migrationResult.tables });
    } else {
      appLogger.warn("Migration message", { message: migrationResult.message });
    }
  } catch (error) {
    appLogger.error("Migration failed", { error: error instanceof Error ? error.message : String(error) });
  }

  // Start tracking alert notification scheduler (before listen so listen is last)
  try {
    await scheduleTrackingAlertNotifications();
    appLogger.info("Tracking alerts notification scheduler started");
  } catch (error) {
    appLogger.error("Failed to start tracking alert scheduler", { error: error instanceof Error ? error.message : String(error) });
  }

  // Start scheduled backups
  try {
    initializeScheduledBackups();
    appLogger.info("Scheduled backups initialized");
  } catch (error) {
    appLogger.error("Failed to start backup scheduler", { error: error instanceof Error ? error.message : String(error) });
  }

  // Bind to port LAST - after all schedulers
  server.on("error", (err) => {
    appLogger.error("HTTP server error", { error: err instanceof Error ? err.message : String(err) });
  });

  for (let attempt = 0; attempt < 20; attempt++) {
    const port = preferredPort + attempt;
    try {
      await listenAsync(server, port, host);
      if (port !== preferredPort) {
        appLogger.info("Port in use, using alternate", { preferredPort, port });
      }
      appLogger.info("Server listening", { url: `http://0.0.0.0:${port}/`, port });
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EADDRINUSE" && attempt < 19) {
        appLogger.warn("Port in use, trying next", { port, nextPort: port + 1 });
        continue;
      }
      appLogger.error("Server failed to bind", { port, error: err instanceof Error ? err.message : String(err), code });
      throw err;
    }
  }
}

startServer().catch((err) => appLogger.error("Server failed to start", { error: err instanceof Error ? err.message : String(err) }));

process.on("SIGTERM", async () => {
  appLogger.info("SIGTERM received, closing database pool");
  await closeDb();
  process.exit(0);
});
process.on("SIGINT", async () => {
  appLogger.info("SIGINT received, closing database pool");
  await closeDb();
  process.exit(0);
});
