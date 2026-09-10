import { useTranslation } from "@/contexts/LanguageContext";
import { AlertTriangle, RotateCcw, Home, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { buildErrorReport, getErrorBoundaryStrings } from "./ErrorBoundary";
import { copyText } from "@/lib/copyText";
import { errorRef, homePath, isServerMessage, showsTechnicalDetail } from "@/lib/errorSurface";

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
  const { t, direction } = useTranslation();
  const [copied, setCopied] = useState(false);
  // Same labels as the top-level error screen, so "copy details" reads
  // identically on every error screen regardless of which boundary caught it.
  const copyStrings = getErrorBoundaryStrings();

  const handleCopyDetails = () => {
    void copyText(buildErrorReport(error), copyStrings.copyDetails).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const technical = showsTechnicalDetail();
  const ref = errorRef(error);

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
    // A customer reads the server's own sentence — already written for them —
    // or a plain one; never a JavaScript error.
    if (!technical && !isServerMessage(error)) return copyStrings.description;
    return error.message || t("common.error");
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6 bg-muted/50"
      dir={direction}
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
        {!isAuthError && ref && (
          <p className="text-xs text-muted-foreground mb-4" dir="ltr">
            Ref: <span className="font-mono">{ref}</span>
          </p>
        )}
        {!isAuthError && technical && (
          <div className="w-full max-h-32 overflow-auto rounded-lg bg-muted p-3 mb-6 text-start">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-sans">
              {error.message}
            </pre>
          </div>
        )}
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
            <Link href={homePath()}>
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
            <button
              type="button"
              onClick={handleCopyDetails}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {copied ? (
                <Check size={16} className="text-green-600 dark:text-green-300" />
              ) : (
                <Copy size={16} />
              )}
              {copied ? copyStrings.copied : copyStrings.copyDetails}
            </button>
          </div>
        )}
        {isAuthError && (
          <p className="text-sm text-muted-foreground">{t("errors.redirectingToLogin")}</p>
        )}
      </div>
    </div>
  );
}
