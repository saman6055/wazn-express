/**
 * Wazn Express service worker.
 *
 * This file existed only as a registration call — main.tsx has asked for
 * /sw.js on every load since the PWA work landed, and every load got a 404.
 * Two things quietly depended on it and were dead the whole time: web push
 * (usePushSubscription awaits `serviceWorker.ready`, which never resolved)
 * and, on older Android WebViews, installability itself.
 *
 * Deliberately does NOT cache or intercept any fetch. A cached app shell
 * outlives deploys, and this system ships fixes that the owner redeploys the
 * same day — a stale shell serving last week's money rules is a worse bug
 * than no offline support. The app is useless offline anyway (all data is
 * remote); the worker exists for installability and push, nothing more.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Page loads only, straight to the network — nothing is cached, for the
 * reason above. Chrome on many Android phones will not offer "Install app"
 * for a site whose worker has no fetch handler at all (the owner, 2026-09-28:
 * «لە کرۆمیش داوا ناکات»), and a handler that never answers is treated as
 * none. So navigations are answered: from the network, and when there is no
 * network, with a one-line page saying so instead of the browser's dinosaur.
 * Every other request (scripts, API, images) is left alone.
 */
const OFFLINE_PAGE = `<!doctype html><html lang="ku" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wazn Express</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:700;margin:0 0 8px">ئینتەرنێت نییە</p>
<p style="margin:0 0 16px;color:#94a3b8">پەیوەندی ئینتەرنێت بپشکنە، پاشان دووبارە هەوڵ بدەرەوە.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 20px;border-radius:12px;border:0;background:#0ea5e9;color:#fff">دووبارە هەوڵ بدەرەوە</button></div>
</body></html>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});

/**
 * Push payload contract: `{ title, body, url }` — exactly what
 * server/services/push.service.ts sends (bodyFor / campaign sender).
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Wazn Express";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      dir: "rtl",
      data: { url: data.url || "/portal" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/portal";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
