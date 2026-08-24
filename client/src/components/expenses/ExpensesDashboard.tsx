import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  CalendarDays,
  PieChart,
  Wallet,
  ArrowLeft,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * What the expenses screen reports, above the list it reports on.
 *
 * Every figure here answers two questions: how much, and compared with what.
 * A total on its own says nothing — $4,280 is either a quiet month or an
 * alarming one, and only the month before it can say which. So each figure
 * carries the same figure from the previous window of the same length.
 *
 * And every figure leads somewhere. A number the reader cannot open is a
 * number they have to take on trust; clicking a category or a supplier
 * filters the list underneath to exactly the rows behind it. The filtering
 * happens in the page's own state rather than through a link, so what the
 * reader lands on is always the rows that were counted — a link to an
 * unfiltered list is worse than no link, because it looks like an answer.
 */

export interface ExpensesDashboardData {
  period: { startDate: Date | string; endDate: Date | string };
  previousPeriod: { startDate: Date | string; endDate: Date | string };
  current: { totalAmount: number; byCategory: { categoryId: number; categoryName: string; total: number }[] };
  previous: { totalAmount: number; byCategory: { categoryId: number; categoryName: string; total: number }[] };
  daily: { date: string; total: number }[];
  previousDaily: { date: string; total: number }[];
  byVendor: { vendor: string; total: number; count: number }[];
  paymentSplit: { fromAccounts: number; outOfPocket: number };
  profit: { grossProfit: number; netProfit: number; expensesInPeriod: number };
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Percent change, or null when there is nothing to compare against. Growth
 *  from zero is not "infinite percent"; it is simply new spending. */
function changePercent(now: number, before: number): number | null {
  if (before <= 0) return null;
  return ((now - before) / before) * 100;
}

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  const { t } = useTranslation();
  const pct = changePercent(now, before);

  if (pct === null) {
    return (
      <span className="text-muted-foreground">
        {before === 0 && now > 0 ? t("expenses.noComparison") : "—"}
      </span>
    );
  }

  const rounded = Math.round(Math.abs(pct) * 10) / 10;
  if (rounded < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        {t("expenses.unchanged")}
      </span>
    );
  }

  // More spending is worse, so up is red — the opposite of a revenue figure.
  const up = pct > 0;
  const bad = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        bad ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      )}
    >
      <Icon className="h-3 w-3" />
      {rounded.toLocaleString()}%
    </span>
  );
}

