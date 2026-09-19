/**
 * Where each step of the phone's history was taken from.
 *
 * An on-screen back arrow should do exactly what the phone's Back button
 * does — take one step back, to the screen before, as it was left — but only
 * when that step lands inside the portal. On the first page of a visit (a
 * link opened from WhatsApp, a new tab, the page right after signing in) the
 * step behind is somewhere else or nothing at all, and there the arrow opens
 * the portal's home instead of leaving it.
 *
 * `history.length` cannot tell those apart: it counts every page the tab has
 * shown — Google's, the sign-in page — and it does not shrink when the
 * customer goes back. So each entry is stamped, as it is made, with the
 * address it was made from, and the arrow reads that stamp.
 *
 * Every other thing an entry carries (the search's memory, a layer's mark)
 * is left alone. Pure, so the rules are tested without a browser; the
 * listener that stamps the entries is `installHistorySteps` below, called
 * once from main.tsx.
 */

/** The address the current entry was stepped to from. */
export const STEP_FROM_KEY = "stepFrom";

/** This entry is one open layer — a dialog, a drawer, a photo — by its owner's id. */
export const LAYER_KEY = "stepLayer";

const asRecord = (state: unknown): Record<string, unknown> =>
  state && typeof state === "object" && !Array.isArray(state) ? (state as Record<string, unknown>) : {};

/** The address this entry was stepped to from, or null for the first step of a visit. */
export function readStepFrom(state: unknown): string | null {
  const from = asRecord(state)[STEP_FROM_KEY];
  return typeof from === "string" && from ? from : null;
}

/** The same state, remembering where the step came from. */
export function withStepFrom(state: unknown, from: string | null): Record<string, unknown> {
  return { ...asRecord(state), [STEP_FROM_KEY]: from };
}

/** An address without its ?query and #hash. */
export function pathOf(address: string): string {
  const cut = address.search(/[?#]/);
  const path = cut === -1 ? address : address.slice(0, cut);
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * A page of the customer portal: /portal and everything under it — not
 * /portal-center, which is the office's, and not the sign-in page.
 */
export function isPortalAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const path = pathOf(address);
  return path === "/portal" || path.startsWith("/portal/");
}

/**
 * What a back arrow does from here.
 *
 *  - "back": the step behind is a portal page — take it, exactly as the
 *    phone's Back would, so the words searched, the tab and the place in the
 *    list come back with it.
 *  - "open": nothing of the portal is behind — open the fallback instead.
 *
 * With a named `target` ("back to all posts") the step is taken only when
 * the page behind is that page; otherwise the target is opened.
 */
export function backStep(from: string | null, target?: string): "back" | "open" {
  if (!isPortalAddress(from)) return "open";
  if (target && pathOf(from!) !== pathOf(target)) return "open";
  return "back";
}

/** Is this entry the open layer with this id? */
export function isLayerEntry(state: unknown, id: string): boolean {
  return asRecord(state)[LAYER_KEY] === id;
}

/** The state for a fresh step that opens a layer over the page. */
export function withLayer(state: unknown, id: string): Record<string, unknown> {
  return { ...asRecord(state), [LAYER_KEY]: id };
}

// ---------------------------------------------------------------------------
// The listener. wouter patches history.pushState / replaceState to announce
// themselves as window events of the same names; every push — a page, the
// search sheet, a layer — is stamped with the address it was pushed from.
// ---------------------------------------------------------------------------

let installed = false;
/** The address on screen now. */
let here = "";
/** Where the entry on screen now was stepped to from. */
let hereFrom: string | null = null;

const currentAddress = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

/** Where the entry on screen was stepped to from — read by the back arrows. */
export function currentStepFrom(): string | null {
  if (typeof window === "undefined") return null;
  return installed ? hereFrom : readStepFrom(window.history.state);
}

export function installHistorySteps(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  here = currentAddress();
  // A reload keeps each entry's state: the stamp is still there. A fresh
  // visit has none — nothing of ours is behind it.
  hereFrom = readStepFrom(window.history.state);

  const stamp = () => {
    if (readStepFrom(window.history.state) !== hereFrom) {
      window.history.replaceState(withStepFrom(window.history.state, hereFrom), "");
    }
  };

  window.addEventListener("pushState", () => {
    hereFrom = here;
    here = currentAddress();
    stamp();
  });
  // A replacement keeps its place in the history — and so where it came
  // from — but may have wiped the stamp (`replaceState(null, …)`).
  window.addEventListener("replaceState", () => {
    here = currentAddress();
    stamp();
  });
  window.addEventListener("popstate", () => {
    here = currentAddress();
    hereFrom = readStepFrom(window.history.state);
  });
}
