import { reportClientError } from "./lib/reportClientError";
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';

// Load Umami analytics only when configured (avoids malformed URL requests when env vars are missing)
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (analyticsEndpoint && analyticsWebsiteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.body.appendChild(script);
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { LANG_HEADER } from "@shared/errorMessages";
import { networkFault, storedLanguage } from "./lib/networkFault";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { buildErrorReport, getErrorBoundaryStrings } from "./components/ErrorBoundary";
import { getLoginUrl } from "./const";
import { loadLocale } from "@/lib/i18nRegistry";
import "./index.css";

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available
                console.log('[PWA] New content available, refresh to update');
                // Optionally show update notification
                if (window.confirm('نوێکردنەوەی نوێ بەردەستە. ئایا دەتەوێت نوێ بکەیتەوە؟')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}

// A page restored from the back-forward cache is a snapshot from before any
// sign-out that happened since: reload it, so Back after signing out never
// shows the account again.
window.addEventListener("pageshow", (event) => {
  if ((event as PageTransitionEvent).persisted) window.location.reload();
});

// After a deploy, a tab left open asks for the previous build's files, which
// are gone (the server now answers 404 for them instead of the page). Reload
// once onto the new build rather than show an error — at most once a minute,
// so a build that is genuinely broken still reaches the report screen.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("wazn-chunk-reload") || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem("wazn-chunk-reload", String(Date.now()));
  } catch {
    // Storage refused: reload once anyway.
  }
  reportClientError("chunk", (event as Event & { payload?: unknown }).payload);
  event.preventDefault();
  window.location.reload();
});

// Errors nothing caught still reach the team (see reportClientError).
window.addEventListener("error", (event) => reportClientError("unhandled", event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportClientError("rejection", event.reason));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: false, // Avoid one failed API from breaking whole app; handle errors per page
      staleTime: 2 * 60 * 1000, // 2 min – reduce refetches that can fail after cookie issues
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry auth errors (redirect will happen)
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("Invalid session") || msg.includes("Please login") || msg.includes("session cookie")) return false;
        // "Not found", "not allowed", "check your input": asking twice more only
        // kept the answer off the screen for three seconds.
        const status = (error as { data?: { httpStatus?: number } } | null)?.data?.httpStatus;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (typeof window === "undefined") return;

  const msg = error instanceof Error ? error.message : String(error ?? "");
  const isExplicitUnauth = error instanceof TRPCClientError && msg === UNAUTHED_ERR_MSG;
  const isSessionInvalid =
    msg.includes("Invalid session") ||
    msg.includes("session cookie") ||
    msg.includes("Please login") ||
    // ONLY UNAUTHORIZED means "no/expired session" → redirect to login.
    // NOT FORBIDDEN: that means the user IS authenticated but lacks
    // permission for this one procedure (e.g. a portal customer touching a
    // staff-only endpoint like settings.list). Redirecting on FORBIDDEN
    // force-logged-out portal customers the moment a page fired any
    // staff-scoped query — the production bug "لەناو پۆرتاڵی کریار
    // ... دەچیتە دەرەوە". QueryErrorBoundary already encodes this policy;
    // this global subscriber must match it.
    (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED");

  if (!isExplicitUnauth && !isSessionInvalid) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // Only job here: make sure cookies ride along with every request for
      // auth. Previously this fetch wrapper also tried to parse non-OK
      // responses and re-throw as a plain Error — but that logic was written
      // against tRPC v10's error shape, and with v11 + superjson the actual
      // response body is `[{error: {json: {message, data: {code, httpStatus}}}}]`.
      // The old parser always fell through to `res.statusText` (empty under
      // HTTP/2) and the plain Error had no `.data.code` — so every mutation
      // error surfaced as `{ message: "", data: undefined }` and the toast
      // code had to fall back to "UNKNOWN". Letting tRPC parse the response
      // natively gives us the real TRPCClientError with code, httpStatus,
      // and message populated correctly.
      //
      // The reader's language rides along too, so a server fault can be
      // described to a customer in their own words (shared/errorMessages).
      headers() {
        return { [LANG_HEADER]: storedLanguage() };
      },
      async fetch(input, init) {
        try {
          return await globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        } catch (err) {
          // An abort is react-query cancelling a request; it must stay one.
          if ((err as { name?: string } | null)?.name === "AbortError") throw err;
          throw networkFault(err);
        }
      },
    }),
  ],
});