function Figure({
  label,
  value,
  hint,
  icon,
  onClick,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  const interactive = Boolean(onClick);
  return (
    <Card
      data-testid={testId}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "transition-colors",
        interactive && "cursor-pointer hover:border-primary focus-visible:border-primary",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Spending per day, with the previous window behind it.
 *
 * Hand-drawn rather than charted: the shape is a row of bars and one dashed
 * line, and a charting library would bring a legend, a tooltip layer and a
 * second opinion about the axis for it.
 */
function TrendChart({
  daily,
  previousDaily,
  label,
  previousLabel,
}: {
  daily: { date: string; total: number }[];
  previousDaily: { date: string; total: number }[];
  label: string;
  previousLabel: string;
}) {
  const W = 720;
  const H = 150;
  const PAD = 8;

  const max = Math.max(
    1,
    ...daily.map((d) => d.total),
    ...previousDaily.map((d) => d.total),
  );
  const slots = Math.max(daily.length, previousDaily.length, 1);
  const step = (W - PAD * 2) / slots;
  const barW = Math.max(2, Math.min(22, step * 0.62));
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const previousPoints = previousDaily
    .map((d, i) => `${PAD + step * i + step / 2},${y(d.total)}`)
    .join(" ");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" strokeDasharray="3 3" strokeWidth="1.5" className="stroke-muted-foreground" />
          </svg>
          {previousLabel}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} — ${previousLabel}`}
      >
        {daily.map((d, i) => {
          const top = y(d.total);
          return (
            <rect
              key={d.date}
              x={PAD + step * i + (step - barW) / 2}
              y={top}
              width={barW}
              height={Math.max(1, H - PAD - top)}
              rx="2"
              className="fill-primary"
            >
              <title>{`${d.date} — ${money(d.total)}`}</title>
            </rect>
          );
        })}
        {previousDaily.length > 1 && (
          <polyline
            points={previousPoints}
            fill="none"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="stroke-muted-foreground"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <line x1="0" y1={H - PAD} x2={W} y2={H - PAD} strokeWidth="1" className="stroke-border" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function ExpensesDashboard({
  data,
  isLoading,
  daysInRange,
  onSelectCategory,
  onSelectVendor,
  onShowUnassigned,
  alertCount,
  onOpenAlerts,
}: {
  data?: ExpensesDashboardData;
  isLoading: boolean;
  daysInRange: number;
  onSelectCategory: (categoryId: number) => void;
  onSelectVendor: (vendor: string) => void;
  onShowUnassigned: () => void;
  alertCount: number;
  onOpenAlerts: () => void;
}) {
  const { t } = useTranslation();

  const previousByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of data?.previous.byCategory ?? []) map.set(c.categoryId, c.total);
    return map;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
    );
  }

  const total = data.current.totalAmount;
  const previousTotal = data.previous.totalAmount;
  const biggest = [...data.current.byCategory].sort((a, b) => b.total - a.total)[0];
  const grossProfit = data.profit.grossProfit;
  // A share of nothing is not zero percent, it is undefined — a period with no
  // revenue must not report that expenses ate 0% of the profit.
  const shareOfProfit = grossProfit > 0 ? (total / grossProfit) * 100 : null;
  const maxCategory = Math.max(1, ...data.current.byCategory.map((c) => c.total));

  return (
    <div className="space-y-4">
      {alertCount > 0 && (
        <button
          type="button"
          onClick={onOpenAlerts}
          data-testid="expenses-alert-strip"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-start text-sm transition-colors",
            "border-amber-300 dark:border-amber-900/60 hover:border-amber-500",
            "bg-amber-50 dark:bg-amber-950/40",
            "text-amber-900 dark:text-amber-200",
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("expenses.alertsTriggered", { count: alertCount })}</span>
          <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" />
        </button>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Figure
          testId="figure-total"
          label={t("expenses.totalExpenses")}
          value={money(total)}
          hint={
            <span className="inline-flex items-center gap-1">
              <Delta now={total} before={previousTotal} />
              <span>{t("expenses.vsPreviousPeriod")}</span>
            </span>
          }
          icon={<TrendingDown className="h-4 w-4" />}
        />

        <Figure
          testId="figure-share"
          label={t("expenses.shareOfProfit")}
          value={shareOfProfit === null ? "—" : `${shareOfProfit.toFixed(1)}%`}
          hint={
            shareOfProfit === null
              ? t("expenses.noProfitInPeriod")
              : t("expenses.shareOfProfitHint", { amount: shareOfProfit.toFixed(1) })
          }
          icon={<PieChart className="h-4 w-4" />}
        />

        <Figure
          testId="figure-daily"
          label={t("expenses.dailyAverage")}
          value={money(total / Math.max(1, daysInRange))}
          hint={t("expenses.overDays", { count: daysInRange })}
          icon={<CalendarDays className="h-4 w-4" />}
        />

        <Figure
          testId="figure-biggest"
          label={t("expenses.biggestCategory")}
          value={biggest ? biggest.categoryName : "—"}
          hint={
            biggest
              ? `${money(biggest.total)} — ${((biggest.total / Math.max(1, total)) * 100).toFixed(1)}%`
              : t("expenses.noExpensesFound")
          }
          icon={<ArrowLeft className="h-4 w-4 rtl:rotate-180" />}
          onClick={biggest ? () => onSelectCategory(biggest.categoryId) : undefined}
        />

        {/* Absence of an answer is not an answer. A row with no account is
            not "paid personally" — nobody wrote down where the money came
            from, and until somebody does, the Treasury cannot be reconciled
            against it. So the card names the gap and opens it. */}
        <Figure
          testId="figure-paid-from"
          label={t("expenses.leftTheAccounts")}
          value={money(data.paymentSplit.fromAccounts)}
          hint={
            data.paymentSplit.outOfPocket > 0
              ? t("expenses.unassignedHint", { amount: money(data.paymentSplit.outOfPocket) })
              : t("expenses.allAssigned")
          }
          icon={<Wallet className="h-4 w-4" />}
          onClick={data.paymentSplit.outOfPocket > 0 ? onShowUnassigned : undefined}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <TrendChart
            daily={data.daily}
            previousDaily={data.previousDaily}
            label={t("expenses.dailyTrend")}
            previousLabel={t("expenses.previousPeriod")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">{t("expenses.byCategoryWithChange")}</span>
              <span className="text-muted-foreground">{t("expenses.clickToFilter")}</span>
            </div>

            {data.current.byCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("expenses.noExpensesFound")}</p>
            ) : (
              <div className="space-y-1">
                {[...data.current.byCategory]
                  .sort((a, b) => b.total - a.total)
                  .map((cat) => (
                    <button
                      key={cat.categoryId}
                      type="button"
                      onClick={() => onSelectCategory(cat.categoryId)}
                      data-testid={`category-row-${cat.categoryId}`}
                      className="grid w-full grid-cols-[minmax(88px,1fr)_2fr_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted"
                    >
                      <span className="truncate">{cat.categoryName}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(cat.total / maxCategory) * 100}%` }}
                        />
                      </span>
                      <span className="tabular-nums">{money(cat.total)}</span>
                      <span className="w-20 text-end text-xs tabular-nums">
                        <Delta now={cat.total} before={previousByCategory.get(cat.categoryId) ?? 0} />
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">
                {t("expenses.profitImpact")}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span>{t("expenses.grossProfit")}</span>
                  <span className="tabular-nums">{money(grossProfit)}</span>
                </div>
                <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                  <span>{t("expenses.totalExpenses")}</span>
                  <span className="tabular-nums">− {money(total)}</span>
                </div>
                <div className="my-1 h-px bg-border" />
                <div className="flex items-center justify-between font-medium">
                  <span>{t("expenses.netProfit")}</span>
                  <span className="tabular-nums">{money(grossProfit - total)}</span>
                </div>
              </div>
              {shareOfProfit !== null && (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, shareOfProfit)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("expenses.shareOfProfitHint", { amount: shareOfProfit.toFixed(1) })}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-muted-foreground">{t("expenses.topVendors")}</span>
                <span className="text-muted-foreground">{t("expenses.clickToFilter")}</span>
              </div>
              {data.byVendor.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("expenses.noVendorsYet")}</p>
              ) : (
                <div className="space-y-1">
                  {data.byVendor.map((v) => (
                    <button
                      key={v.vendor}
                      type="button"
                      onClick={() => onSelectVendor(v.vendor)}
                      data-testid={`vendor-row-${v.vendor}`}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted"
                    >
                      <span className="truncate">{v.vendor}</span>
                      <span className="shrink-0 tabular-nums">{money(v.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
