import type { RiskLevel } from "@shared/riskRules";

/**
 * The colours of a risk level — red, amber, blue — for chips, borders and
 * the stripe on an alert card. The levels themselves are decided in
 * shared/riskRules; this only paints them, the same everywhere.
 */
export const RISK_CHIP: Record<RiskLevel, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  notice: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
};

export const RISK_BORDER: Record<RiskLevel, string> = {
  critical: "border-red-300/80 dark:border-red-800/70",
  high: "border-amber-300/80 dark:border-amber-800/70",
  notice: "border-sky-300/80 dark:border-sky-800/70",
};

export const RISK_STRIPE: Record<RiskLevel, string> = {
  critical: "bg-gradient-to-r from-red-500 to-rose-600",
  high: "bg-gradient-to-r from-amber-400 to-orange-500",
  notice: "bg-gradient-to-r from-sky-400 to-blue-500",
};

export const RISK_ICON: Record<RiskLevel, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-amber-600 dark:text-amber-400",
  notice: "text-sky-600 dark:text-sky-400",
};

export const RISK_DOT: Record<RiskLevel, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  notice: "bg-sky-500",
};
