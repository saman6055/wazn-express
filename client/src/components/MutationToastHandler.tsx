import { useTranslation } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Subscribes to the mutation cache and shows global toasts on success/error.
 * Uses translation for success ("errors.operationSuccess") and shows error.message on failure.
 * To skip the global toast for a mutation that shows its own, pass meta: { skipGlobalToast: true }.
 */
export function MutationToastHandler() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const cache = queryClient.getMutationCache();

    const unsubscribe = cache.subscribe((event) => {
      if (event.type !== "updated") return;
      const mutation = event.mutation;
      const state = mutation.state;
      const status = state.status;

      const skipGlobalToast = (mutation.options.meta as { skipGlobalToast?: boolean } | undefined)?.skipGlobalToast;
      if (skipGlobalToast) return;

      if (status === "success") {
        if (!mounted.current) return;
        toast.success(t("errors.operationSuccess"));
      } else if (status === "error") {
        if (!mounted.current) return;
        const error = state.error;
        const message = error instanceof Error ? error.message : t("errors.operationFailed");
        toast.error(message);
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [queryClient, t]);

  return null;
}
