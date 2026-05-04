import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY_DISMISSED = "wazn_push_dismissed_at";
const DISMISS_COOLDOWN_DAYS = 7;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function getPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/mac/i.test(ua)) return "mac";
  if (/win/i.test(ua)) return "windows";
  if (/linux/i.test(ua)) return "linux";
  return "unknown";
}

function isRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const at = window.localStorage.getItem(STORAGE_KEY_DISMISSED);
  if (!at) return false;
  const dismissed = Number(at);
  if (!Number.isFinite(dismissed)) return false;
  const ageMs = Date.now() - dismissed;
  return ageMs < DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

export function usePushSubscription(opts: { enabled: boolean }) {
  const [permission, setPermission] = useState<PushPermissionState>(() => {
    if (!isPushSupported()) return "unsupported";
    return Notification.permission as PushPermissionState;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const publicKeyQuery = trpc.customerPortal.getPushPublicKey.useQuery(undefined, {
    enabled: opts.enabled && isPushSupported(),
    staleTime: 60 * 60 * 1000,
  });

  const subscribeMutation = trpc.customerPortal.subscribePush.useMutation();
  const unsubscribeMutation = trpc.customerPortal.unsubscribePush.useMutation();
  const testPushMutation = trpc.customerPortal.sendTestPush.useMutation();

  // Sync current subscription state on mount/after permission change.
  useEffect(() => {
    if (!opts.enabled || !isPushSupported()) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(!!sub);
      } catch {
        // SW not ready yet — leave state as-is.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts.enabled, permission]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    const publicKey = publicKeyQuery.data?.publicKey;
    const enabled = publicKeyQuery.data?.enabled;
    if (!publicKey || !enabled) return false;

    setIsWorking(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);
      if (result !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 500),
        platform: getPlatform(),
        language: navigator.language?.slice(0, 10),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[Push] subscribe failed", err);
      return false;
    } finally {
      setIsWorking(false);
    }
  }, [publicKeyQuery.data, subscribeMutation]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    setIsWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return true;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await unsubscribeMutation.mutateAsync({ endpoint });
      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("[Push] unsubscribe failed", err);
      return false;
    } finally {
      setIsWorking(false);
    }
  }, [unsubscribeMutation]);

  const sendTest = useCallback(async () => {
    return testPushMutation.mutateAsync();
  }, [testPushMutation]);

  const dismissPrompt = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now()));
    }
  }, []);

  const shouldPrompt =
    opts.enabled &&
    isPushSupported() &&
    publicKeyQuery.data?.enabled === true &&
    permission === "default" &&
    !isSubscribed &&
    !isRecentlyDismissed();

  return {
    permission,
    isSupported: isPushSupported(),
    isEnabledOnServer: publicKeyQuery.data?.enabled === true,
    isSubscribed,
    isWorking,
    shouldPrompt,
    subscribe,
    unsubscribe,
    sendTest,
    dismissPrompt,
  };
}
