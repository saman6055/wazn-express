/**
 * Production-only server entry point
 * This file is used for production builds and does NOT import vite or any dev dependencies
 */
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { getUploadsDir, UPLOADS_ROUTE } from "../services/localUpload";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { scheduleTrackingAlertNotifications } from "../services/trackingAlert.service";
import { scheduleOpenBoxAlerts } from "../services/openBoxAlert.service";
import { startScheduledCampaignsPoller } from "../services/push.service";
import { initializeScheduledBackups } from "../services/scheduledBackups.service";
import { loadConfig } from "../config";
import { globalLimiter, authLimiterMiddleware, writeLimiterMiddleware } from "../middleware/rateLimiter";
import { registerHealthRoutes } from "./health";
import { registerAppIconRoutes } from "../services/appIcons.service";
import { appLogger, requestLoggingMiddleware } from "../utils/logger";
import { closeDb } from "../db/connection";
import autoMigrate from "./autoMigrate";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3500): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function serveStatic(app: express.Express) {
  // In production, static files are in dist/public relative to dist/index.js
  const distPath = path.resolve(import.meta.dirname, "public");
  
  if (!fs.existsSync(distPath)) {
    appLogger.error("Build directory not found", { distPath, hint: "Build the client first" });
  } else {
    appLogger.info("Serving static files", { distPath });
  }

  app.use(express.static(distPath));

  // Locally-stored uploads (used whenever Forge storage is not configured).
  //
  // This has to be registered BEFORE the SPA catch-all below, and it was
  // missing here entirely — the dev server mounts it, production never did.
  // So a photo taken at the China warehouse uploaded fine and its URL was
  // saved on the package, but fetching that URL fell through to the catch-all
  // and returned index.html instead of the image. The <img> silently rendered
  // nothing, which looked exactly like the photo had never been attached.
  const uploadsDir = getUploadsDir();
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use(UPLOADS_ROUTE, express.static(uploadsDir, { maxAge: "7d" }));
  appLogger.info("Serving uploads", { uploadsDir, route: UPLOADS_ROUTE });

  // Without a mounted volume this directory is part of the container and is
  // recreated empty on every deploy, taking every stored photo with it. Say so
  // once at startup — silent data loss is the worst kind.
  if (!process.env.UPLOADS_DIR?.trim()) {
    appLogger.warn(
      "UPLOADS_DIR is not set — uploaded photos are stored inside the container and will be LOST on the next redeploy. Mount a persistent volume and point UPLOADS_DIR at it.",
      { uploadsDir },
    );
  }

  // fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

async function startServer() {
  loadConfig(); // Validates required env vars (DATABASE_URL, JWT_SECRET, MIGRATION_SECRET); throws if missing

  // Run DB migrations + schema patches (e.g. serviceTypes columns) before serving
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const migrateResult = await autoMigrate({ databaseUrl, retryAttempts: 2, retryDelay: 3000, verbose: false });
      if (!migrateResult.success && migrateResult.errors?.length) appLogger.warn("Startup migration had errors", { errors: migrateResult.errors });
    } catch (err) {
      appLogger.warn("Startup migration skipped or failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const app = express();
  const server = createServer(app);

  // Security headers (CSP disabled in dev; prod uses default)
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

  // tRPC API (auth limiter applies strict limit to login procedures only)
  app.use(
    "/api/trpc",
    authLimiterMiddleware,
    // Writes and uploads, counted per signed-in person rather than per
    // address — the office shares one public IP, so a per-IP write ceiling
    // would throttle the company rather than an abuser.
    writeLimiterMiddleware,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Dynamic PWA manifest + app icons from the uploaded company logo.
  // MUST be before serveStatic so /manifest.json wins over the bundled file.
  registerAppIconRoutes(app);

  // Production mode: serve static files
  serveStatic(app);

  const preferredPort = parseInt(process.env.PORT || "3500");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    appLogger.info("Port in use, using alternate", { preferredPort, port });
  }

  server.listen(port, "0.0.0.0", () => {
    appLogger.info("Server listening", { url: `http://0.0.0.0:${port}/` });
  });

  // Start tracking alert notification scheduler
  try {
    await scheduleTrackingAlertNotifications();
    appLogger.info("Tracking alerts notification scheduler started");
    await scheduleOpenBoxAlerts();
    appLogger.info("Open delivery box reminder scheduler started");
  } catch (error) {
    appLogger.error("Failed to start notification scheduler", { error: error instanceof Error ? error.message : String(error) });
  }

  // Scheduled push campaigns. The dev server has started this since it was
  // written; production never did, so every campaign anyone scheduled sat in
  // the table and its send time passed in silence. Same class of bug as the
  // uploads route: two entry points, one of them forgotten.
  try {
    startScheduledCampaignsPoller();
    appLogger.info("Push campaign scheduler started");
  } catch (error) {
    appLogger.error("Failed to start push campaign scheduler", { error: error instanceof Error ? error.message : String(error) });
  }

  // Start scheduled backups
  try {
    initializeScheduledBackups();
    appLogger.info("Scheduled backups initialized");
  } catch (error) {
    appLogger.error("Failed to start backup scheduler", { error: error instanceof Error ? error.message : String(error) });
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
