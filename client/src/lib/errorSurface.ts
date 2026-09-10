/**
 * Where an error screen is showing, and who is reading it.
 *
 * No locale files and no React context here: this runs when something has
 * already gone wrong, and must not depend on anything else having worked.
 */
const LANGUAGE_STORAGE_KEY = "wazn-express-language";

export type Surface = "portal" | "public" | "staff";

const PUBLIC_PREFIXES = ["/store", "/t/", "/customer-login", "/staff-login"];

function currentPath(): string {
  return typeof window !== "undefined" ? window.location.pathname : "/";
}

export function currentSurface(pathname: string = currentPath()): Surface {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return "portal";
  if (pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "public";
  return "staff";
}

/** "Go home" goes to the reader's own home, not the public landing page. */
export function homePath(surface: Surface = currentSurface()): string {
  if (surface === "portal") return "/portal";
  if (surface === "public") return "/";
  return "/dashboard";
}

/**
 * The raw message — SQL, a stack, "Cannot read properties of undefined" — is
 * for the office, which can act on it. A customer gets the plain sentence,
 * and the same detail still goes into "copy details for support".
 */
export function showsTechnicalDetail(surface: Surface = currentSurface()): boolean {
  return surface === "staff";
}

export function readerDirection(): "rtl" | "ltr" {
  try {
    const lang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "ku";
    return lang === "ku" || lang === "ar" ? "rtl" : "ltr";
  } catch {
    return "rtl";
  }
}

/** The reference the server gave a fault (error.data.ref), if there is one. */
export function errorRef(error: unknown): string | null {
  const ref = (error as { data?: { ref?: unknown } } | null | undefined)?.data?.ref;
  return typeof ref === "string" && /^[0-9A-F]{8}$/.test(ref) ? ref : null;
}

/** A message the server wrote for the reader, as opposed to a crash in the page. */
export function isServerMessage(error: unknown): boolean {
  const code = (error as { data?: { code?: unknown } } | null | undefined)?.data?.code;
  return typeof code === "string";
}
