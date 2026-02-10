import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, Download, FileSpreadsheet, FileText, TrendingUp, TrendingDown,
  Package, DollarSign, Users, Crown, AlertTriangle, CheckCircle, Clock,
  Wallet, ArrowUpRight, ArrowDownRight, Calendar, Plane, Ship, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Reports() {
    const { t } = useTranslation();
const [dateRange, setDateRange] = useState("30");
  
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: packagesResponse } = trpc.packages.list.useQuery({ pageSize: 10000 });
  const packages = packagesResponse?.data;
  const { data: invoices } = trpc.invoices.list.useQuery();
  const { data: fullPackages } = trpc.fullPackage.list.useQuery({});
  const { data: vipCustomers } = trpc.vip.list.useQuery();
  const now = new Date();
  const startDate = new Date(now.getTime() - parseInt(dateRange) * 24 * 60 * 60 * 1000);
  const { data: profitReport } = trpc.reports.profitReport.useQuery({ 
    startDate,
    endDate: now
  });
  const { data: topCustomers } = trpc.reports.topCustomers.useQuery({ limit: 5 });
  const { data: customersWithDebt } = trpc.reports.customersWithDebt.useQuery();
  const { data: batches } = trpc.batches.list.useQuery();

  // Calculate stats - using invoices for payment totals (ledger-based system)
  const stats = useMemo(() => {
    const totalPayments = invoices?.reduce((sum: number, inv) => sum + Number(inv.totalUsd || 0), 0) || 0;
    const totalProfit = fullPackages?.reduce((sum: number, fp) => sum + Number(fp.profitUsd || 0), 0) || 0;
    const deliveredPackages = packages?.filter(p => p.status === "delivered").length || 0;
    const totalPackages = packages?.length || 0;
    const deliveryRate = totalPackages > 0 ? (deliveredPackages / totalPackages) * 100 : 0;
    const activeCustomers = customers?.filter(c => c.isActive).length || 0;
    const totalDebt = customersWithDebt?.reduce((sum: number, c) => sum + Number(c.latestBalance || 0), 0) || 0;
    
    return {
      totalPayments,
      totalProfit,
      deliveredPackages,
      totalPackages,
      deliveryRate,
      activeCustomers,
      totalDebt,
      vipCount: vipCustomers?.length || 0
    };
  }, [invoices, fullPackages, packages, customers, customersWithDebt, vipCustomers]);

  const handleExport = (type: string, format: string) => {
    toast.info(`Exporting ${type} report as ${format.toUpperCase()}... (Feature coming soon)`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-6 w-6" />
                <span className="text-sm font-medium opacity-90">Analytics & Insights</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Reports</h1>
              <p className="text-white/80 max-w-lg">
                Comprehensive business analytics and performance metrics
              </p>
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-600">${stats.totalPayments.toFixed(2)}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>From payments</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Profit</p>
                  <p className="text-3xl font-bold text-blue-600">${stats.totalProfit.toFixed(2)}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                    <TrendingUp className="h-3 w-3" />
                    <span>Full Package orders</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivery Rate</p>
                  <p className="text-3xl font-bold">{stats.deliveryRate.toFixed(0)}%</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{stats.deliveredPackages}/{stats.totalPackages} delivered</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white shadow-lg">
                  <Package className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Outstanding Debt</p>
                  <p className="text-3xl font-bold text-red-600">${Math.abs(stats.totalDebt).toFixed(2)}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{customersWithDebt?.length || 0} customers</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">Overview</TabsTrigger>
            <TabsTrigger value="customers" className="data-[state=active]:bg-background">Customers</TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-background">Financial</TabsTrigger>
            <TabsTrigger value="operational" className="data-[state=active]:bg-background">Operational</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Top Customers */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-amber-500" />
                        Top Customers
                      </CardTitle>
                      <CardDescription>By total packages</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Packages</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topCustomers?.slice(0, 5).map((customer, index) => {
                        const cust = customers?.find(c => c.id === customer.customerId);
                        return (
                        <TableRow key={customer.customerId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                index === 0 ? 'bg-amber-500' : 
                                index === 1 ? 'bg-slate-400' : 
                                index === 2 ? 'bg-amber-700' : 'bg-slate-300'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{cust?.fullName || `Customer #${customer.customerId}`}</p>
                                <p className="text-xs text-muted-foreground">{cust?.customerCode}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{customer.packageCount}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ${Number(customer.totalCharges || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );})}
                      {(!topCustomers || topCustomers.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            No customer data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Customers with Debt */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Outstanding Balances
                      </CardTitle>
                      <CardDescription>Customers with negative balance</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersWithDebt?.slice(0, 5).map((customer) => {
                        const cust = customers?.find(c => c.id === customer.customerId);
                        const balance = Number(customer.latestBalance || 0);
                        return (
                        <TableRow key={customer.customerId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cust?.fullName || `Customer #${customer.customerId}`}</p>
                              <p className="text-xs text-muted-foreground">{cust?.customerCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            -${Math.abs(balance).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Overdue
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );})}
                      {(!customersWithDebt || customersWithDebt.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            No outstanding balances
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Package Status Distribution */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Package Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-5">
                  {[
                    { status: 'registered', label: 'Registered', color: 'bg-slate-500' },
                    { status: 'in_china_warehouse', label: 'China Warehouse', color: 'bg-blue-500' },
                    { status: 'in_transit', label: 'In Transit', color: 'bg-amber-500' },
                    { status: 'in_local_warehouse', label: 'Local Warehouse', color: 'bg-purple-500' },
                    { status: 'delivered', label: 'Delivered', color: 'bg-green-500' },
                  ].map(({ status, label, color }) => {
                    const count = packages?.filter(p => p.status === status).length || 0;
                    const percentage = stats.totalPackages > 0 ? (count / stats.totalPackages) * 100 : 0;
                    return (
                      <div key={status} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-sm text-muted-foreground">{count}</span>
                        </div>
                        <Progress value={percentage} className={`h-2 ${color}`} />
                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                      <Users className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Customers</p>
                      <p className="text-3xl font-bold">{customers?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
                      <CheckCircle className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Customers</p>
                      <p className="text-3xl font-bold text-green-600">{stats.activeCustomers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                      <Crown className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">VIP Members</p>
                      <p className="text-3xl font-bold text-amber-600">{stats.vipCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Full Customer List with Stats */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle>Customer Performance</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => handleExport("customers", "excel")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Packages</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers?.map((customer) => {
                      const cust = customers?.find(c => c.id === customer.customerId);
                      const balance = Number(customer.totalCharges || 0) - Number(customer.totalPayments || 0);
                      return (
                      <TableRow key={customer.customerId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                              <span className="font-semibold text-primary">
                                {cust?.fullName?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{cust?.fullName || `Customer #${customer.customerId}`}</p>
                              <p className="text-xs text-muted-foreground">{cust?.customerCode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{customer.packageCount}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          ${Number(customer.totalCharges || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={balance < 0 ? 'text-red-600' : 'text-green-600'}>
                            ${balance.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Active
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            {/* Batch Financial Reports Section */}
            <Card className="border-0 shadow-lg mb-4">
              <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plane className="h-5 w-5 text-emerald-600" />
                      ڕاپۆرتی دارایی باچەکان
                    </CardTitle>
                    <CardDescription>شیکاری دارایی وردەکاری بۆ هەر باچ</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {batches?.slice(0, 6).map((batch) => (
                    <Link key={batch.id} href={`/reports/batch-financial/${batch.id}`}>
                      <div className="group p-4 rounded-xl border hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {batch.shippingType === 'sea' ? (
                              <Ship className="h-5 w-5 text-blue-500" />
                            ) : (
                              <Plane className="h-5 w-5 text-emerald-500" />
                            )}
                            <span className="font-semibold">{batch.batchCode}</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{batch.shippingType === 'sea' ? 'دەریایی' : 'ئاسمانی'}</span>
                          <Badge variant="outline" className="text-xs">
                            {batch.status === 'closed' ? 'داخراوە' : batch.status === 'arrived' ? 'گەیشتووە' : 'چالاک'}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {batches && batches.length > 6 && (
                  <div className="mt-4 text-center">
                    <Link href="/batches">
                      <Button variant="outline" className="gap-2">
                        بینینی هەموو باچەکان
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Revenue Report
                  </CardTitle>
                  <CardDescription>Revenue breakdown by period, customer, and service type</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 dark:bg-green-950/30">
                      <span className="font-medium">Total Payments Received</span>
                      <span className="text-2xl font-bold text-green-600">${stats.totalPayments.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("revenue", "pdf")}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("revenue", "excel")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Profit & Loss
                  </CardTitle>
                  <CardDescription>Income statement with expenses and net profit</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                      <span className="font-medium">Total Profit (Full Package)</span>
                      <span className="text-2xl font-bold text-blue-600">${stats.totalProfit.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("pnl", "pdf")}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("pnl", "excel")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Accounts Receivable
                  </CardTitle>
                  <CardDescription>Outstanding balances by customer with aging</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-950/30">
                      <span className="font-medium">Total Outstanding</span>
                      <span className="text-2xl font-bold text-red-600">${Math.abs(stats.totalDebt).toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("receivables", "pdf")}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("receivables", "excel")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-purple-600" />
                    Cash Flow
                  </CardTitle>
                  <CardDescription>Cash inflows and outflows by category</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                      <span className="font-medium">Net Cash Flow</span>
                      <span className="text-2xl font-bold text-purple-600">
                        ${(stats.totalPayments - Math.abs(stats.totalDebt)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("cashflow", "pdf")}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("cashflow", "excel")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="operational" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Package Report
                  </CardTitle>
                  <CardDescription>Package volume, status distribution, and trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-muted/50">
                        <p className="text-sm text-muted-foreground">Total Packages</p>
                        <p className="text-2xl font-bold">{stats.totalPackages}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30">
                        <p className="text-sm text-muted-foreground">Delivered</p>
                        <p className="text-2xl font-bold text-green-600">{stats.deliveredPackages}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("packages", "pdf")}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("packages", "excel")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Delivery Performance
                  </CardTitle>
                  <CardDescription>On-time delivery rates and transit times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Delivery Rate</span>
                        <span className="text-2xl font-bold text-amber-600">{stats.deliveryRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={stats.deliveryRate} className="h-2" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("delivery", "pdf")}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleExport("delivery", "excel")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
