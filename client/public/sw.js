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
