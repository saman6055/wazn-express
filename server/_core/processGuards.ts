import { appLogger } from "../utils/logger";

/**
 * The process does not fall over because one promise was forgotten.
 *
 * Node 22 (the Dockerfile's image) treats a rejected promise that nobody
 * caught as fatal: the whole server exits, every open request on it dies, and
 * the container restarts while the office waits. A fire-and-forget call in a
 * timer — `void tick()`, a notification sent without `.catch` — is enough.
 * Express already catches what a route handler throws, so what reaches here
 * is background work; the owner's rule is that an error is written to the
 * log, never a crash.
 *
 * Both entry points install this (entry-parity.test.ts keeps it that way),
 * and installing it twice registers nothing twice.
 */
let installed = false;

function describe(reason: unknown): Record<string, unknown> {
  if (reason instanceof Error) {
    return { error: reason.message, stack: reason.stack, cause: reason.cause instanceof Error ? reason.cause.message : reason.cause };
  }
  return { error: String(reason) };
}

export function onUnhandledRejection(reason: unknown): void {
  appLogger.error("Unhandled promise rejection — logged, the server keeps running", describe(reason));
}

export function onUncaughtException(error: unknown): void {
  appLogger.error("Uncaught exception — logged, the server keeps running", describe(error));
}

export function installProcessGuards(): void {
  if (installed) return;
  installed = true;
  process.on("unhandledRejection", onUnhandledRejection);
  process.on("uncaughtException", onUncaughtException);
}
