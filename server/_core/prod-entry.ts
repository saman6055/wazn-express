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
import { scheduleTrackingAlertNotifications } from "../trackingAlertNotifications";
import { initializeScheduledBackups } from "../scheduledBackups";
import { loadConfig } from "../config";
import { globalLimiter, authLimiterMiddleware } from "../middleware/rateLimiter";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
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
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  } else {
    console.log(`Serving static files from: ${distPath}`);
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

async function startServer() {
  loadConfig(); // Validates required env vars (DATABASE_URL, JWT_SECRET, MIGRATION_SECRET); throws if missing
  const app = express();
  const server = createServer(app);

  // Security headers
  app.use(helmet());

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

  // Rate limiting: global first, then auth-specific for login on /api/trpc
  app.use(globalLimiter);

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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });

  // Start tracking alert notification scheduler
  try {
    await scheduleTrackingAlertNotifications();
    console.log("[Tracking Alerts] Notification scheduler started");
  } catch (error) {
    console.error("[Tracking Alerts] Failed to start notification scheduler:", error);
  }

  // Start scheduled backups
  try {
    initializeScheduledBackups();
    console.log("[Scheduled Backups] Backup scheduler started");
  } catch (error) {
    console.error("[Scheduled Backups] Failed to start backup scheduler:", error);
  }
}

startServer().catch(console.error);
