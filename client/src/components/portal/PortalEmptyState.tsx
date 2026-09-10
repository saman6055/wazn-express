import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Nothing here yet", said the same way on every screen.
 *
 * The portal had three grades of empty state: a designed one (icon,
 * sentence, a way forward), a bare grey sentence, and a section that simply
 * vanished. A customer meeting the second or third cannot tell "you have
 * none" from "this did not load". This is the first grade, as a component,
 * so the other two have no reason to exist.
 *
 * Presentation only. It never decides whether a list is empty; the screen
 * does, and hands it the words.
 */
export function PortalEmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
  compact,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  /** A button or link that leads somewhere useful, when there is one. */
  action?: ReactNode;
  /** Inside a card rather than as a full section. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white text-center dark:border-slate-700 dark:bg-slate-800",
        compact ? "p-6" : "p-8",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto mb-3 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700",
          compact ? "h-12 w-12" : "h-16 w-16",
        )}
      >
        <Icon className={cn("text-slate-400 dark:text-slate-500", compact ? "h-6 w-6" : "h-8 w-8")} />
      </div>
      <p className={cn("font-semibold text-slate-700 dark:text-slate-200", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      {hint && (
        <p className={cn("mt-1 text-slate-500 dark:text-slate-400", compact ? "text-xs" : "text-sm")}>
          {hint}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
