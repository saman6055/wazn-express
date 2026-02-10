import { useTranslation } from "@/contexts/LanguageContext";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface QueryErrorFallbackProps {
  error: Error;
  onRetry: () => void;
  isAuthError: boolean;
  isNotFound: boolean;
  isNetwork: boolean;
}

export function QueryErrorFallback({
  error,
  onRetry,
  isAuthError,
  isNotFound,
  isNetwork,
}: QueryErrorFallbackProps) {
  const { t } = useTranslation();

  const getTitle = () => {
    if (isAuthError) return t("errors.sessionExpiredPleaseLogin");
    if (isNotFound) return t("common.notFound");
    if (isNetwork) return t("errors.networkError");
    return t("errors.somethingWentWrong");
  };

  const getDescription = () => {
    if (isAuthError) return t("errors.redirectingToLogin");
    if (isNotFound) return t("errors.resourceNotFound");
    if (isNetwork) return t("errors.checkConnectionAndRetry");
    return error.message || t("common.error");
  };

  return (
    <div
      className="flex items-center justify-center min-h-[280px] p-6 bg-muted/30 rounded-lg"
      dir="rtl"
    >
      <div className="flex flex-col items-center w-full max-w-md text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle size={28} className="text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {getTitle()}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {getDescription()}
        </p>
        {!isAuthError && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => { onRetry(); window.location.reload(); }}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              <RotateCcw size={16} />
              {t("common.tryAgain")}
            </button>
            <Link href="/">
              <a
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80"
                )}
              >
                <Home size={16} />
                {t("common.goHome")}
              </a>
            </Link>
          </div>
        )}
        {isAuthError && (
          <p className="text-sm text-muted-foreground">{t("errors.redirectingToLogin")}</p>
        )}
      </div>
    </div>
  );
}
