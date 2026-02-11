/**
 * Structured logger using pino.
 * - Production: error + warn only, JSON output.
 * - Development: all levels (error, warn, info, debug), pretty print when pino-pretty is available.
 */
import pino, { type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";

function createLogger(): Logger {
  const opts: pino.LoggerOptions = {
    level: isProduction ? "warn" : "debug",
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...(isProduction ? {} : { transport: undefined }), // dev: default stdout (JSON); add pino-pretty in pipeline if desired
  };
  return pino(opts);
}

const log = createLogger();

export type AppLogger = {
  error: (msg: string, obj?: Record<string, unknown>) => void;
  warn: (msg: string, obj?: Record<string, unknown>) => void;
  info: (msg: string, obj?: Record<string, unknown>) => void;
  debug: (msg: string, obj?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => AppLogger;
};

function wrap(child: Logger): AppLogger {
  return {
    error: (msg, obj) => child.error(obj ?? {}, msg),
    warn: (msg, obj) => child.warn(obj ?? {}, msg),
    info: (msg, obj) => child.info(obj ?? {}, msg),
    debug: (msg, obj) => child.debug(obj ?? {}, msg),
    child: (bindings) => wrap(child.child(bindings)),
  };
}

export const appLogger: AppLogger = wrap(log);

/**
 * Express middleware: log request method, url, status code, and duration.
 */
import type { Request, Response, NextFunction } from "express";

export function requestLoggingMiddleware(
  logInstance: AppLogger = appLogger
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      (logInstance as AppLogger)[level]("request", {
        method: req.method,
        url: req.originalUrl ?? req.url,
        status: res.statusCode,
        durationMs: duration,
      });
    });
    next();
  };
}
