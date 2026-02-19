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
import { appRouter } from "../routers";
import { createContext } from "./context";
import { scheduleTrackingAlertNotifications } from "../services/trackingAlert.service";
import { initializeScheduledBackups } from "../services/scheduledBackups.service";
import { loadConfig } from "../config";
import { globalLimiter, authLimiterMiddleware } from "../middleware/rateLimiter";
import { registerHealthRoutes } from "./health";
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
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

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
  } catch (error) {
    appLogger.error("Failed to start notification scheduler", { error: error instanceof Error ? error.message : String(error) });
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
