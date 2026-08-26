/**
 * The logo, addressed so a print window can fetch it.
 *
 * A receipt prints from a document of its own with no base URL of ours, so a
 * stored path like `/uploads/logo.png` resolves against nothing and the mark
 * silently fails to appear. Absolute URLs and data URIs are already fine and
 * are handed back untouched.
 */
export function absoluteLogoUrl(logoUrl?: string | null): string | undefined {
  const url = (logoUrl ?? "").trim();
  if (!url) return undefined;
  if (/^(https?:|data:)/i.test(url)) return url;
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
