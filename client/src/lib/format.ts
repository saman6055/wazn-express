import { NO_VALUE, unsignedZero } from "./portalFormat";

/**
 * Centralized number and currency formatting for reports and dashboards.
 *
 * A value that is not a number prints a dash — never "$NaN" or "+Infinity%" —
 * and a value that rounds to zero carries no minus sign. A figure that was
 * never recorded is not the same as a real zero, so it no longer prints as
 * "$0.00" either.
 */
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export function formatCurrency(value: number): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  return unsignedZero(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n),
  );
}

export function formatNumber(value: number, decimals = 0): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  return unsignedZero(
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n),
  );
}

export function formatPercent(value: number, decimals = 1): string {
  const n = toNumber(value);
  if (n === null) return NO_VALUE;
  const fixed = unsignedZero(n.toFixed(decimals));
  // "+" only on a change that shows as more than zero.
  const sign = n > 0 && /[1-9]/.test(fixed) ? "+" : "";
  return `${sign}${fixed}%`;
}
