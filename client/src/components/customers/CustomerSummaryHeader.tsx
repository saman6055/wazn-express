import type React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

interface CustomerSummaryHeaderProps {
  totalOrders?: number;
  balance?: number;
  /** Where the balance was counted from: its chip opens it (the customer's account). */
  balanceHref?: string;
  currency?: string;
  lastActivity?: string;
  createdAt?: string;
  extra?: { label: string; value: React.ReactNode }[];
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-GB");
}

interface Chip {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  href?: string;
}

export function CustomerSummaryHeader({
  totalOrders,
  balance,
  balanceHref,
  currency = "USD",
  lastActivity,
  createdAt,
  extra,
}: CustomerSummaryHeaderProps) {
  const { t } = useTranslation();

  const chips: Chip[] = [];

  if (totalOrders !== undefined) {
    chips.push({
      label: t("customers.totalPackages") || "Total Orders",
      value: totalOrders,
    });
  }

  if (balance !== undefined) {
    const owed = balance > 0;
    const credit = balance < 0;
    const symbol = currency === "USD" ? "$" : "";
    chips.push({
      label: t("customers.balance") || "Balance",
      value: `${symbol}${Math.abs(balance).toFixed(2)}${symbol ? "" : ` ${currency}`}`,
      valueClassName: owed
        ? "text-red-600 dark:text-red-400"
        : credit
          ? "text-green-600 dark:text-green-400"
          : undefined,
      href: balanceHref,
    });
  }

  const lastActivityFormatted = formatDate(lastActivity);
  if (lastActivityFormatted !== undefined) {
    chips.push({
      label: t("customers.lastActivity") || "Last Activity",
      value: lastActivityFormatted,
    });
  }

  const createdAtFormatted = formatDate(createdAt);
  if (createdAtFormatted !== undefined) {
    chips.push({
      label: t("customers.customerSince") || "Customer Since",
      value: createdAtFormatted,
    });
  }

  if (extra) {
    for (const item of extra) {
      if (item.value !== undefined) {
        chips.push({ label: item.label, value: item.value });
      }
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {chips.map((chip, i) => {
        const body = (
          <>
            <span className="text-xs font-medium text-muted-foreground">{chip.label}</span>
            <span className={cn("text-base font-bold leading-tight", chip.valueClassName)}>
              {chip.value}
            </span>
          </>
        );
        const box = "flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm";
        // A figure that stands for records opens them (owner, 2026-09-22).
        return chip.href ? (
          <Link key={i} href={chip.href} className={cn(box, "transition hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")} data-testid="summary-balance-link">
            {body}
          </Link>
        ) : (
          <div key={i} className={box}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
