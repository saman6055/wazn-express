import { cn } from "@/lib/utils";

interface MoneyProps {
  value: number | null | undefined;
  /** ISO currency code; when set, formats using Intl currency style. */
  currency?: string;
  /** Symbol/prefix to show before the number when no `currency` is given. */
  prefix?: string;
  /** Number of fraction digits. Defaults to 0. */
  decimals?: number;
  /** Apply muted/red styling when the value is negative (debt). */
  debt?: boolean;
  className?: string;
}

export function Money({
  value,
  currency,
  prefix = "$",
  decimals = 0,
  debt = false,
  className,
}: MoneyProps) {
  const num = typeof value === "number" && isFinite(value) ? value : 0;

  let formatted: string;
  if (currency) {
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } else {
    const n = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
    formatted = `${prefix}${n}`;
  }

  const isNegative = num < 0;

  return (
    // dir="ltr" keeps the currency symbol glued to the digits and stops the
    // amount from flipping in RTL layouts.
    <span
      dir="ltr"
      className={cn(
        "inline-block tabular-nums",
        debt && isNegative && "text-red-600 dark:text-red-400",
        className,
      )}
    >
      {formatted}
    </span>
  );
}

export default Money;
