import { cn } from "@/lib/utils";
import { PlatformBadge, platformColor } from "@/components/PlatformSelect";

/**
 * Read-only "which shop did this come from" chip.
 *
 * Used in the order tables and on the scan screen, where the platform is
 * context rather than something being chosen — so it shares the badge colours
 * with PlatformSelect but never opens a picker. Renders nothing when the order
 * has no platform, so legacy rows stay clean instead of showing a blank chip.
 */
export function PlatformChip({
  platform,
  size = "sm",
  className,
}: {
  platform: string | null | undefined;
  size?: "sm" | "xs";
  className?: string;
}) {
  const name = (platform ?? "").trim();
  if (!name) return null;

  const badge = size === "xs" ? 14 : 16;
  const color = platformColor(name);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium whitespace-nowrap",
        size === "xs" ? "text-[10px]" : "text-[11px]",
        className,
      )}
      style={{ borderColor: `${color}55`, background: `${color}14`, color }}
      title={name}
    >
      <PlatformBadge name={name} size={badge} />
      <span>{name}</span>
    </span>
  );
}
