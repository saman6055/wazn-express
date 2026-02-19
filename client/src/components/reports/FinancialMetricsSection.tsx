import { FinancialCard } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { DollarSign, TrendingUp, AlertTriangle, Percent } from "lucide-react";
import { useMemo } from "react";

interface Props {
  startDate: Date;
  endDate: Date;
}

export function FinancialMetricsSection({ startDate, endDate }: Props) {
  const { t } = useTranslation();

  const { data: profitReport } = trpc.reports.profitReport.useQuery({ startDate, endDate });
  const { data: customersWithDebt } = trpc.reports.customersWithDebt.useQuery();

  const metrics = useMemo(() => {
    const totalRevenue = Number(profitReport?.totalPayments || 0);
    const netProfit = Number(profitReport?.fullPackageProfit || 0);
    const totalDebt = customersWithDebt?.reduce(
      (sum: number, c) => sum + Math.abs(Number(c.latestBalance || 0)),
      0
    ) || 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, netProfit, totalDebt, profitMargin };
  }, [profitReport, customersWithDebt]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <FinancialCard
        title={t("reports.totalRevenue")}
        value={metrics.totalRevenue}
        icon={<DollarSign className="h-5 w-5" />}
        color="green"
        prefix="$"
      />
      <FinancialCard
        title={t("reports.netProfit")}
        value={metrics.netProfit}
        icon={<TrendingUp className="h-5 w-5" />}
        color="blue"
        prefix="$"
      />
      <FinancialCard
        title={t("reports.outstandingDebt")}
        value={metrics.totalDebt}
        icon={<AlertTriangle className="h-5 w-5" />}
        color="red"
        prefix="$"
        isDebt
      />
      <FinancialCard
        title={t("reports.profitMargin")}
        value={Math.round(metrics.profitMargin)}
        icon={<Percent className="h-5 w-5" />}
        color="purple"
      />
    </div>
  );
}