/**
 * Fetch the reader's own language before mounting, and only that one.
 *
 * All four locale files used to be static imports — about 1 MB of JSON, close
 * to two thirds of the entry chunk, three quarters of it a language this
 * visitor will never read. Awaiting one file here keeps `t()` synchronous for
 * every component while the boot screen in index.html covers the wait, and
 * that wait is shorter than the one it replaces.
 */
async function mount() {
  const stored = (() => {
    try {
      return localStorage.getItem("wazn-express-language");
    } catch {
      return null;
    }
  })();
  const initial = (["ku", "en", "ar", "zh"] as const).find((l) => l === stored) ?? "ku";

  /**
   * Start the page's own chunk downloading beside the locale, not after it.
   *
   * Getting to a customer's shipments used to be four round trips in a line:
   * the entry chunk, then the locale it awaits, then React mounts and asks
   * for the route's chunk, then that chunk asks for the data. Two of those
   * four have nothing to say to each other, so they can happen at once.
   *
   * Deliberately fire-and-forget. If the preload fails the router will ask
   * for the same module a moment later and get the real error then; a boot
   * that dies because a speculative fetch failed would be a worse trade than
   * the wait it was trying to save.
   */
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const preload =
    path === "/portal" || path === "/portal/"
      ? import("./pages/portal/PortalHome")
      : path.startsWith("/portal/shipments")
        ? import("./pages/portal/PortalShipments")
        : path.startsWith("/portal/financial")
          ? import("./pages/portal/PortalFinancial")
          : null;
  preload?.catch(() => {});

  await loadLocale(initial);

  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * If the app fails before React mounts (the usual cause: the locale file
 * fetch in mount() failing right after a deploy), the visitor used to get a
 * boot screen that never went away — no message, nothing to send to support.
 * This renders the same report the in-app error screens show, with the same
 * copy-details button, using plain DOM because React never got to render.
 */
function renderMountFailure(error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  const root = document.getElementById("root");
  if (!root) return;
  const s = getErrorBoundaryStrings();
  const lang = (() => {
    try {
      return localStorage.getItem("wazn-express-language") || "ku";
    } catch {
      return "ku";
    }
  })();

  root.innerHTML = "";
  root.dir = ["ku", "ar"].includes(lang) ? "rtl" : "ltr";

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;font-family:system-ui,sans-serif;gap:12px;";

  const title = document.createElement("h2");
  title.textContent = s.title;
  title.style.cssText = "font-size:20px;font-weight:600;margin:0;";

  const desc = document.createElement("p");
  desc.textContent = s.description;
  desc.style.cssText = "font-size:14px;color:#6b7280;max-width:28rem;margin:0;";

  const details = document.createElement("pre");
  details.textContent = err.message;
  details.style.cssText =
    "font-size:12px;color:#6b7280;background:#f3f4f6;border-radius:8px;padding:12px;max-width:32rem;max-height:8rem;overflow:auto;white-space:pre-wrap;word-break:break-word;";

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;justify-content:center;";
  const buttonCss =
    "padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500;border:1px solid #e5e7eb;cursor:pointer;background:#fff;color:#111827;";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = s.tryAgain;
  retry.style.cssText = buttonCss + "background:#146c94;color:#fff;border-color:#146c94;";
  retry.addEventListener("click", () => window.location.reload());

  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = s.copyDetails;
  copy.style.cssText = buttonCss;
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(buildErrorReport(err)).then(() => {
      copy.textContent = s.copied;
      setTimeout(() => {
        copy.textContent = s.copyDetails;
      }, 2000);
    });
  });

  buttons.append(retry, copy);
  wrap.append(title, desc, details, buttons);
  root.appendChild(wrap);
}

mount().catch((error) => {
  console.error("[Mount] App failed to start:", error);
  renderMountFailure(error);
});
