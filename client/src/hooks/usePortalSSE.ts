import { useEffect, useRef, useCallback } from "react";

export type PortalSSEEvent =
  | { type: "package_status"; packageId: number; status: string; trackingNumber?: string }
  | { type: "new_invoice"; invoiceId: number; invoiceNumber: string }
  | { type: "payment_confirmation"; transactionId: number; amount: number };

/**
 * Subscribe to real-time portal notifications via Server-Sent Events.
 * Connect to /api/portal/events (or similar). Server must send JSON event objects.
 * On event: call onEvent callback. Optional onPackageStatus, onNewInvoice, onPayment.
 */
export function usePortalSSE(options: {
  onEvent?: (event: PortalSSEEvent) => void;
  onPackageStatus?: (data: { packageId: number; status: string; trackingNumber?: string }) => void;
  onNewInvoice?: (data: { invoiceId: number; invoiceNumber: string }) => void;
  onPaymentConfirmation?: (data: { transactionId: number; amount: number }) => void;
  enabled?: boolean;
}) {
  const { onEvent, onPackageStatus, onNewInvoice, onPaymentConfirmation, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PortalSSEEvent;
        onEvent?.(data);
        switch (data.type) {
          case "package_status":
            onPackageStatus?.({
              packageId: data.packageId,
              status: data.status,
              trackingNumber: data.trackingNumber,
            });
            break;
          case "new_invoice":
            onNewInvoice?.({ invoiceId: data.invoiceId, invoiceNumber: data.invoiceNumber });
            break;
          case "payment_confirmation":
            onPaymentConfirmation?.({ transactionId: data.transactionId, amount: data.amount });
            break;
        }
      } catch {
        // ignore parse errors
      }
    },
    [onEvent, onPackageStatus, onNewInvoice, onPaymentConfirmation]
  );

  useEffect(() => {
    if (!enabled) return;
    try {
      const url = "/api/portal/events";
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;
      es.onmessage = handleMessage;
      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
      return () => {
        es.close();
        eventSourceRef.current = null;
      };
    } catch {
      eventSourceRef.current = null;
    }
  }, [enabled, handleMessage]);
}
