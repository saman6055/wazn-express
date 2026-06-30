import { cn } from "@/lib/utils";

// Deterministic, dark-mode-safe tinted backgrounds. Same name -> same colour.
const PALETTE: string[] = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface InitialsAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function InitialsAvatar({
  name,
  size = 36,
  className,
}: InitialsAvatarProps) {
  const safeName = (name ?? "").trim();
  const tone = PALETTE[hash(safeName || "?") % PALETTE.length];
  const initials = getInitials(safeName);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none",
        tone,
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
      aria-hidden="true"
      title={safeName || undefined}
    >
      {initials}
    </span>
  );
}

export default InitialsAvatar;
