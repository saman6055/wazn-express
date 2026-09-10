/**
 * Text going into a hand-built HTML page is text, never markup.
 *
 * Every print window here is opened with window.open("") and filled with
 * document.write, so it runs on the app's own origin, with the session of the
 * staff member who pressed Print. A tracking number or product name a customer
 * typed in the portal reaches those pages; unescaped, a value like
 * `<img src=x onerror=…>` would run as that staff member. React escapes what
 * it renders — these templates are the one place nothing did.
 */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Open a stored address — a supplier's website, a chat attachment — in a new
 * tab. Only http(s) or a same-site path: a `javascript:` or `data:` value typed
 * into a record never runs. A bare "shop.1688.com" still opens, as https.
 * `noopener` so the new tab cannot steer this one.
 */
export function openExternal(url: string | null | undefined): void {
  const raw = (url ?? "").trim();
  if (!raw) return;
  let href = raw;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) {
    if (!/^https?:/i.test(raw)) return;
  } else if (!raw.startsWith("/")) {
    href = `https://${raw}`;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
