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
  /**
   * Show it, say it loudly, and get out of the way after this many
   * milliseconds — no backdrop, no button, no focus taken.
   *
   * For the failures that are part of the work rather than a mistake in it.
   * A tracking that is not in the system is exactly what quick register
   * expects to meet: the parcel is new, and the operator is about to
   * register it. Making them dismiss that is asking for a click per parcel,
   * which is how the dialog everywhere else stops being read.
   *
   * Never set this on something that loses goods or money. Those have to be
   * acknowledged.
   */
  autoDismissMs?: number;
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
    if (current.autoDismissMs) {
      // A quiet single tone, not the two-tone siren. This one is not an
      // emergency — it is the ordinary answer to an ordinary question, and a
      // siren for it teaches the operator to stop hearing the siren.
      soundManager.playNotice();
      return; // and never pull the caret out of a scan box
    }
    soundManager.playAlert();
    // After the sound, not before: the button must exist to be focused.
    const id = window.setTimeout(() => okRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [current]);

  // A transient notice takes itself away. Keyed on the request object so a
  // second one arriving mid-countdown gets its own full span.
  useEffect(() => {
    if (!current?.autoDismissMs) return;
    const id = window.setTimeout(dismiss, current.autoDismissMs);
    return () => window.clearTimeout(id);
  }, [current, dismiss]);

  // Enter and Escape both dismiss. A hand already on the keyboard should not
  // have to find the mouse, and both keys mean "I have read it".
  useEffect(() => {
    if (!current || current.autoDismissMs) return;
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
          role={current.autoDismissMs ? "status" : "alertdialog"}
          aria-modal={current.autoDismissMs ? undefined : "true"}
          aria-live={current.autoDismissMs ? "assertive" : undefined}
          aria-labelledby="system-alert-title"
          data-testid="system-alert"
          data-transient={current.autoDismissMs ? "true" : undefined}
          className={cn(
            "fixed z-[100] flex p-4",
            current.autoDismissMs
              ? // No backdrop and no pointer capture: the caret stays in the
                // scan box and the gun keeps firing underneath it.
                "inset-x-0 top-0 justify-center pointer-events-none"
              : "inset-0 items-center justify-center bg-black/60",
          )}
          onMouseDown={(e) => {
            if (current.autoDismissMs) return;
            // Clicking the dark area dismisses too. Reaching a small button
            // is the last thing wanted from someone holding a parcel.
            if (e.target === e.currentTarget) dismiss();
          }}
        >
          <div
            dir="rtl"
            className={cn(
              "overflow-hidden border bg-card",
              current.autoDismissMs
                ? // Plain and small: a line of text that appears, is read
                  // without stopping, and goes. Anything grander here reads
                  // as a fault, and this is not one.
                  "pointer-events-auto w-auto max-w-lg rounded-lg shadow-md animate-in fade-in slide-in-from-top-2"
                : "w-full max-w-md rounded-xl shadow-2xl",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3",
                current.autoDismissMs ? "px-4 py-3" : "border-b p-5",
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full",
                  current.autoDismissMs ? "h-8 w-8" : "h-14 w-14",
                  current.kind === "warning"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                    : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400",
                )}
              >
                {current.kind === "warning" ? (
                  <AlertTriangle className={current.autoDismissMs ? "h-4 w-4" : "h-7 w-7"} />
                ) : (
                  <XCircle className={current.autoDismissMs ? "h-4 w-4" : "h-7 w-7"} />
                )}
              </span>
              <h2
                id="system-alert-title"
                className={cn(
                  "leading-snug",
                  current.autoDismissMs ? "text-sm font-medium" : "text-lg font-semibold",
                )}
              >
                {current.title}
              </h2>
              {/* The tracking sits on the same line: it is what identifies
                  the parcel, and a second line for it makes a banner. */}
              {current.autoDismissMs && current.detail && (
                <span
                  dir="ltr"
                  className="ms-auto shrink-0 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
                >
                  {current.detail}
                </span>
              )}
            </div>

            {/* Compact, but nothing the caller passed is thrown away: the
                sentence that says what to do next is the reason the notice
                is worth showing at all. */}
            {current.autoDismissMs && current.message && (
              <p className="px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
                {current.message}
              </p>
            )}

            {!current.autoDismissMs && (current.message || current.detail) && (
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

            {!current.autoDismissMs && (
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
            )}
          </div>
        </div>
      )}
    </SystemAlertContext.Provider>
  );
}
