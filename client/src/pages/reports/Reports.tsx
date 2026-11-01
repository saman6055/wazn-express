import DashboardLayout from "@/components/DashboardLayout";
import { DashboardHero, DashboardSection } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FinancialMetricsSection,
  RevenueProfitChartsSection,
  PackageOverviewSection,
  BatchPerformanceSection,
  CustomerAnalyticsSection,
  ScanningActivitySection,
  FullPackageServicesSection,
  QuickLinksSection,
  PlatformBreakdownSection,
} from "@/components/reports";
import { useTranslation } from "@/contexts/LanguageContext";
import { BarChart3, Calendar, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Reports() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState("30");

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() - parseInt(dateRange) * 24 * 60 * 60 * 1000);
    return { startDate: start, endDate: now };
  }, [dateRange]);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Hero Header */}
        <DashboardHero
          badge={t("reports.title")}
          badgeIcon={<BarChart3 className="h-5 w-5" />}
          title={t("reports.title")}
          subtitle={t("reports.subtitle")}
          actions={
            <>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px] border-white/20 bg-white/20 text-primary-foreground">
                  <Calendar className="h-4 w-4 me-2" />
                  <SelectValue placeholder={t("reports.selectPeriod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("reports.last7Days")}</SelectItem>
                  <SelectItem value="30">{t("reports.last30Days")}</SelectItem>
                  <SelectItem value="90">{t("reports.last90Days")}</SelectItem>
                  <SelectItem value="365">{t("reports.lastYear")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                className="gap-2 border-0 bg-white/20 text-primary-foreground hover:bg-white/30"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          }
        />

        {/* Financial Metrics */}
        <DashboardSection title={t("reports.financialReport")}>
          <FinancialMetricsSection startDate={startDate} endDate={endDate} />
        </DashboardSection>

        {/* Revenue & Profit Charts */}
        <DashboardSection
          title={t("reports.salesTrend")}
          description={t("reports.revenueAndProfitCharts")}
        >
          <RevenueProfitChartsSection
            startDate={startDate}
            endDate={endDate}
            dateRange={dateRange}
          />
        </DashboardSection>

        {/* Where the buying happens — which shops the orders come from */}
        <DashboardSection title={t("reports.platformReport") || "کڕین بەپێی پلاتفۆرم"}>
          <PlatformBreakdownSection startDate={startDate} endDate={endDate} />
        </DashboardSection>

        {/* Package Overview */}
        <DashboardSection title={t("reports.packageReport")}>
          <PackageOverviewSection />
        </DashboardSection>

        {/* Batch Performance */}
        <DashboardSection title={t("reports.batchFinancialReport")}>
          <BatchPerformanceSection />
        </DashboardSection>

        {/* Customer Analytics */}
        <DashboardSection title={t("reports.customerReport")}>
          <CustomerAnalyticsSection />
        </DashboardSection>

        {/* Scanning Activity */}
        <DashboardSection title={t("reports.scanReport")}>
          <ScanningActivitySection startDate={startDate} endDate={endDate} />
        </DashboardSection>

        {/* Full Package & Services */}
        <DashboardSection title={t("reports.operationalReport")}>
          <FullPackageServicesSection />
        </DashboardSection>

        {/* Quick Links */}
        <DashboardSection
          title={t("reports.quickLinks")}
          description={t("reports.viewDetailedReports")}
        >
          <QuickLinksSection />
        </DashboardSection>
      </div>
    </DashboardLayout>
  );
}
