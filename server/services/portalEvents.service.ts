/**
 * Portal real-time event broker.
 *
 * The customer portal mounts `usePortalSSE` which opens an EventSource to
 * `/api/portal/events` on every page. Before this service existed, that
 * endpoint returned 404 — EventSource closed silently on the first error
 * and the portal got no real-time updates at all, just the per-tab tRPC
 * polling. This module provides:
 *
 *   1. A per-customer pubsub (EventEmitter) other server code can call
 *      `publishPortalEvent(customerId, event)` on whenever something
 *      worth showing the user happens (package status change, new
 *      invoice, payment confirmed).
 *
 *   2. A subscribe helper the Express SSE handler uses to attach the
 *      response stream to events for ONE specific customer and detach
 *      cleanly on disconnect — no listener leaks.
 *
 * Memory profile: O(connected customers). Each connection adds ONE
 * listener; closing the SSE stream removes it. Process-local — if the
 * server ever runs multiple instances, a Redis pub/sub adapter goes
 * here without changing call sites.
 */

import { EventEmitter } from "events";

export type PortalEvent =
  | { type: "package_status"; packageId: number; status: string; trackingNumber?: string }
  | { type: "new_invoice"; invoiceId: number; invoiceNumber: string }
  | { type: "payment_confirmation"; transactionId: number; amount: number }
  | { type: "notification"; notificationId: number; title: string; body: string }
  | { type: "news"; postId: number; title: string };

const emitter = new EventEmitter();
// Node's default of 10 is way too low for a portal with many concurrent
// customers; bump to a sane ceiling. Each connection adds one listener.
emitter.setMaxListeners(1000);

const channelFor = (customerId: number) => `portal:${customerId}`;
// One shared channel every connected customer also listens on — used for
// company-wide announcements (e.g. a new Wazn News post) that shouldn't
// require inserting a row per customer.
const BROADCAST_CHANNEL = "portal:broadcast";

/**
 * Publish an event to a specific customer. Safe to call from any server
 * code path; never throws. Silently no-ops if nobody is listening for
 * that customer right now (offline portal users).
 */
export function publishPortalEvent(customerId: number, event: PortalEvent): void {
  if (!customerId || !event) return;
  try {
    emitter.emit(channelFor(customerId), event);
  } catch {
    // Listeners shouldn't throw, but if one does we don't want a single
    // bad handler to take down whatever business operation triggered it.
  }
}

/**
 * Subscribe to a customer's event channel. Returns an unsubscribe fn.
 * The SSE handler calls this on connect and the returned fn on
 * `req.on('close')` so we don't leak listeners on dropped connections.
 */
export function subscribePortalEvents(
  customerId: number,
  handler: (event: PortalEvent) => void,
): () => void {
  const channel = channelFor(customerId);
  emitter.on(channel, handler);
  // Every connection also listens on the broadcast channel so company-wide
  // events reach all connected customers without a per-customer emit.
  emitter.on(BROADCAST_CHANNEL, handler);
  return () => {
    emitter.off(channel, handler);
    emitter.off(BROADCAST_CHANNEL, handler);
  };
}

/**
 * Broadcast an event to EVERY connected portal customer at once (no DB row).
 * Used for announcements like a freshly published Wazn News post.
 */
export function publishPortalBroadcast(event: PortalEvent): void {
  if (!event) return;
  try {
    emitter.emit(BROADCAST_CHANNEL, event);
  } catch {
    // A bad handler must not break the publish caller.
  }
}
