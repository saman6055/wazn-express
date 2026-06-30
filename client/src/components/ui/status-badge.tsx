import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

export type StatusKind = "order" | "package" | "batch" | "payment";

type Tone = "green" | "blue" | "amber" | "red" | "gray";

const TONE_CLASSES: Record<Tone, string> = {
  green:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  gray: "bg-muted text-muted-foreground",
};

// Maps the real status values used across the app (see grep of
// `status === "..."` in client/src/pages) to a colour tone.
const STATUS_TONE: Record<string, Tone> = {
  // green — done / paid / success
  delivered: "green",
  completed: "green",
  closed: "green",
  paid: "green",
  approved: "green",
  resolved: "green",
  active: "green",
  published: "green",
  success: "green",
  good: "green",
  moved: "green",
  received: "green",
  ordered: "green",
  // blue — in progress / moving
  in_transit: "blue",
  on_route: "blue",
  out_for_delivery: "blue",
  ready_for_delivery: "blue",
  ready: "blue",
  in_progress: "blue",
  arrived: "blue",
  customs: "blue",
  open: "blue",
  issued: "blue",
  scheduled: "blue",
  // amber — pending / preparing / partial
  pending: "amber",
  pending_quote: "amber",
  preparing: "amber",
  draft: "amber",
  partially_paid: "amber",
  warning: "amber",
  unclaimed: "amber",
  // red — problem / cancelled / unpaid
  cancelled: "red",
  canceled: "red",
  returned: "red",
  failed: "red",
  error: "red",
  overdue: "red",
  unpaid: "red",
  critical: "red",
};

function humanize(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStatusMeta(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase().trim();
  const tone: Tone = STATUS_TONE[value] ?? "gray";
  return {
    value,
    tone,
    className: TONE_CLASSES[tone],
    fallbackLabel: value ? humanize(value) : "—",
  };
}

interface StatusBadgeProps {
  status: string | null | undefined;
  kind?: StatusKind;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const meta = getStatusMeta(status);
  const label = meta.value
    ? t(`status.${meta.value}`) || meta.fallbackLabel
    : meta.fallbackLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
