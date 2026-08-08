import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * "Something went wrong" — the message the portal never had.
 *
 * Not one query in the portal checked `isError`. React Query sets `isLoading`
 * false on failure and leaves `data` undefined, so every list fell through to
 * its empty state: a customer whose phone lost signal for a second was told
 * they had no shipments, no transactions, no orders. The most alarming thing
 * the app can say, delivered confidently, for a dropped request — and with no
 * way to retry short of killing the app.
 *
 * Two shapes, because the customer can act on one of them: offline is
 * something they can fix, a server error is not.
 */
export function PortalErrorState({
  onRetry,
  isRetrying,
  compact,
  className,
}: {
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Inline inside a card rather than as a full section. */
  compact?: boolean;
  className?: string;
}) {
  const { language } = useTranslation();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  const title = offline
    ? pickLang(language, {
        ku: "ئینتەرنێت نییە",
        en: "You're offline",
        ar: "لا يوجد اتصال",
        zh: "网络已断开",
      })
    : pickLang(language, {
        ku: "نەتوانرا زانیارییەکان بهێنرێن",
        en: "Couldn't load this",
        ar: "تعذّر تحميل البيانات",
        zh: "加载失败",
      });

  const hint = offline
    ? pickLang(language, {
        ku: "پەیوەندییەکەت بپشکنە و دووبارە هەوڵ بدەرەوە.",
        en: "Check your connection and try again.",
        ar: "تحقّق من اتصالك وحاول مرة أخرى.",
        zh: "请检查网络后重试。",
      })
    : pickLang(language, {
        ku: "ئەمە هەڵەیەکی کاتییە — زانیارییەکانت لەدەست نەچووە.",
        en: "This is temporary — none of your data is lost.",
        ar: "هذه مشكلة مؤقتة — لم تفقد أي بيانات.",
        zh: "这是暂时问题，您的数据没有丢失。",
      });

  const retryLabel = pickLang(language, {
    ku: "دووبارە هەوڵ بدەرەوە",
    en: "Try again",
    ar: "إعادة المحاولة",
    zh: "重试",
  });

  const Icon = offline ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-amber-200 bg-amber-50 text-center dark:border-amber-900/60 dark:bg-amber-950/30",
        compact ? "p-4" : "p-8",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto mb-3 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}
      >
        <Icon className={cn("text-amber-600 dark:text-amber-400", compact ? "h-5 w-5" : "h-7 w-7")} />
      </div>

      <p className={cn("font-bold text-amber-900 dark:text-amber-200", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      <p className={cn("mt-1 text-amber-800/80 dark:text-amber-300/80", compact ? "text-xs" : "text-sm")}>
        {hint}
      </p>

      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          size={compact ? "sm" : "default"}
          className="mt-4 bg-amber-600 text-white hover:bg-amber-700"
        >
          <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
