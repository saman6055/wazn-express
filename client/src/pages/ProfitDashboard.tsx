import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package,
  Plane,
  Ship,
  BarChart3,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Filter,
  Download,
  Layers
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";

// Simple chart components using CSS
function BarChart({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue: number }) {
  return (
    <DashboardLayout>
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">${item.value.toLocaleString()}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                backgroundColor: item.color 
              }}
            />
          </div>
        </div>
      ))}
    </div>
    </DashboardLayout>
  );
}

function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const segments = useMemo(() => {
    let currentAngle = 0;
    return data.map(item => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const segment = {
        ...item,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      };
      currentAngle += angle;
      return segment;
    });
  }, [data, total]);

  // Create conic gradient
  const gradientStops = segments.map((seg, i) => {
    const start = (seg.startAngle / 360) * 100;
    const end = (seg.endAngle / 360) * 100;
    return `${seg.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div className="flex items-center gap-6">
      <div 
        className="w-32 h-32 rounded-full relative"
        style={{ 
          background: total > 0 ? `conic-gradient(${gradientStops})` : '#e5e7eb'
        }}
      >
        <div className="absolute inset-4 bg-background rounded-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold">${total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon: Icon, 
  trend,
  color = "text-primary"
}: { 
  title: string; 
  value: string; 
  change?: number;
  changeLabel?: string;
  icon: any; 
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 text-sm">
                {trend === "up" && <ArrowUpRight className="h-4 w-4 text-green-500" />}
                {trend === "down" && <ArrowDownRight className="h-4 w-4 text-red-500" />}
                {trend === "neutral" && <Minus className="h-4 w-4 text-muted-foreground" />}
                <span className={
                  trend === "up" ? "text-green-500" : 
                  trend === "down" ? "text-red-500" : 
                  "text-muted-foreground"
                }>
                  {change > 0 ? "+" : ""}{change.toFixed(1)}%
                </span>
                {changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-muted ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfitDashboard() {
    const { t } = useTranslation();
const [timeRange, setTimeRange] = useState("all");
  const [shippingType, setShippingType] = useState("all");

  // Fetch all batches with financial data
  const { data: batchesResponse, isLoading: batchesLoading } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesResponse) ? batchesResponse : batchesResponse?.data;

  // Calculate aggregated financial data
  const financialData = useMemo(() => {
    if (!batches) return null;

    let filteredBatches = batches;
    
    // Filter by shipping type
    if (shippingType !== "all") {
      filteredBatches = filteredBatches.filter(b => b.shippingType === shippingType);
    }

    // Filter by time range
    if (timeRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filteredBatches = filteredBatches.filter(b => 
        new Date(b.createdAt) >= startDate
      );
    }

    // Calculate totals
    let totalCost = 0;
    let totalRevenue = 0;
    let totalPackages = 0;
    let airRegularRevenue = 0;
    let airIrregularRevenue = 0;
    let seaRevenue = 0;
    let airRegularCost = 0;
    let airIrregularCost = 0;
    let seaCost = 0;

    const batchDetails: any[] = [];

    for (const batch of filteredBatches) {
      const b = batch as any;
      const chargedVolume = batch.shippingType === "sea"
        ? Number(b.chargedCbm || 0)
        : Number(b.chargedWeightKg || b.totalWeight || 0);

      const costPerUnit = batch.shippingType === "sea"
        ? Number(b.costPerCbm || 0)
        : Number(b.costPerKg || 0);

      const cost = chargedVolume * costPerUnit;

      // Estimate revenue (this would come from actual package data in production)
      const sellingPrice = batch.shippingType === "sea"
        ? Number(b.pricePerCbm || 0)
        : Number(b.pricePerKg || 0);

      const actualVolume = batch.shippingType === "sea"
        ? Number(b.actualCbm || 0)
        : Number(b.actualWeightKg || b.totalWeight || 0);
      
      const revenue = actualVolume * sellingPrice;
      
      totalCost += cost;
      totalRevenue += revenue;
      totalPackages += (batch as any).packageCount || 0;

      if (batch.shippingType === "air_regular") {
        airRegularRevenue += revenue;
        airRegularCost += cost;
      } else if (batch.shippingType === "air_irregular") {
        airIrregularRevenue += revenue;
        airIrregularCost += cost;
      } else if (batch.shippingType === "sea") {
        seaRevenue += revenue;
        seaCost += cost;
      }

      batchDetails.push({
        id: batch.id,
        name: batch.batchCode,
        shippingType: batch.shippingType,
        cost,
        revenue,
        profit: revenue - cost,
        profitMargin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
        packageCount: (batch as any).packageCount || 0,
        status: batch.status,
        createdAt: batch.createdAt,
      });
    }

    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalCost,
      totalRevenue,
      totalProfit,
      profitMargin,
      totalPackages,
      totalBatches: filteredBatches.length,
      byType: {
        airRegular: { revenue: airRegularRevenue, cost: airRegularCost, profit: airRegularRevenue - airRegularCost },
        airIrregular: { revenue: airIrregularRevenue, cost: airIrregularCost, profit: airIrregularRevenue - airIrregularCost },
        sea: { revenue: seaRevenue, cost: seaCost, profit: seaRevenue - seaCost },
      },
      batchDetails: batchDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }, [batches, timeRange, shippingType]);

  if (batchesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const data = financialData || {
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalPackages: 0,
    totalBatches: 0,
    byType: {
      airRegular: { revenue: 0, cost: 0, profit: 0 },
      airIrregular: { revenue: 0, cost: 0, profit: 0 },
      sea: { revenue: 0, cost: 0, profit: 0 },
    },
    batchDetails: [],
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Profit & Loss Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Financial overview and profitability analysis
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 me-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={shippingType} onValueChange={setShippingType}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 me-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="air_regular">Air Regular</SelectItem>
              <SelectItem value="air_irregular">Air Irregular</SelectItem>
              <SelectItem value="sea">Sea</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={`$${data.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="text-green-600"
        />
        <StatCard
          title="Total Cost"
          value={`$${data.totalCost.toLocaleString()}`}
          icon={TrendingDown}
          color="text-red-600"
        />
        <StatCard
          title="Net Profit"
          value={`$${data.totalProfit.toLocaleString()}`}
          icon={data.totalProfit >= 0 ? TrendingUp : TrendingDown}
          trend={data.totalProfit >= 0 ? "up" : "down"}
          color={data.totalProfit >= 0 ? "text-green-600" : "text-red-600"}
        />
        <StatCard
          title="Profit Margin"
          value={`${data.profitMargin.toFixed(1)}%`}
          icon={PieChart}
          trend={data.profitMargin >= 20 ? "up" : data.profitMargin >= 10 ? "neutral" : "down"}
          color={data.profitMargin >= 20 ? "text-green-600" : data.profitMargin >= 10 ? "text-yellow-600" : "text-red-600"}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Packages</p>
                <p className="text-xl font-bold">{data.totalPackages.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Batches</p>
                <p className="text-xl font-bold">{data.totalBatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Profit/Package</p>
                <p className="text-xl font-bold">
                  ${data.totalPackages > 0 ? (data.totalProfit / data.totalPackages).toFixed(2) : "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Shipping Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue by Shipping Type
            </CardTitle>
            <CardDescription>Breakdown of revenue across shipping methods</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart 
              data={[
                { label: "Air Regular", value: data.byType.airRegular.revenue, color: "#3B82F6" },
                { label: "Air Irregular", value: data.byType.airIrregular.revenue, color: "#8B5CF6" },
                { label: "Sea", value: data.byType.sea.revenue, color: "#10B981" },
              ]}
              maxValue={Math.max(
                data.byType.airRegular.revenue,
                data.byType.airIrregular.revenue,
                data.byType.sea.revenue
              )}
            />
          </CardContent>
        </Card>

        {/* Profit Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Profit Distribution
            </CardTitle>
            <CardDescription>Profit contribution by shipping type</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart 
              data={[
                { label: "Air Regular", value: Math.max(0, data.byType.airRegular.profit), color: "#3B82F6" },
                { label: "Air Irregular", value: Math.max(0, data.byType.airIrregular.profit), color: "#8B5CF6" },
                { label: "Sea", value: Math.max(0, data.byType.sea.profit), color: "#10B981" },
              ]}
              total={Math.max(0, data.totalProfit)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Profit by Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Plane className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Air Regular</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium text-green-600">${data.byType.airRegular.revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium text-red-600">${data.byType.airRegular.cost.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Profit</span>
                <span className={`font-bold ${data.byType.airRegular.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${data.byType.airRegular.profit.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Plane className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold">Air Irregular</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium text-green-600">${data.byType.airIrregular.revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium text-red-600">${data.byType.airIrregular.cost.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Profit</span>
                <span className={`font-bold ${data.byType.airIrregular.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${data.byType.airIrregular.profit.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Ship className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Sea</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium text-green-600">${data.byType.sea.revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium text-red-600">${data.byType.sea.cost.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Profit</span>
                <span className={`font-bold ${data.byType.sea.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${data.byType.sea.profit.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Performance</CardTitle>
          <CardDescription>Detailed financial breakdown by batch</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Packages</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.batchDetails.slice(0, 10).map((batch: any) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Link href={`/batches/${batch.id}/financial`} className="font-medium text-primary hover:underline">
                      {batch.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {batch.shippingType === "air_regular" && <Plane className="h-3 w-3 me-1" />}
                      {batch.shippingType === "air_irregular" && <Plane className="h-3 w-3 me-1" />}
                      {batch.shippingType === "sea" && <Ship className="h-3 w-3 me-1" />}
                      {batch.shippingType.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{batch.packageCount}</TableCell>
                  <TableCell className="text-right text-red-600">${batch.cost.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">${batch.revenue.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${batch.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${batch.profit.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={batch.profitMargin >= 20 ? "default" : batch.profitMargin >= 10 ? "secondary" : "destructive"}>
                      {batch.profitMargin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {batch.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.batchDetails.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No batch data available for the selected filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data.batchDetails.length > 10 && (
            <div className="mt-4 text-center">
              <Button variant="outline" asChild>
                <Link href="/batches">View All Batches</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
