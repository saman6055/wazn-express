import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/soundManager";

/**
 * A failure the operator has to acknowledge.
 *
 * A toast in the corner is right for "saved". It is wrong for "that tracking
 * number does not exist": on a warehouse screen at arm's length, with a
 * compressor running and a box in both hands, a small notice in the corner
 * with a quiet tone is not read and not heard. The parcel goes on the shelf
 * unregistered and nobody learns otherwise until the customer asks.
 *
 * So a failure takes the middle of the screen, dims everything behind it,
 * makes a noise loud enough to carry, and stays until somebody presses OK.
 * That is the whole design, and it is old for a reason.
 *
 * Successes are deliberately NOT routed here. Two hundred parcels is two
 * hundred dismissals, and a dialog that fires on everything is one nobody
 * reads — which is exactly the state this exists to fix.
 */

export type SystemAlertKind = "error" | "warning";

export interface SystemAlertRequest {
  kind?: SystemAlertKind;
  title: string;
  /** The sentence under the title. Optional: some failures are their title. */
  message?: string;
  /** A tracking number, a code — shown in monospace so it can be read back. */
  detail?: string;
  /** Named so the button can say what happens, not just "OK". */
  actionLabel?: string;
}

type Ctx = (request: SystemAlertRequest) => void;

const SystemAlertContext = createContext<Ctx | null>(null);

/**
 * Raise a blocking alert from anywhere inside the provider.
 *
 * Returns a no-op outside it rather than throwing: a component rendered in a
 * test or a stray corner of the tree must not crash for want of a dialog.
 */
export function useSystemAlert(): Ctx {
  const ctx = useContext(SystemAlertContext);
  return ctx ?? (() => {});
}

export function SystemAlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<SystemAlertRequest[]>([]);
  const okRef = useRef<HTMLButtonElement | null>(null);
  const current = queue[0] ?? null;

  const show = useCallback((request: SystemAlertRequest) => {
    setQueue((q) => [...q, request]);
  }, []);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  // One noise per alert, when it appears. Queued alerts each get their own,
  // because each is a separate thing gone wrong.
  useEffect(() => {
    if (!current) return;
    soundManager.playAlert();
    // After the sound, not before: the button must exist to be focused.
    const id = window.setTimeout(() => okRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [current]);

  // Enter and Escape both dismiss. A hand already on the keyboard should not
  // have to find the mouse, and both keys mean "I have read it".
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current, dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <SystemAlertContext.Provider value={value}>
      {children}
      {current && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="system-alert-title"
          data-testid="system-alert"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            // Clicking the dark area dismisses too. Reaching a small button
            // is the last thing wanted from someone holding a parcel.
            if (e.target === e.currentTarget) dismiss();
          }}
        >
          <div
            dir="rtl"
            className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b p-5">
              <span
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
                  current.kind === "warning"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                    : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400",
                )}
              >
                {current.kind === "warning" ? (
                  <AlertTriangle className="h-7 w-7" />
                ) : (
                  <XCircle className="h-7 w-7" />
                )}
              </span>
              <h2 id="system-alert-title" className="text-lg font-semibold leading-snug">
                {current.title}
              </h2>
            </div>

            {(current.message || current.detail) && (
              <div className="space-y-3 p-5 text-[15px] leading-relaxed">
                {current.message && <p>{current.message}</p>}
                {current.detail && (
                  <p
                    dir="ltr"
                    className="rounded-md border bg-muted px-3 py-2 text-start font-mono text-sm"
                  >
                    {current.detail}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 border-t p-4">
              <Button ref={okRef} onClick={dismiss} className="px-10" data-testid="system-alert-ok">
                {current.actionLabel || "OK"}
              </Button>
              <span className="text-xs text-muted-foreground">Enter · Esc</span>
              {queue.length > 1 && (
                <span className="ms-auto text-xs text-muted-foreground">
                  {queue.length - 1}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </SystemAlertContext.Provider>
  );
}
