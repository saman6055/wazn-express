import { useCallback } from "react";
import { hasFix } from "@shared/fixAdvice";
import { useSystemAlert } from "@/components/SystemAlert";
import { showErrorToast } from "@/lib/errorToast";
import { buildErrorReport } from "@/components/ErrorBoundary";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * One way to show a failure, so that a refusal carrying its cure is actually
 * read.
 *
 * The owner's standing rule, 2026-09-24: every warning says the cause and the
 * steps to put it right, everywhere (shared/fixAdvice). Writing those steps
 * is only half of it — a toast clamps its text to two lines, so the steps
 * arrived on screen and were cut off below the fold, which is the same as not
 * writing them.
 *
 * So the shape of the failure decides where it is shown:
 *
 *  - It carries steps → the blocking window, where the lines are printed as
 *    lines and the person has to acknowledge them. There is something to do,
 *    and nobody does it from a notice that has already faded.
 *  - It does not → the toast, exactly as before, with its copy button.
 *
 * Either way a report can be copied, which is the other standing rule
 * (ErrorBoundary's buildErrorReport).
 */

const TITLE = {
  ku: "ئەنجام نەدرا",
  en: "Could not be done",
  ar: "تعذّر التنفيذ",
  zh: "无法完成",
};

function toError(error: unknown, fallback?: string): Error {
  if (error instanceof Error) return error;
  const message =
    typeof error === "string" ? error : ((error as { message?: string } | null)?.message ?? fallback ?? "");
  return new Error(message);
}

export interface FailureOptions {
  /** The heading, when the default "Could not be done" is too vague. */
  title?: string;
  /** Shown when the error carries no message of its own. */
  fallback?: string;
  /** A tracking number or a code, printed so it can be read back. */
  detail?: string;
  /** Where the record it names lives, so the alert can open it. */
  openHref?: string;
  openLabel?: string;
}

export function useFailure() {
  const systemAlert = useSystemAlert();
  const { language } = useTranslation();

  return useCallback(
    (error: unknown, options?: FailureOptions) => {
      const err = toError(error, options?.fallback);
      const message = err.message || options?.fallback || "";

      if (hasFix(message) || hasFix(message, "en")) {
        systemAlert({
          kind: "error",
          title: options?.title ?? pickLang(language, TITLE),
          message,
          detail: options?.detail,
          openHref: options?.openHref,
          openLabel: options?.openLabel,
          copyText: buildErrorReport(err),
        });
        return;
      }

      showErrorToast(err, options?.fallback);
    },
    [systemAlert, language],
  );
}
