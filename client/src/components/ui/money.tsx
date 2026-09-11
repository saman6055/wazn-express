import { cn } from "@/lib/utils";
import { NO_VALUE, unsignedZero } from "@/lib/portalFormat";

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

/**
 * The text of an amount.
 *
 * - A missing or broken value is a dash. It printed "$0", which reads as a
 *   real, settled zero.
 * - A negative amount is "-$500", the way the currency style writes it; the
 *   prefix form printed "$-500".
 * - Nothing that rounds to zero carries a minus sign ("$-0").
 */
export function formatMoney(
  value: number | null | undefined,
  { currency, prefix = "$", decimals = 0 }: { currency?: string; prefix?: string; decimals?: number } = {},
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return NO_VALUE;
  if (currency) {
    return unsignedZero(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value),
    );
  }
  const digits = unsignedZero(
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value),
  );
  return digits.startsWith("-") ? `-${prefix}${digits.slice(1)}` : `${prefix}${digits}`;
}

export function Money({
  value,
  currency,
  prefix = "$",
  decimals = 0,
  debt = false,
  className,
}: MoneyProps) {
  const formatted = formatMoney(value, { currency, prefix, decimals });
  const isNegative = formatted.startsWith("-");

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
