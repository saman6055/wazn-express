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
function toError(error: unknown, fallbackMessage?: string): Error {
  return error instanceof Error
    ? error
    : new Error(
        typeof error === "string"
          ? error
          : ((error as { message?: string } | null)?.message ?? fallbackMessage ?? ""),
      );
}

/**
 * The same report, for a failure that is shown in the page rather than in a
 * toast — a read that did not come back, where an empty screen would
 * otherwise read as an answer.
 */
export function copyErrorReport(error: unknown) {
  const report = buildErrorReport(toError(error));
  const { copyDetails, copied } = getErrorBoundaryStrings();
  navigator.clipboard
    .writeText(report)
    .then(() => toast.success(copied))
    .catch(() => window.prompt(copyDetails, report));
}

export function showErrorToast(error: unknown, fallbackMessage?: string) {
  const err = toError(error, fallbackMessage);

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
