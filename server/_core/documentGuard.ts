import fs from "fs";
import path from "path";
import type { Express, NextFunction, Request, Response } from "express";
import { sdk } from "./sdk";
import { getUploadsDir, UPLOADS_ROUTE } from "../services/localUpload";
import { getCustomerDocumentUrls } from "../db/customers.db";
import { appLogger } from "../utils/logger";

/**
 * Passports, ID cards and contracts are not public files.
 *
 * They are uploaded into the same folder as package photos and logos, and
 * that folder is served to anyone who asks for /uploads/<name>: a customer's
 * passport was one forwarded link away from a stranger. The owner's decision
 * (2026-09-11): these are seen by signed-in staff and nobody else.
 *
 * Nothing is moved and no stored link changes. What changed is who gets an
 * answer: before the folder is served, a request for a file that a customer's
 * passport, national ID or contract points to needs a staff session. Anybody
 * else gets a 404, the same answer as a file that does not exist, so a link
 * cannot even be confirmed. Staff screens keep working as they are: an <img>
 * or a new tab on the same site carries the session cookie with it.
 *
 * Which names are documents comes from the customers table, re-read every
 * minute and straight away after a document is attached or removed. A name
 * stays on the list after its document is removed from the customer — the
 * file is still on the disk — in a small list kept beside the files
 * (a dotfile, which the static server never serves).
 */

const STAFF_ROLES = new Set(["super_admin", "admin", "employee", "accountant", "auditor"]);
const REFRESH_MS = 60_000;
const REMEMBERED_FILE = ".document-names.json";

/** A requested or stored name, in the one form the two are compared in. */
export function uploadNameOf(rawPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null; // Malformed: the static server will not serve it either.
  }
  if (decoded.includes("\0")) return null;
  // Normalised the way the static server resolves it, so "./", "//" or a
  // backslash cannot dress one file up as another.
  const name = path.posix.basename(path.posix.normalize(decoded.replace(/\\/g, "/")));
  if (!name || name === "." || name === ".." || name === "/") return null;
  // Lower case: a case-insensitive disk serves ABC.jpg when asked for abc.jpg.
  return name.toLowerCase();
}

/** The file names stored links point to, where they point into our folder. */
export function documentNamesFrom(urls: readonly unknown[]): Set<string> {
  const names = new Set<string>();
  const marker = `${UPLOADS_ROUTE}/`;
  for (const url of urls) {
    if (typeof url !== "string") continue;
    const at = url.indexOf(marker);
    if (at === -1) continue; // Object storage: not served from this folder.
    const name = uploadNameOf(url.slice(at + marker.length).split(/[?#]/)[0]);
    if (name) names.add(name);
  }
  return names;
}

let remembered: Set<string> | null = null;

function rememberedPath(): string {
  return path.join(getUploadsDir(), REMEMBERED_FILE);
}

/** Add today's names to every name that was ever a document, and keep it. */
function remember(fresh: Set<string>): Set<string> {
  if (!remembered) {
    try {
      const saved: unknown = JSON.parse(fs.readFileSync(rememberedPath(), "utf8"));
      remembered = new Set(Array.isArray(saved) ? saved.filter((n): n is string => typeof n === "string") : []);
    } catch {
      remembered = new Set();
    }
  }
  let added = false;
  fresh.forEach((name) => {
    if (!remembered!.has(name)) {
      remembered!.add(name);
      added = true;
    }
  });
  if (added) {
    try {
      fs.mkdirSync(path.dirname(rememberedPath()), { recursive: true });
      fs.writeFileSync(rememberedPath(), JSON.stringify(Array.from(remembered)));
    } catch (error) {
      appLogger.warn("Could not save the customer document list", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return remembered;
}

let cached: Set<string> | null = null;
let loadedAt = 0;
let generation = 0;
let pending: Promise<Set<string>> | null = null;

/** The list changed (a document attached or removed): read it again. */
export function forgetDocumentNames(): void {
  generation += 1;
  loadedAt = 0;
}

/**
 * Every name that is, or was, a customer document. Null only when the
 * database has never answered — and then every file is treated as one.
 */
export async function currentDocumentNames(
  load: () => Promise<readonly unknown[]> = getCustomerDocumentUrls,
): Promise<Set<string> | null> {
  if (cached && Date.now() - loadedAt < REFRESH_MS) return cached;
  if (!pending) {
    const started = generation;
    pending = load()
      .then((urls) => {
        cached = remember(documentNamesFrom(urls));
        // Changed while this was reading: fine for now, read again next time.
        loadedAt = started === generation ? Date.now() : 0;
        return cached;
      })
      .finally(() => {
        pending = null;
      });
  }
  try {
    return await pending;
  } catch (error) {
    appLogger.warn("Could not read the customer document list", {
      error: error instanceof Error ? error.message : String(error),
    });
    return cached;
  }
}

interface Viewer {
  role?: unknown;
  isCustomer?: unknown;
}

export interface DocumentGuardDeps {
  documentNames: () => Promise<Set<string> | null>;
  authenticate: (req: Request) => Promise<Viewer | null | undefined>;
}

const liveDeps: DocumentGuardDeps = {
  documentNames: () => currentDocumentNames(),
  authenticate: (req) => sdk.authenticateRequest(req),
};

export function documentGuard(deps: DocumentGuardDeps = liveDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const name = uploadNameOf(req.path);
    if (!name) return next();

    // No list at all means the database has never answered. Then every file
    // is treated as a document: failing open would hand out passports
    // whenever the database is slow.
    const names = await deps.documentNames();
    if (names && !names.has(name)) return next();

    let viewer: Viewer | null | undefined = null;
    try {
      viewer = await deps.authenticate(req);
    } catch {
      viewer = null; // No session, an expired one, or a switched-off account.
    }
    const isStaff = !!viewer && viewer.isCustomer !== true && STAFF_ROLES.has(String(viewer.role));
    if (!isStaff) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).end();
      return;
    }
    // Never kept by a browser cache or a proxy: the next person at this
    // computer may not be staff. The production static route reads this flag.
    res.locals.customerDocument = true;
    res.setHeader("Cache-Control", "private, no-store");
    next();
  };
}

/** Registered in both entries, before the uploads folder is served. */
export function registerDocumentGuard(app: Express): void {
  app.use(UPLOADS_ROUTE, documentGuard());
}

/** Tests only. */
export function resetDocumentGuard(): void {
  remembered = null;
  cached = null;
  loadedAt = 0;
  pending = null;
  generation = 0;
}
