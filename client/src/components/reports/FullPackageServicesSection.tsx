import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  ShoppingBag, Wrench, ExternalLink, DollarSign, CheckCircle, Package, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";

export function FullPackageServicesSection() {
  const { t } = useTranslation();

  const { data: fullPackages } = trpc.fullPackage.list.useQuery({});
  const { data: serviceTypes } = trpc.extraServices.getServiceTypes.useQuery();

  const fpStats = useMemo(() => {
    if (!fullPackages) return { total: 0, profit: 0, delivered: 0, pending: 0 };
    const total = fullPackages.length;
    const profit = fullPackages.reduce((sum, fp) => sum + Number(fp.profitUsd || 0), 0);
    const delivered = fullPackages.filter((fp) => fp.status === "delivered").length;
    const pending = fullPackages.filter(
      (fp) => !["delivered", "cancelled", "refunded"].includes(fp.status)
    ).length;
    return { total, profit, delivered, pending };
  }, [fullPackages]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Full Package Overview */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingBag className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                {t("reports.fullPackageOverview")}
              </CardTitle>
              <CardDescription>{t("reports.fullPackageDesc")}</CardDescription>
            </div>
            <Link href="/full-package">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/30">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Package className="h-4 w-4" />
                <span className="text-sm font-medium">{t("reports.totalOrders")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{fpStats.total}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">{t("reports.netProfit")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-300">${fpStats.profit.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{t("reports.deliveredOrders")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{fpStats.delivered}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">{t("reports.pending")}</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{fpStats.pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Overview */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                {t("reports.servicesBreakdown")}
              </CardTitle>
              <CardDescription>{t("reports.servicesDesc")}</CardDescription>
            </div>
            <Link href="/reports/services">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {serviceTypes && serviceTypes.length > 0 ? (
            <div className="space-y-3">
              {serviceTypes.slice(0, 6).map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                      <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{service.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{service.nameKu || service.nameEn}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/30">
                    ${Number(service.defaultPrice || 0).toLocaleString()}
                  </Badge>
                </div>
              ))}
              {serviceTypes.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  {t("reports.noDataAvailable")}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {t("reports.noDataAvailable")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
