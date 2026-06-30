import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar,
  DollarSign, 
  Package,
  ShoppingBag,
  Handshake,
  TrendingUp,
  TrendingDown,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText
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
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// Month names
const monthNames = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ku: ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەممووز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"]
};

// Order type configuration
const orderTypeConfig = {
  full_package: { 
    label: "Full Package", 
    labelKu: "پاکێجی تەواو",
    color: "#10b981",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-600",
    icon: Package 
  },

  commission: { 
    label: "Commission", 
    labelKu: "عمولە",
    color: "#f59e0b",
    bgColor: "bg-amber-100",
    textColor: "text-amber-600",
    icon: Handshake 
  },
};

// Mini bar chart for table
function MiniBarChart({ values, colors }: { values: number[]; colors: string[] }) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="h-2 bg-gray-200 rounded-full w-full" />;
  
  return (
    <div className="h-2 bg-gray-200 rounded-full w-full overflow-hidden flex">
      {values.map((value, i) => (
        <div 
          key={i}
          className="h-full transition-all duration-300"
          style={{ 
            width: `${(value / total) * 100}%`,
            backgroundColor: colors[i]
          }}
        />
      ))}
    </div>
  );
}

export default function MonthlyProfitReport() {
  const { t, isRTL, language } = useTranslation();
  const isKurdish = language === "ku";
  
  // Year selection
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  // Fetch full package orders for the selected year
  const startDate = new Date(selectedYear, 0, 1);
  const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);
  
  const { data: fpOrders, isLoading } = trpc.fullPackage.list.useQuery({
    startDate,
    endDate,
  });
  
  // Calculate monthly data
  const monthlyData = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, month) => ({
      month,
      monthName: isKurdish ? monthNames.ku[month] : monthNames.en[month],
      full_package: { count: 0, profit: 0, revenue: 0, cost: 0 },
      commission: { count: 0, profit: 0, revenue: 0, cost: 0 },
      total: { count: 0, profit: 0, revenue: 0, cost: 0 },
    }));
    
    if (!fpOrders) return data;
    
    fpOrders.forEach((order: any) => {
      const date = new Date(order.createdAt);
      const month = date.getMonth();
      const orderType = order.orderType as keyof typeof orderTypeConfig;
      
      if (data[month] && data[month][orderType]) {
        const profit = parseFloat(order.profitUsd || "0");
        const revenue = parseFloat(order.sellingPriceUsd || "0");
        const cost = parseFloat(order.totalCostUsd || "0");
        
        data[month][orderType].count++;
        data[month][orderType].profit += profit;
        data[month][orderType].revenue += revenue;
        data[month][orderType].cost += cost;
        
        data[month].total.count++;
        data[month].total.profit += profit;
        data[month].total.revenue += revenue;
        data[month].total.cost += cost;
      }
    });
    
    return data;
  }, [fpOrders, isKurdish]);
  
  // Calculate yearly totals
  const yearlyTotals = useMemo(() => {
    return monthlyData.reduce((acc, month) => ({
      full_package: {
        count: acc.full_package.count + month.full_package.count,
        profit: acc.full_package.profit + month.full_package.profit,
        revenue: acc.full_package.revenue + month.full_package.revenue,
        cost: acc.full_package.cost + month.full_package.cost,
      },

      commission: {
        count: acc.commission.count + month.commission.count,
        profit: acc.commission.profit + month.commission.profit,
        revenue: acc.commission.revenue + month.commission.revenue,
        cost: acc.commission.cost + month.commission.cost,
      },
      total: {
        count: acc.total.count + month.total.count,
        profit: acc.total.profit + month.total.profit,
        revenue: acc.total.revenue + month.total.revenue,
        cost: acc.total.cost + month.total.cost,
      },
    }), {
      full_package: { count: 0, profit: 0, revenue: 0, cost: 0 },
      commission: { count: 0, profit: 0, revenue: 0, cost: 0 },
      total: { count: 0, profit: 0, revenue: 0, cost: 0 },
    });
  }, [monthlyData]);
  
  // Calculate best and worst months
  const bestMonth = useMemo(() => {
    return monthlyData.reduce((best, month) => 
      month.total.profit > best.total.profit ? month : best
    , monthlyData[0]);
  }, [monthlyData]);
  
  const worstMonth = useMemo(() => {
    const monthsWithData = monthlyData.filter(m => m.total.count > 0);
    if (monthsWithData.length === 0) return monthlyData[0];
    return monthsWithData.reduce((worst, month) => 
      month.total.profit < worst.total.profit ? month : worst
    , monthsWithData[0]);
  }, [monthlyData]);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {isKurdish ? "ڕاپۆرتی قازانجی مانگانە" : "Monthly Profit Report"}
            </h1>
            <p className="text-muted-foreground">
              {isKurdish ? "قازانج بەپێی مانگ و جۆری ئۆردەر" : "Profit by month and order type"}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSelectedYear(y => y - 1)}
              disabled={selectedYear <= currentYear - 4}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="w-4 h-4 me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSelectedYear(y => y + 1)}
              disabled={selectedYear >= currentYear}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Yearly Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Yearly Profit */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-1">
                    {isKurdish ? `قازانجی ${selectedYear}` : `${selectedYear} Profit`}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 bg-blue-400" />
                  ) : (
                    <p className="text-3xl font-bold">${yearlyTotals.total.profit.toLocaleString()}</p>
                  )}
                  <p className="text-blue-200 text-xs mt-1">
                    {yearlyTotals.total.count} {isKurdish ? "ئۆردەر" : "orders"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Best Month */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    {isKurdish ? "باشترین مانگ" : "Best Month"}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-20" />
                  ) : (
                    <>
                      <p className="text-lg font-bold text-green-600">{bestMonth.monthName}</p>
                      <p className="text-sm text-muted-foreground">
                        ${bestMonth.total.profit.toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Worst Month */}
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    {isKurdish ? "خراپترین مانگ" : "Worst Month"}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-20" />
                  ) : (
                    <>
                      <p className="text-lg font-bold text-red-600">{worstMonth.monthName}</p>
                      <p className="text-sm text-muted-foreground">
                        ${worstMonth.total.profit.toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Average Monthly */}
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    {isKurdish ? "تێکڕای مانگانە" : "Monthly Average"}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-20" />
                  ) : (
                    <>
                      <p className="text-lg font-bold text-purple-600">
                        ${(yearlyTotals.total.profit / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(yearlyTotals.total.count / 12).toFixed(1)} {isKurdish ? "ئۆردەر/مانگ" : "orders/mo"}
                      </p>
                    </>
                  )}
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Order Type Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(orderTypeConfig).map(([type, config]) => {
            const data = yearlyTotals[type as keyof typeof yearlyTotals];
            const Icon = config.icon;
            
            return (
              <Card key={type} className={cn("border-t-4", `border-t-[${config.color}]`)} style={{ borderTopColor: config.color }}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.bgColor)}>
                      <Icon className={cn("w-5 h-5", config.textColor)} />
                    </div>
                    <div>
                      <p className="font-semibold">{isKurdish ? config.labelKu : config.label}</p>
                      <p className="text-xs text-muted-foreground">{data.count} {isKurdish ? "ئۆردەر" : "orders"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{isKurdish ? "داهات" : "Revenue"}</span>
                      <span className="font-medium">${data.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{isKurdish ? "تێچوو" : "Cost"}</span>
                      <span className="font-medium">${data.cost.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-sm">
                      <span className="font-medium">{isKurdish ? "قازانج" : "Profit"}</span>
                      <span className={cn("font-bold", config.textColor)}>${data.profit.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Monthly Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isKurdish ? "وردەکاری مانگانە" : "Monthly Details"}
            </CardTitle>
            <CardDescription>
              {isKurdish ? `قازانج بەپێی مانگ بۆ ساڵی ${selectedYear}` : `Profit breakdown by month for ${selectedYear}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">{isKurdish ? "مانگ" : "Month"}</TableHead>
                      <TableHead className="text-center">{isKurdish ? "ئۆردەر" : "Orders"}</TableHead>
                      <TableHead className="text-right text-emerald-600">{isKurdish ? "پاکێجی تەواو" : "Full Pack"}</TableHead>

                      <TableHead className="text-right text-amber-600">{isKurdish ? "عمولە" : "Commission"}</TableHead>
                      <TableHead className="text-right font-bold">{isKurdish ? "کۆی گشتی" : "Total"}</TableHead>
                      <TableHead className="w-[120px]">{isKurdish ? "دابەشبوون" : "Distribution"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((row) => (
                      <TableRow key={row.month} className={row.total.count === 0 ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{row.monthName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{row.total.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-emerald-600">${row.full_package.profit.toLocaleString()}</span>
                          {row.full_package.count > 0 && (
                            <span className="text-xs text-muted-foreground ms-1">({row.full_package.count})</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="text-amber-600">${row.commission.profit.toLocaleString()}</span>
                          {row.commission.count > 0 && (
                            <span className="text-xs text-muted-foreground ms-1">({row.commission.count})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${row.total.profit.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <MiniBarChart 
                            values={[row.full_package.profit, row.commission.profit]}
                            colors={["#10b981", "#f59e0b"]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>{isKurdish ? "کۆی گشتی" : "Total"}</TableCell>
                      <TableCell className="text-center">
                        <Badge>{yearlyTotals.total.count}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        ${yearlyTotals.full_package.profit.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-right text-amber-600">
                        ${yearlyTotals.commission.profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        ${yearlyTotals.total.profit.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <MiniBarChart 
                          values={[yearlyTotals.full_package.profit, yearlyTotals.commission.profit]}
                          colors={["#10b981", "#f59e0b"]}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>{isKurdish ? "پاکێجی تەواو" : "Full Package"}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>{isKurdish ? "عمولە" : "Commission"}</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
