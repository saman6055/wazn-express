import { toast } from "sonner";
import { buildErrorReport, getErrorBoundaryStrings } from "@/components/ErrorBoundary";

/**
 * A failed action has to be readable and reportable.
 *
 * The toast clamps its text to two lines on purpose — a serialized payload in
 * a message once covered the whole page. But a database error carries the
 * reason at the *end*: "insert into `expenses` (`id`, `categoryId`, ..." is
 * the query, and "Unknown column 'x'" comes after it, past the clamp. So the
 * office saw a wall of column names and no cause, and could not tell anyone
 * what had actually gone wrong.
 *
 * Same report the error screens use, on a button, next to the message.
 */
export function showErrorToast(error: unknown, fallbackMessage?: string) {
  const err =
    error instanceof Error
      ? error
      : new Error(
          typeof error === "string"
            ? error
            : ((error as { message?: string } | null)?.message ?? fallbackMessage ?? ""),
        );

  const message = err.message || fallbackMessage || "";
  const report = buildErrorReport(err);
  const { copyDetails, copied } = getErrorBoundaryStrings();

  toast.error(message, {
    // Long enough to read the message and reach for the button.
    duration: 15000,
    action: {
      label: copyDetails,
      onClick: () => {
        navigator.clipboard
          .writeText(report)
          .then(() => toast.success(copied))
          // Clipboard can be refused (insecure context, denied permission).
          // Falling back to a selectable alert beats silently doing nothing.
          .catch(() => window.prompt(copyDetails, report));
      },
    },
  });
}
