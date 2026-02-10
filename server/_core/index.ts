import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { scheduleTrackingAlertNotifications } from "../trackingAlertNotifications";
import { runMigration } from "../runMigration";
import { initializeScheduledBackups } from "../scheduledBackups";
import { serveStatic } from "./static";
import { loadConfig, getConfig } from "../config";
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
  // tRPC API (auth limiter applies strict limit to login procedures only)
  app.use(
    "/api/trpc",
    authLimiterMiddleware,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Run database migration on startup
  try {
    console.log("[Migration] Running database migration on startup...");
    const migrationResult = await runMigration();
    if (migrationResult.success) {
      console.log("[Migration] " + migrationResult.message);
      console.log("[Migration] Tables: " + migrationResult.tables.join(", "));
    } else {
      console.warn("[Migration] " + migrationResult.message);
    }
  } catch (error) {
    console.error("[Migration] Failed to run migration:", error);
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
