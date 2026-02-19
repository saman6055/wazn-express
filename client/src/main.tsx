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
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true, // Let QueryErrorBoundary catch tRPC query errors
      staleTime: 2 * 60 * 1000, // 2 min – reduce refetches that can fail after cookie issues
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry auth errors (redirect will happen)
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("Invalid session") || msg.includes("Please login") || msg.includes("session cookie")) return false;
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
    (error instanceof TRPCClientError && (error.data?.code === "UNAUTHORIZED" || error.data?.code === "FORBIDDEN"));

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
      async fetch(input, init) {
        const res = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text();
          let msg: string;
          try {
            const json = JSON.parse(text);
            msg = json?.error ?? json?.message ?? res.statusText;
          } catch {
            msg = res.status === 429 ? "Too many requests. Please try again later." : res.statusText || "Request failed";
          }
          throw new Error(msg);
        }
        return res;
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
