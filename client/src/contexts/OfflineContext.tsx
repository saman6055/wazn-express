import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  addPending: () => void;
  clearPending: () => void;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message?.toLowerCase() ?? "";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) return true;
  if ("cause" in error && error.cause instanceof Error) {
    const c = (error.cause as Error).message?.toLowerCase() ?? "";
    return c.includes("network") || c.includes("fetch") || false;
  }
  return false;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);
  const prevOnline = useRef(isOnline);

  const addPending = useCallback(() => {
    setPendingCount((n) => n + 1);
  }, []);

  const clearPending = useCallback(() => {
    setPendingCount(0);
  }, []);

  // Listen online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // When back online: toast and clear pending
  useEffect(() => {
    if (isOnline && !prevOnline.current) {
      if (pendingCount > 0) {
        toast.info(t("errors.backOnline"));
      }
      setPendingCount(0);
    }
    prevOnline.current = isOnline;
  }, [isOnline, pendingCount, t]);

  // Subscribe to mutation cache: on error while offline, add pending
  useEffect(() => {
    const cache = queryClient.getMutationCache();
    const unsub = cache.subscribe((event) => {
      if (event.type !== "updated") return;
      const mutation = event.mutation;
      if (mutation.state.status === "error" && !navigator.onLine) {
        const err = mutation.state.error;
        if (isLikelyNetworkError(err)) {
          setPendingCount((n) => n + 1);
        }
      }
    });
    return unsub;
  }, [queryClient]);

  const value: OfflineContextValue = {
    isOnline,
    pendingCount,
    addPending,
    clearPending,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (ctx === undefined) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return ctx;
}
