import { Fragment } from "react";
import { AlertTriangle, FileText, Package, Percent, ShoppingCart, Sparkles } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import {
  CHARGE_KIND_LABELS,
  STATEMENT_TERM_LABELS,
  chargeKindsShown,
  statementTerms,
  type AccountStatement,
  type ChargeKind,
  type StatementTermKey,
} from "@shared/accountStatement";

/**
 * A customer's account on the staff profile: what was charged, by kind, and
 * the line that adds it up to the balance —
 *
 *     sales − paid − discounts ± other adjustments = balance
 *
 * The cards used to show "total sales" as every charge ever posted and "total
 * paid" as every credit, discounts included, so for AZ002 they read $390.49
 * and $112.39 beside a balance of $130.09, and nobody could get from one to
 * the other. The portal meanwhile said $87.19 paid. Now each figure appears
 * once, the line can be checked with a calculator, and the portal and the
 * statement PDF read the same statement (shared/accountStatement.ts).
 */

const KIND_LOOK: Record<ChargeKind, { icon: typeof Package; tile: string; figure: string }> = {
  package: {
    icon: Package,
    tile: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800/60",
    figure: "text-blue-600 dark:text-blue-300",
  },
  fullPackage: {
    icon: ShoppingCart,
    tile: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/60",
    figure: "text-emerald-600 dark:text-emerald-300",
  },
  purchaseRequest: {
    icon: FileText,
    tile: "bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-800/60",
    figure: "text-violet-600 dark:text-violet-300",
  },
  commission: {
    icon: Percent,
    tile: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-800/60",
    figure: "text-amber-600 dark:text-amber-300",
  },
  service: {
    icon: Sparkles,
    tile: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-800/60",
    figure: "text-pink-600 dark:text-pink-300",
  },
};

const TERM_TONE: Record<Exclude<StatementTermKey, "balance">, string> = {
  sales: "text-red-600 dark:text-red-300",
  payments: "text-emerald-600 dark:text-emerald-300",
  discounts: "text-emerald-600 dark:text-emerald-300",
  otherAdjustments: "text-slate-700 dark:text-slate-200",
};

/** The printed operator is ASCII in the data; on screen it gets a real minus. */
const OPERATOR_GLYPH = { "": "", "+": "+", "-": "−", "=": "=" } as const;

export function AccountStatementSummary({
  statement,
  driftUsd,
}: {
  statement: AccountStatement;
  /** The account's running figure minus what the statement adds up to. */
  driftUsd: number;
}) {
  const { language } = useTranslation();
  const kinds = chargeKindsShown(statement);
  const terms = statementTerms(statement);
  const storedBalanceUsd = Math.round((statement.balanceUsd + driftUsd) * 100) / 100;

  return (
    <div className="space-y-4">
      <div className={cn("grid grid-cols-2 gap-4", kinds.length > 4 ? "md:grid-cols-5" : "md:grid-cols-4")}>
        {kinds.map((kind) => {
          const look = KIND_LOOK[kind];
          const Icon = look.icon;
          return (
            <div key={kind} className={cn("text-center p-4 rounded-xl border", look.tile)}>
              <Icon className={cn("w-6 h-6 mx-auto mb-2", look.figure)} />
              <p className="text-xs text-muted-foreground mb-1">{pickLang(language, CHARGE_KIND_LABELS[kind])}</p>
              <p className={cn("text-lg font-bold tabular-nums", look.figure)} dir="ltr">
                {fmtUsd(statement.charges[kind])}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 rounded-xl border bg-muted/40 p-3"
        data-testid="statement-equation"
      >
        {terms.map((term) => (
          <Fragment key={term.key}>
            {term.operator && (
              <span className="text-xl font-semibold text-muted-foreground">{OPERATOR_GLYPH[term.operator]}</span>
            )}
            <div
              className={cn(
                "min-w-[6.5rem] rounded-lg px-3 py-2 text-center",
                term.key === "balance" && "border bg-background shadow-sm",
              )}
            >
              <p className="text-xs text-muted-foreground">{pickLang(language, STATEMENT_TERM_LABELS[term.key])}</p>
              <p
                className={cn(
                  "text-base font-bold tabular-nums",
                  term.key === "balance"
                    ? term.amountUsd > 0
                      ? "text-red-600 dark:text-red-300"
                      : term.amountUsd < 0
                        ? "text-sky-600 dark:text-sky-300"
                        : "text-emerald-600 dark:text-emerald-300"
                    : TERM_TONE[term.key],
                )}
                dir="ltr"
              >
                {fmtUsd(term.amountUsd)}
              </p>
            </div>
          </Fragment>
        ))}
      </div>

      {driftUsd !== 0 && (
        <p
          className="flex items-start justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {pickLang(language, {
              ku: `باڵانسی تۆمارکراوی حیسابەکە ${fmtUsd(storedBalanceUsd)}ە، بەڵام کۆی مامەڵەکانی ${fmtUsd(statement.balanceUsd)}ە — جیاوازی ${fmtUsd(driftUsd)}. پێش وەرگرتنی پارە بە ژمێریار بڵێ.`,
              en: `The account's stored balance is ${fmtUsd(storedBalanceUsd)}, but its transactions add up to ${fmtUsd(statement.balanceUsd)} — ${fmtUsd(driftUsd)} apart. Tell the accountant before taking money.`,
              ar: `الرصيد المسجّل للحساب ${fmtUsd(storedBalanceUsd)} لكن مجموع حركاته ${fmtUsd(statement.balanceUsd)} — الفرق ${fmtUsd(driftUsd)}. أبلغ المحاسب قبل استلام أي مبلغ.`,
              zh: `账户记录余额为 ${fmtUsd(storedBalanceUsd)}，但交易合计为 ${fmtUsd(statement.balanceUsd)}，相差 ${fmtUsd(driftUsd)}。收款前请告知会计。`,
            })}
          </span>
        </p>
      )}
    </div>
  );
}
