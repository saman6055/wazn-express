import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  Package, 
  AlertTriangle, 
  Truck, 
  CheckCircle2, 
  Plus, 
  Eye, 
  QrCode,
  Plane,
  Ship,
  Clock,
  TrendingUp,
  Layers,
  Zap,
  ChevronRight,
  Calendar
} from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

const statusColors: Record<string, { bg: string; text: string; labelKey: string }> = {
  registered: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-800 dark:text-blue-200", labelKey: "packages.stRegistered" },
  in_batch: { bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-800 dark:text-purple-200", labelKey: "packages.stInBatch" },
  in_transit: { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-800 dark:text-amber-200", labelKey: "packages.stInTransit" },
  customs_processing: { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-800 dark:text-orange-200", labelKey: "packages.stCustoms" },
  ready_for_delivery: { bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-800 dark:text-cyan-200", labelKey: "packages.stReady" },
  out_for_delivery: { bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-800 dark:text-indigo-200", labelKey: "packages.stOutForDelivery" },
  delivered: { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-800 dark:text-green-200", labelKey: "packages.stDelivered" },
  cancelled: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-800 dark:text-red-200", labelKey: "packages.stCancelled" },
  returned: { bg: "bg-gray-100 dark:bg-gray-950/40", text: "text-gray-800 dark:text-gray-200", labelKey: "packages.stReturned" },
};

const shippingTypeConfig: Record<string, { icon: typeof Plane; color: string; labelKey: string }> = {
  air_regular: { icon: Plane, color: "text-blue-600", labelKey: "packages.shAirRegular" },
  air_irregular: { icon: AlertTriangle, color: "text-amber-600", labelKey: "packages.shAirIrregular" },
  sea: { icon: Ship, color: "text-cyan-600", labelKey: "packages.shSea" },
};

export default function PackagesDashboard() {
    const { t } = useTranslation();
const [, setLocation] = useLocation();
  
  const { data: stats, isLoading: statsLoading } = trpc.packages.stats.useQuery();
  const { data: recentPackages, isLoading: recentLoading } = trpc.packages.recentPackages.useQuery({ limit: 8 });
  const { data: customers } = trpc.customers.list.useQuery();

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return t("packages.unclaimedShortName");
    return customers?.find(c => c.id === customerId)?.fullName || t("packages.unknownCustomer");
  };

  const getCustomerCode = (customerId: number | null) => {
    if (!customerId) return "UNC";
    return customers?.find(c => c.id === customerId)?.customerCode || "";
  };

  // Calculate percentages for donut chart
  const totalForChart = stats?.byStatus?.reduce((acc, s) => acc + s.count, 0) || 1;
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("packages.pkgDashTitle")}</h1>
            <p className="text-muted-foreground">{t("packages.pkgDashSubtitle")}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 me-2" />
                {t("packages.registerPackage")}
                <ChevronDown className="h-4 w-4 ms-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation("/packages/register")}>
                <Plus className="h-4 w-4 me-2" />
                <div>
                  <div className="font-medium">{t("packages.standardRegister")}</div>
                  <div className="text-xs text-muted-foreground">{t("packages.fullWizard")}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/packages/quick-register")}>
                <Zap className="h-4 w-4 me-2 text-amber-500" />
                <div>
                  <div className="font-medium">{t("packages.quickRegisterName")}</div>
                  <div className="text-xs text-muted-foreground">{t("packages.fastSinglePage")}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/packages/bulk-register")}>
                <Layers className="h-4 w-4 me-2 text-purple-500" />
                <div>
                  <div className="font-medium">{t("packages.bulkRegister")}</div>
                  <div className="text-xs text-muted-foreground">{t("packages.multiplePackages")}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/packages/unclaimed")}>
                <AlertTriangle className="h-4 w-4 me-2 text-amber-500" />
                <div>
                  <div className="font-medium">{t("packages.unclaimedPackages")}</div>
                  <div className="text-xs text-muted-foreground">{t("packages.viewWithoutOwner")}</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 dark:border-blue-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600">{t("packages.totalPackages")}</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{stats?.total || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 dark:border-amber-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600">{t("packages.unclaimedShortName")}</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{stats?.unclaimed || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 dark:border-purple-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600">{t("packages.stRegistered")}</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">{stats?.registered || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 dark:border-orange-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">In Transit</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">{stats?.inTransit || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 dark:border-green-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600">Delivered</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-200">{stats?.delivered || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200 dark:border-cyan-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-cyan-600">{t("packages.today")}</p>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-200">{stats?.todayCount || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-500 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("packages.statusDistribution")}
              </CardTitle>
              <CardDescription>{t("packages.byCurrentStatus")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.byStatus?.map((item) => {
                  const config = statusColors[item.status] || { bg: "bg-gray-100 dark:bg-gray-950/40", text: "text-gray-800 dark:text-gray-200", label: item.status };
                  const percentage = ((item.count / totalForChart) * 100).toFixed(1);
                  return (
                    <div key={item.status} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{t(config.labelKey)}</span>
                          <span className="text-sm text-muted-foreground">{item.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${config.bg.replace('100', '500')}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{percentage}%</span>
                    </div>
                  );
                })}
                {(!stats?.byStatus || stats.byStatus.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">{t("packages.noDataAvailable")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Type Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Plane className="h-4 w-4" />
                {t("packages.shippingTypes")}
              </CardTitle>
              <CardDescription>{t("packages.byShippingMethod")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.byShippingType?.map((item) => {
                  const config = shippingTypeConfig[item.shippingType] || { icon: Package, color: "text-gray-600", label: item.shippingType };
                  const Icon = config.icon;
                  const totalShipping = stats.byShippingType.reduce((acc, s) => acc + s.count, 0) || 1;
                  const percentage = ((item.count / totalShipping) * 100).toFixed(1);
                  return (
                    <div key={item.shippingType} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className={`h-10 w-10 rounded-full bg-background flex items-center justify-center ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{t(config.labelKey)}</p>
                        <p className="text-sm text-muted-foreground">{item.count} packages</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
                {(!stats?.byShippingType || stats.byShippingType.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">{t("packages.noDataAvailable")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {t("packages.quickActions")}
              </CardTitle>
              <CardDescription>{t("packages.commonOperations")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3"
                onClick={() => setLocation("/packages/quick-register")}
              >
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center me-3">
                  <Zap className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Quick Register</p>
                  <p className="text-xs text-muted-foreground">Fast single-page form</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3"
                onClick={() => setLocation("/packages/bulk-register")}
              >
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center me-3">
                  <Layers className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t("packages.bulkRegister")}</p>
                  <p className="text-xs text-muted-foreground">{t("packages.multiplePackages")}</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3"
                onClick={() => setLocation("/smart-scanner")}
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center me-3">
                  <QrCode className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t("packages.smartScanner")}</p>
                  <p className="text-xs text-muted-foreground">{t("packages.scanQrCodes")}</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              {(stats?.unclaimed || 0) > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto py-3 border-amber-200 dark:border-amber-800/60 bg-amber-50/50"
                  onClick={() => setLocation("/packages/unclaimed")}
                >
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center me-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{t("packages.unclaimedPackages")}</p>
                    <p className="text-xs text-amber-600">{stats?.unclaimed} packages waiting</p>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Packages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("packages.recentPackages")}
              </CardTitle>
              <CardDescription>{t("packages.latestRegistered")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/packages/all")}>
              {t("packages.viewAll")}
              <ChevronRight className="h-4 w-4 ms-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPackages?.map((pkg) => {
                const statusConfig = statusColors[pkg.status] || { bg: "bg-gray-100 dark:bg-gray-950/40", text: "text-gray-800 dark:text-gray-200", label: pkg.status };
                const shippingConfig = shippingTypeConfig[pkg.shippingType] || { icon: Package, color: "text-gray-600", label: pkg.shippingType };
                const ShippingIcon = shippingConfig.icon;
                
                return (
                  <div 
                    key={pkg.id} 
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    // /packages/:id has never been a route, so this was a 404
                    // on every click. The table is the place a package is
                    // actually viewed, so open it looking for this one.
                    onClick={() => setLocation(
                      `/packages/all?search=${encodeURIComponent(pkg.trackingNumber || pkg.packageCode || "")}`
                    )}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${shippingConfig.color} bg-muted`}>
                      <ShippingIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium text-sm">{pkg.packageCode}</p>
                        {pkg.isUnclaimed && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-800/60 text-xs">
                            {t("packages.unclaimedShortName")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getCustomerName(pkg.customerId)} • {getCustomerCode(pkg.customerId)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0`}>
                        {t(statusConfig.labelKey)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pkg.weightKg ? `${pkg.weightKg} kg` : '-'}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {(!recentPackages || recentPackages.length === 0) && (
                <p className="text-center text-muted-foreground py-8">{t("packages.noPackagesYet")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
