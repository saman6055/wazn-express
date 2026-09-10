import { useTranslation } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Subscribes to the mutation cache and shows global toasts on success/error.
 * Uses translation for success ("errors.operationSuccess") and shows error.message on failure.
 * To skip the global toast for a mutation that shows its own, pass meta: { skipGlobalToast: true }.
 *
 * One toast per action, not two. Most pages say what happened in their own
 * words, and only one mutation in the app opted out of this global toast, so
 * a scan, a payment or a save put two toasts on screen — the page's and a
 * generic "operation successful" under it. The handler now notes how many
 * toasts exist when an action starts, waits a moment for the page's own
 * onSuccess/onError (including the ones passed to mutate(), which run after
 * the cache hears the result), and stays quiet if the page has spoken.
 */
const SETTLE_MS = 60;

export function MutationToastHandler() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const cache = queryClient.getMutationCache();
    // mutationId → toast count when the action started.
    const startCounts = new Map<number, number>();
    const timers = new Set<number>();

    const unsubscribe = cache.subscribe((event) => {
      if (event.type !== "updated") return;
      const mutation = event.mutation;
      const state = mutation.state;
      const status = state.status;

      const skipGlobalToast = (mutation.options.meta as { skipGlobalToast?: boolean } | undefined)?.skipGlobalToast;
      if (skipGlobalToast) return;

      if (status === "pending") {
        if (!startCounts.has(mutation.mutationId)) {
          startCounts.set(mutation.mutationId, toast.getHistory().length);
        }
        return;
      }
      if (status !== "success" && status !== "error") return;

      const before = startCounts.get(mutation.mutationId);
      startCounts.delete(mutation.mutationId);

      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!mounted.current) return;
        // The page already said something about this action.
        if (before !== undefined && toast.getHistory().length > before) return;

        if (status === "success") {
          // Customer portal: no generic success toast. Every route change fires
          // background mutations (activity tracking), so this toasted on every
          // move; portal flows that matter show their own specific toasts.
          if (window.location.pathname.startsWith("/portal")) return;
          toast.success(t("errors.operationSuccess"));
        } else {
          const error = state.error;
          const message = error instanceof Error ? error.message : t("errors.operationFailed");
          toast.error(message);
        }
      }, SETTLE_MS);
      timers.add(timer);
    });

    return () => {
      mounted.current = false;
      unsubscribe();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      startCounts.clear();
    };
  }, [queryClient, t]);

  return null;
}
