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

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  registered: { bg: "bg-blue-100", text: "text-blue-800", label: "Registered" },
  in_batch: { bg: "bg-purple-100", text: "text-purple-800", label: "In Batch" },
  in_transit: { bg: "bg-amber-100", text: "text-amber-800", label: "In Transit" },
  customs_processing: { bg: "bg-orange-100", text: "text-orange-800", label: "Customs" },
  ready_for_delivery: { bg: "bg-cyan-100", text: "text-cyan-800", label: "Ready" },
  out_for_delivery: { bg: "bg-indigo-100", text: "text-indigo-800", label: "Out for Delivery" },
  delivered: { bg: "bg-green-100", text: "text-green-800", label: "Delivered" },
  cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Cancelled" },
  returned: { bg: "bg-gray-100", text: "text-gray-800", label: "Returned" },
};

const shippingTypeConfig: Record<string, { icon: typeof Plane; color: string; label: string }> = {
  air_regular: { icon: Plane, color: "text-blue-600", label: "Air Regular" },
  air_irregular: { icon: AlertTriangle, color: "text-amber-600", label: "Air Irregular" },
  sea: { icon: Ship, color: "text-cyan-600", label: "Sea Freight" },
};

export default function PackagesDashboard() {
    const { t } = useTranslation();
const [, setLocation] = useLocation();
  
  const { data: stats, isLoading: statsLoading } = trpc.packages.stats.useQuery();
  const { data: recentPackages, isLoading: recentLoading } = trpc.packages.recentPackages.useQuery({ limit: 8 });
  const { data: customers } = trpc.customers.list.useQuery();

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return "Unclaimed";
    return customers?.find(c => c.id === customerId)?.fullName || "Unknown";
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
            <h1 className="text-2xl font-bold tracking-tight">Packages Dashboard</h1>
            <p className="text-muted-foreground">Overview of all package operations</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 me-2" />
                Register Package
                <ChevronDown className="h-4 w-4 ms-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation("/packages/register")}>
                <Plus className="h-4 w-4 me-2" />
                <div>
                  <div className="font-medium">Standard Register</div>
                  <div className="text-xs text-muted-foreground">Full wizard with all options</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/packages/quick-register")}>
                <Zap className="h-4 w-4 me-2 text-amber-500" />
                <div>
                  <div className="font-medium">Quick Register</div>
                  <div className="text-xs text-muted-foreground">Fast single-page form</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/packages/bulk-register")}>
                <Layers className="h-4 w-4 me-2 text-purple-500" />
                <div>
                  <div className="font-medium">Bulk Register</div>
                  <div className="text-xs text-muted-foreground">Multiple packages at once</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/packages/unclaimed")}>
                <AlertTriangle className="h-4 w-4 me-2 text-amber-500" />
                <div>
                  <div className="font-medium">Unclaimed Packages</div>
                  <div className="text-xs text-muted-foreground">View packages without owner</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600">Total Packages</p>
                  <p className="text-2xl font-bold text-blue-900">{stats?.total || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600">Unclaimed</p>
                  <p className="text-2xl font-bold text-amber-900">{stats?.unclaimed || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600">Registered</p>
                  <p className="text-2xl font-bold text-purple-900">{stats?.registered || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">In Transit</p>
                  <p className="text-2xl font-bold text-orange-900">{stats?.inTransit || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600">Delivered</p>
                  <p className="text-2xl font-bold text-green-900">{stats?.delivered || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-cyan-600">Today</p>
                  <p className="text-2xl font-bold text-cyan-900">{stats?.todayCount || 0}</p>
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
                Status Distribution
              </CardTitle>
              <CardDescription>Packages by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.byStatus?.map((item) => {
                  const config = statusColors[item.status] || { bg: "bg-gray-100", text: "text-gray-800", label: item.status };
                  const percentage = ((item.count / totalForChart) * 100).toFixed(1);
                  return (
                    <div key={item.status} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{config.label}</span>
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
                  <p className="text-center text-muted-foreground py-4">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Type Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Plane className="h-4 w-4" />
                Shipping Types
              </CardTitle>
              <CardDescription>Packages by shipping method</CardDescription>
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
                        <p className="font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground">{item.count} packages</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
                {(!stats?.byShippingType || stats.byShippingType.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3"
                onClick={() => setLocation("/packages/quick-register")}
              >
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center me-3">
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
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center me-3">
                  <Layers className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Bulk Register</p>
                  <p className="text-xs text-muted-foreground">Multiple packages at once</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3"
                onClick={() => setLocation("/smart-scanner")}
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center me-3">
                  <QrCode className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Smart Scanner</p>
                  <p className="text-xs text-muted-foreground">Scan QR codes</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              {(stats?.unclaimed || 0) > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto py-3 border-amber-200 bg-amber-50/50"
                  onClick={() => setLocation("/packages/unclaimed")}
                >
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center me-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Unclaimed Packages</p>
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
                Recent Packages
              </CardTitle>
              <CardDescription>Latest registered packages</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/packages/all")}>
              View All
              <ChevronRight className="h-4 w-4 ms-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPackages?.map((pkg) => {
                const statusConfig = statusColors[pkg.status] || { bg: "bg-gray-100", text: "text-gray-800", label: pkg.status };
                const shippingConfig = shippingTypeConfig[pkg.shippingType] || { icon: Package, color: "text-gray-600", label: pkg.shippingType };
                const ShippingIcon = shippingConfig.icon;
                
                return (
                  <div 
                    key={pkg.id} 
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/packages/${pkg.id}`)}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${shippingConfig.color} bg-muted`}>
                      <ShippingIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium text-sm">{pkg.packageCode}</p>
                        {pkg.isUnclaimed && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                            Unclaimed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getCustomerName(pkg.customerId)} • {getCustomerCode(pkg.customerId)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0`}>
                        {statusConfig.label}
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
                <p className="text-center text-muted-foreground py-8">No packages yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
