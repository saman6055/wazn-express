import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { statusTone, TONE_CHIP, type StatusKind, type Tone } from "@/lib/statusTone";

export type { StatusKind };

/**
 * A status as a pill. The colour comes from lib/statusTone — the one palette
 * the portal also uses — so a batch reads the same colour to the office and
 * to the customer. It had its own map before, and disagreed with the shared
 * one on preparing, arrived, customs, at_depot and ready_for_delivery.
 */

function humanize(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStatusMeta(status: string | null | undefined, kind?: StatusKind) {
  const value = (status ?? "").toLowerCase().trim();
  const tone: Tone = statusTone(value, kind);
  return {
    value,
    tone,
    className: TONE_CHIP[tone],
    fallbackLabel: value ? humanize(value) : "—",
  };
}

interface StatusBadgeProps {
  status: string | null | undefined;
  /** Lets one word mean two moments: an approved order is still in progress. */
  kind?: StatusKind;
  className?: string;
}

export function StatusBadge({ status, kind, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const meta = getStatusMeta(status, kind);
  // t() hands back the key itself when a word is missing, so «|| fallback»
  // never fired and the list printed «status.in_china_warehouse» (owner,
  // 2026-11-11). Order statuses live under fullPackage.status; look there
  // too, and show the readable fallback rather than a key.
  const word = (key: string) => {
    const v = t(key);
    return v && v !== key ? v : null;
  };
  const label = meta.value
    ? word(`status.${meta.value}`) ?? word(`fullPackage.status.${meta.value}`) ?? meta.fallbackLabel
    : meta.fallbackLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
