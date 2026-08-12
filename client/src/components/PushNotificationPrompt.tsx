import { useState } from "react";
import { Bell, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export function PushNotificationPrompt({ enabled }: { enabled: boolean }) {
  const { t } = useLanguage();
  const { shouldPrompt, isWorking, subscribe, dismissPrompt } = usePushSubscription({ enabled });
  const [hidden, setHidden] = useState(false);

  if (!shouldPrompt || hidden) return null;

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) setHidden(true);
  };

  const handleDismiss = () => {
    dismissPrompt();
    setHidden(true);
  };

  return (
    <div className="fixed bottom-20 start-3 end-3 z-40 mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-white/95 p-4 shadow-2xl backdrop-blur dark:bg-slate-900/95 sm:bottom-6 sm:start-auto sm:end-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 dark:text-emerald-400">
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("portal.pushPromptTitle")}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t("portal.pushPromptBody")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={isWorking}
              onClick={handleEnable}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {isWorking ? t("portal.pushEnabling") : t("portal.pushEnable")}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {t("portal.pushDismiss")}
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("portal.pushDismiss")}
          onClick={handleDismiss}
          className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
