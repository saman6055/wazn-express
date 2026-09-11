import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { getUploadsDir, UPLOADS_ROUTE } from "../services/localUpload";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerPortalEventsRoute } from "./portalEventsRoute";
import { registerBackupFileRoute } from "./backupFileRoute";
import { registerClientErrorsRoute } from "./clientErrorsRoute";
import { scheduleTrackingAlertNotifications } from "../services/trackingAlert.service";
import { startFlightWatch } from "../services/flightWatch.service";
import { scheduleOpenBoxAlerts } from "../services/openBoxAlert.service";
import { startDailySnapshots } from "../services/dailyBrief.service";
import { runMigration } from "../services/migration.service";
import { initializeScheduledBackups } from "../services/scheduledBackups.service";
import { startScheduledCampaignsPoller } from "../services/push.service";
import { serveStatic } from "./static";
import { loadConfig, getConfig } from "../config";
import { globalLimiter, authLimiterMiddleware, writeLimiterMiddleware } from "../middleware/rateLimiter";
import { registerHealthRoutes } from "./health";
import { registerAppIconRoutes } from "../services/appIcons.service";
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

  // We run behind a reverse proxy (Coolify). Without this, req.ip is the
  // PROXY's address for every request, so the rate limiters below bucket all
  // users together — a handful of tabs tripped the global limit and everyone
  // got 429s until the window expired.
  //
  // Set to the NUMBER OF PROXY HOPS, never `true`: `true` trusts the whole
  // X-Forwarded-For chain, which a client can forge to dodge rate limits.
  // Default 1 = Coolify only. Add another hop for a CDN in front (e.g.
  // Cloudflare → TRUST_PROXY_HOPS=2).
  const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS ?? "1", 10);
  app.set("trust proxy", Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

  // Security headers (CSP disabled in dev - Vite HMR and React Refresh need inline scripts)
  app.use(
    helmet({
      // Helmet's default policy allows frames from 'self' only, which blocks
      // the YouTube player the portal tutorials embed. Widen just that one
      // directive — everything else keeps the default — so a tutorial plays
      // in-app and the view still counts on the company's own channel.
      contentSecurityPolicy: process.env.NODE_ENV === "development" ? false : {
        useDefaults: true,
        directives: {
          "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
          "img-src": ["'self'", "data:", "blob:", "https://i.ytimg.com", "https:"],
        },
      },
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

  // Backup download and the portal's live updates — shared with production.
  registerBackupFileRoute(app);

  registerPortalEventsRoute(app);
  registerClientErrorsRoute(app);

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
  // MUST be before the Vite/static handlers so /manifest.json wins over the
  // bundled file in client/public.
  registerAppIconRoutes(app);

  // Local uploads (when Forge is not configured). Path and route come from
  // localUpload so the writer and the server can never disagree about where
  // the files are — production served a different answer than dev for a while,
  // and every photo saved through it came back as index.html.
  const uploadsDir = getUploadsDir();
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use(UPLOADS_ROUTE, express.static(uploadsDir));
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
    await scheduleOpenBoxAlerts();
    appLogger.info("Open delivery box reminder scheduler started");
    // Watches the airport's arrivals board for the flights our shipments are
    // on, and tells the office and the customers when one lands.
    await startFlightWatch();
    // Yesterday, written down. The memory the morning brief compares against.
    startDailySnapshots();
    appLogger.info("Flight arrival watcher started");
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

  // Start push notification campaign scheduler (60s tick)
  try {
    startScheduledCampaignsPoller();
    appLogger.info("Push campaign scheduler started");
  } catch (error) {
    appLogger.error("Failed to start push campaign scheduler", { error: error instanceof Error ? error.message : String(error) });
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
