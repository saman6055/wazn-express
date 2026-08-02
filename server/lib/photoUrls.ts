/**
 * Which stored photo URLs may be checked against local disk — and, therefore,
 * which ones may ever be deleted as dead.
 *
 * Background. Photos taken at the warehouse were written to a directory inside
 * the container and served from a route production never mounted. Redeploys
 * rebuilt the container, so the files went with it while their URLs stayed on
 * the package rows. Those rows now point at nothing and render as broken
 * images.
 *
 * Clearing them is a deletion, so the rule that decides what counts as "dead"
 * lives here on its own and is tested directly. The bias is heavily towards
 * keeping: only a URL that is unambiguously a path into our own uploads
 * directory is ever a candidate. Anything else — an absolute URL to object
 * storage, an inline data URI, an unfamiliar path — is left alone, because a
 * missing file on disk proves nothing about it.
 */

/** The route local uploads are served under. Must match localUpload. */
const UPLOADS_PREFIX = "/uploads/";

export type PhotoUrlKind =
  /** A file in our own uploads directory. Existence on disk is decidable. */
  | "local"
  /** Object storage, a CDN, or any other host. Not ours to judge. */
  | "external"
  /** The image bytes are the value itself; there is no file to miss. */
  | "inline"
  /** Empty, malformed, or a path we do not recognise. Left untouched. */
  | "unknown";

export function classifyPhotoUrl(url: unknown): PhotoUrlKind {
  if (typeof url !== "string") return "unknown";
  const u = url.trim();
  if (u === "") return "unknown";

  if (u.startsWith("data:")) return "inline";
  // Protocol-relative (//host/path) is a remote host, not a local path.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u) || u.startsWith("//")) return "external";
  if (u.startsWith(UPLOADS_PREFIX)) return "local";

  return "unknown";
}

/**
 * The on-disk file name a local URL refers to, or null if the URL is not a
 * plain file directly inside the uploads directory.
 *
 * Returns a bare file name, never a path. Anything containing a slash or a
 * parent-directory hop is rejected rather than resolved: a stored value is
 * data, and letting it steer which path gets stat-ed — and then deleted from —
 * is how a traversal bug starts.
 */
export function localUploadFileName(url: unknown): string | null {
  if (classifyPhotoUrl(url) !== "local") return null;

  const rest = (url as string).trim().slice(UPLOADS_PREFIX.length);
  // Drop a query string or fragment before validating the name.
  const name = rest.split(/[?#]/)[0];

  if (name === "" || name === "." || name === "..") return null;
  if (name.includes("/") || name.includes("\\")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    return null; // Malformed percent-encoding — not a name we can trust.
  }
  if (decoded.includes("/") || decoded.includes("\\") || decoded.includes("\0")) return null;
  if (decoded === "." || decoded === "..") return null;

  return decoded;
}

/**
 * Given a package's stored photo list and the set of file names that actually
 * exist, return the list to keep — or null when nothing changed.
 *
 * Returning null for "unchanged" keeps the caller from writing a row it does
 * not need to touch, so a dry run and a real run visit exactly the same rows.
 */
export function prunePhotoList(
  photos: unknown,
  fileExists: (name: string) => boolean,
): { kept: string[]; removed: string[] } | null {
  if (!Array.isArray(photos)) return null;

  const kept: string[] = [];
  const removed: string[] = [];

  for (const entry of photos) {
    const name = localUploadFileName(entry);
    // Not a local upload, or not a name we can resolve: keep it. We cannot
    // prove it is dead, and an unprovable claim is not grounds for deleting.
    if (name === null || fileExists(name)) {
      if (typeof entry === "string") kept.push(entry);
      continue;
    }
    removed.push(entry as string);
  }

  if (removed.length === 0) return null;
  return { kept, removed };
}
