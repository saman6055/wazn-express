import { RegistrationsSummaryCard } from "@/components/dashboard/RegistrationsSummaryCard";
import { StaleDepotCard } from "@/components/dashboard/StaleDepotCard";
import { VolumetricWatchCard } from "@/components/dashboard/VolumetricWatchCard";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Package,
  Layers,
  Search,
  QrCode,
  PlusCircle,
  Clock,
  CheckCircle2,
  Truck,
  Users,
  ChevronRight,
  Sparkles,
  ClipboardList,
} from "lucide-react";

export default function StaffDashboard() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();

  const { data: todayStats } = trpc.scanning.todayStats.useQuery();
  const { data: recentScans, isLoading: scansLoading } = trpc.scanning.myRecentScans.useQuery({ limit: 20 });
  const { data: activeBatches } = trpc.dashboard.activeBatches.useQuery();
  const { data: financialStats } = trpc.dashboard.financialStats.useQuery();

  const scansToday = todayStats?.reduce((sum: number, s: { count: number }) => sum + (s.count ?? 0), 0) ?? 0;
  const packagesRegisteredToday = financialStats?.todayPackages ?? 0;

  const [customerSearch, setCustomerSearch] = useState("");
  const handleCustomerLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customerSearch.trim();
    if (q) setLocation(`/customers?search=${encodeURIComponent(q)}`);
    else setLocation("/customers");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">{t("common.appName")}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              {t("staffDashboard.title")}
            </h1>
            <p className="text-white/80 max-w-lg text-sm md:text-base">
              {t("staffDashboard.welcome")}
            </p>
          </div>
        </div>

        {/* Customer lookup */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("staffDashboard.customerLookup")}
            </CardTitle>
            <CardDescription>{t("staffDashboard.customerLookupDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCustomerLookup} className="flex gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
              <Input
                type="search"
                placeholder={t("staffDashboard.searchCustomerPlaceholder")}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">{t("common.search")}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Today's intake at the scanner. Staff see it too — it is their own
            work, and the gaps are theirs to close. */}
        <VolumetricWatchCard />
            <StaleDepotCard />
            <RegistrationsSummaryCard />

        {/* Quick actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/scan-dashboard">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <QrCode className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{t("staffDashboard.quickScan")}</p>
                  <p className="text-sm text-muted-foreground">{t("staffDashboard.quickScanDesc")}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/packages/register">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <PlusCircle className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{t("staffDashboard.quickRegister")}</p>
                  <p className="text-sm text-muted-foreground">{t("staffDashboard.quickRegisterDesc")}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("staffDashboard.scansToday")}</p>
                  <p className="text-3xl font-bold">{scansToday}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <QrCode className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("staffDashboard.registeredToday")}</p>
                  <p className="text-3xl font-bold">{packagesRegisteredToday}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Package className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("staffDashboard.todaysTasks")}
            </CardTitle>
            <CardDescription>{t("staffDashboard.todaysTasksDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/scan-dashboard">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t("staffDashboard.packagesToScan")}</p>
                    <p className="text-sm text-muted-foreground">{t("staffDashboard.packagesToScanDesc")}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
              <Link href="/batches">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors">
                  <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t("staffDashboard.batchesToProcess")}</p>
                    <p className="text-sm text-muted-foreground">
                      {activeBatches?.length ?? 0} {t("staffDashboard.activeBatches")}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Assigned / Active batches */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  {t("staffDashboard.assignedBatches")}
                </CardTitle>
                <CardDescription>{t("staffDashboard.assignedBatchesDesc")}</CardDescription>
              </div>
              <Link href="/batches">
                <Button variant="outline" size="sm">{t("common.all")}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!activeBatches?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("staffDashboard.noBatches")}</p>
            ) : (
              <div className="space-y-2">
                {activeBatches.slice(0, 5).map((batch: { id: number; batchCode: string; status: string; packageCount: number }) => (
                  <Link key={batch.id} href={`/batches`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{batch.batchCode}</span>
                        <span className="text-xs text-muted-foreground capitalize">{batch.status?.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{batch.packageCount} {t("common.package")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent scans */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  {t("staffDashboard.recentScans")}
                </CardTitle>
                <CardDescription>{t("staffDashboard.recentScansDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {scansLoading ? (
              <p className="text-sm text-muted-foreground py-4">{t("common.loading")}</p>
            ) : !recentScans?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("staffDashboard.noRecentScans")}</p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {recentScans.map((scan: { id: number; trackingNumber: string; scanType: string; scannedAt: Date }) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="font-mono text-sm truncate">{scan.trackingNumber}</span>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{scan.scanType?.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(scan.scannedAt).toLocaleString(language === "ku" ? "ar-IQ" : "en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
