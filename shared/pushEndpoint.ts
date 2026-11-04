/**
 * Where a browser's push subscription may point.
 *
 * The server POSTs to whatever endpoint a subscription names, and a customer
 * could name any https address — the server would then knock on it on their
 * behalf (security audit, 2026-11-05). Real subscriptions only ever point at
 * the browsers' own push services, so those are the only hosts accepted.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge, Android
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari
];
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

export function isPushServiceEndpoint(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 500) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
}
