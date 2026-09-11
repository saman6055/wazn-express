/**
 * Tell the team a page broke — quietly, and at most a few times per visit.
 *
 * The error screens already show a report with a copy button (the owner's
 * rule); this sends the same facts to the server log without waiting for
 * anyone to paste them into a chat. The server scrubs phone numbers, tokens
 * and e-mail addresses; this side sends only the path of the page, never its
 * query string, and never more than a handful of reports.
 */
export type ClientErrorKind = "render" | "section" | "unhandled" | "rejection" | "chunk";

const MAX_REPORTS_PER_PAGE_LOAD = 5;
let sent = 0;
const seen = new Set<string>();

export function reportClientError(kind: ClientErrorKind, error: unknown): void {
  try {
    if (typeof window === "undefined") return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    const key = `${kind}:${err.message}`;
    if (seen.has(key) || sent >= MAX_REPORTS_PER_PAGE_LOAD) return;
    seen.add(key);
    sent += 1;

    const ref = (error as { data?: { ref?: unknown } } | null)?.data?.ref;
    const payload = JSON.stringify({
      kind,
      message: err.message.slice(0, 500),
      stack: (err.stack ?? "").slice(0, 3000),
      page: window.location.pathname,
      ref: typeof ref === "string" ? ref : undefined,
    });
    const blob = new Blob([payload], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-errors", blob)) {
      void fetch("/api/client-errors", {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        credentials: "include",
      }).catch(() => undefined);
    }
  } catch {
    // Reporting a failure must never become a second failure.
  }
}

/** For tests: forget what was sent. */
export function __resetClientErrorReports(): void {
  sent = 0;
  seen.clear();
}
