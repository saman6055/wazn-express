import { useEffect, useRef, useCallback } from "react";

export type PortalSSEEvent =
  | { type: "package_status"; packageId: number; status: string; trackingNumber?: string }
  | { type: "new_invoice"; invoiceId: number; invoiceNumber: string }
  | { type: "payment_confirmation"; transactionId: number; amount: number }
  | { type: "notification"; notificationId: number; title: string; body: string };

/**
 * Subscribe to the portal's real-time event stream over SSE.
 *
 * The server endpoint at `/api/portal/events` authenticates the
 * customer session, then streams JSON events as they happen
 * (package status changes, new invoices, payment confirmations,
 * generic notifications). The browser EventSource auto-reconnects
 * when the network blips — we don't fight that, but we DO debounce
 * reconnect attempts when the server returns 401 so a stale session
 * can't put the browser in a tight retry loop hammering the endpoint.
 */
export function usePortalSSE(options: {
  onEvent?: (event: PortalSSEEvent) => void;
  onPackageStatus?: (data: { packageId: number; status: string; trackingNumber?: string }) => void;
  onNewInvoice?: (data: { invoiceId: number; invoiceNumber: string }) => void;
  onPaymentConfirmation?: (data: { transactionId: number; amount: number }) => void;
  onNotification?: (data: { notificationId: number; title: string; body: string }) => void;
  enabled?: boolean;
}) {
  const { onEvent, onPackageStatus, onNewInvoice, onPaymentConfirmation, onNotification, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const consecutiveErrorsRef = useRef(0);

  // Keep the latest callbacks in a ref so the connection effect below can stay
  // stable (deps: [enabled] only). Callers pass inline arrow functions that are
  // recreated every render; without this the EventSource would tear down and
  // reopen on EVERY re-render (e.g. every keystroke in the header search),
  // churning connections and starving the browser's ~6-per-domain pool.
  const callbacksRef = useRef({ onEvent, onPackageStatus, onNewInvoice, onPaymentConfirmation, onNotification });
  callbacksRef.current = { onEvent, onPackageStatus, onNewInvoice, onPaymentConfirmation, onNotification };

  const handleMessage = useCallback((e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as PortalSSEEvent;
      const cb = callbacksRef.current;
      cb.onEvent?.(data);
      switch (data.type) {
        case "package_status":
          cb.onPackageStatus?.({
            packageId: data.packageId,
            status: data.status,
            trackingNumber: data.trackingNumber,
          });
          break;
        case "new_invoice":
          cb.onNewInvoice?.({ invoiceId: data.invoiceId, invoiceNumber: data.invoiceNumber });
          break;
        case "payment_confirmation":
          cb.onPaymentConfirmation?.({ transactionId: data.transactionId, amount: data.amount });
          break;
        case "notification":
          cb.onNotification?.({
            notificationId: data.notificationId,
            title: data.title,
            body: data.body,
          });
          break;
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let reopenTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      try {
        const es = new EventSource("/api/portal/events", { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          consecutiveErrorsRef.current = 0;
        };
        es.onmessage = handleMessage;
        es.onerror = () => {
          // EventSource itself retries on network drops; we close it
          // here to take control of pacing. Backoff capped at 30s so
          // we don't hammer a sleeping server, with extra latency if
          // we keep failing (likely an auth/session issue).
          consecutiveErrorsRef.current += 1;
          es.close();
          eventSourceRef.current = null;
          const delay = Math.min(30_000, 2_000 * Math.pow(2, consecutiveErrorsRef.current - 1));
          reopenTimer = setTimeout(open, delay);
        };
      } catch {
        eventSourceRef.current = null;
      }
    };

    open();
    return () => {
      if (reopenTimer) clearTimeout(reopenTimer);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [enabled, handleMessage]);
}
