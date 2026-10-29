import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyErrorReport } from "@/lib/errorToast";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * A list that could not be read says so, in place of the list.
 *
 * Queries do not throw to the boundary (main.tsx: throwOnError false), so a
 * page that only checks `isLoading` and then `length === 0` showed "no
 * debtors", "no claims", "nothing waiting" when the request had failed —
 * and a person acts on an empty list. This card is the house error surface
 * in small: the cause, a copy button for the report, and a retry.
 */
export function QueryErrorNote({
  error,
  onRetry,
  className = "",
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { language } = useTranslation();
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900/60 dark:bg-red-950/30 ${className}`}
      data-testid="query-error-note"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-red-800 dark:text-red-200">
            {pickLang(language, {
              ku: "ئەم لیستە نەخوێنرایەوە — ئەوەی دەیبینیت تەواو نییە",
              en: "This list could not be loaded — what you see is not the whole picture",
              ar: "تعذّر تحميل هذه القائمة — ما تراه ليس الصورة الكاملة",
              zh: "无法加载此列表 — 显示的内容不完整",
            })}
          </p>
          {message && <p className="mt-1 break-words text-red-700/90 dark:text-red-300/90">{message}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                {pickLang(language, { ku: "دووبارە هەوڵ بدەرەوە", en: "Try again", ar: "أعد المحاولة", zh: "重试" })}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => copyErrorReport(error)}>
              <Copy className="h-3.5 w-3.5" />
              {pickLang(language, { ku: "کۆپی وردەکاری", en: "Copy details", ar: "نسخ التفاصيل", zh: "复制详情" })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
