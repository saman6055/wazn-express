import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart3, Download, 
  Calendar, Filter, PieChart, Receipt, Users
} from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

export default function ServiceProfitReport() {
    const { t } = useTranslation();
const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  
  const { data: serviceTypes } = trpc.extraServices.getServiceTypes.useQuery();
  const { data: services } = trpc.extraServices.list.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    serviceTypeId: serviceTypeFilter !== "all" ? parseInt(serviceTypeFilter) : undefined,
  });
  const { data: customers } = trpc.customers.list.useQuery();
  
  // Calculate statistics
  const stats = useMemo(() => {
    if (!services?.services) return {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      profitMargin: 0,
      serviceCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      byType: [] as { typeId: number; typeName: string; icon: string; color: string; revenue: number; cost: number; profit: number; count: number }[],
    };
    
    const totalRevenue = services.services.reduce((sum, s) => sum + Number(s.priceAmount || 0), 0);
    const totalCost = services.services.reduce((sum, s) => sum + Number(s.costAmount || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const paidCount = services.services.filter(s => s.isPaid).length;
    const unpaidCount = services.services.filter(s => !s.isPaid).length;
    
    // Group by service type
    const byTypeMap = new Map<number, { typeId: number; typeName: string; icon: string; color: string; revenue: number; cost: number; profit: number; count: number }>();
    
    services.services.forEach(service => {
      const typeId = service.serviceTypeId;
      const type = serviceTypes?.find(t => t.id === typeId);
      
      if (!byTypeMap.has(typeId)) {
        byTypeMap.set(typeId, {
          typeId,
          typeName: type?.nameKu || type?.nameEn || "Unknown",
          icon: type?.icon || "⚙️",
          color: type?.color || "#64748b",
          revenue: 0,
          cost: 0,
          profit: 0,
          count: 0,
        });
      }
      
      const entry = byTypeMap.get(typeId)!;
      entry.revenue += Number(service.priceAmount || 0);
      entry.cost += Number(service.costAmount || 0);
      entry.profit += Number(service.priceAmount || 0) - Number(service.costAmount || 0);
      entry.count += 1;
    });
    
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      serviceCount: services.services.length,
      paidCount,
      unpaidCount,
      byType: Array.from(byTypeMap.values()).sort((a, b) => b.profit - a.profit),
    };
  }, [services, serviceTypes]);

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return "بێ کڕیار";
    const customer = customers?.find(c => c.id === customerId);
    return customer?.fullName || customer?.customerCode || "Unknown";
  };

  const getServiceTypeName = (typeId: number) => {
    const type = serviceTypes?.find(t => t.id === typeId);
    return type?.nameKu || type?.nameEn || "Unknown";
  };

  const getServiceTypeIcon = (typeId: number) => {
    const type = serviceTypes?.find(t => t.id === typeId);
    return type?.icon || "⚙️";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("auto.text_910369")} </h1>
            <p className="text-muted-foreground">{t("auto.text_9c41e3")} </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {t("auto.text_5a5a9b")} PDF
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t("auto.text_873548")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>{t("auto.text_e91766")} </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("auto.text_79a4ad")} </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("serviceTypes.title")}</Label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("auto.text_d62414")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("auto.text_d62414")} </SelectItem>
                    {serviceTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.icon} {type.nameKu || type.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setServiceTypeFilter("all");
                  }}
                >
                  {t("auto.text_b6ca18")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">{t("auto.text_3a3774")} </p>
                  <p className="text-2xl font-bold text-blue-900">${stats.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-blue-600">{stats.serviceCount} {t("auto.text_9e2f33")}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">{t("auto.text_d9ab72")} </p>
                  <p className="text-2xl font-bold text-red-900">${stats.totalCost.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-200 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">{t("auto.text_aa03aa")} </p>
                  <p className="text-2xl font-bold text-green-900">${stats.totalProfit.toFixed(2)}</p>
                  <p className="text-xs text-green-600">{stats.profitMargin.toFixed(1)}% margin</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-200 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">{t("auto.text_e2a2cc")} </p>
                  <p className="text-lg font-bold text-green-700">{stats.paidCount} {t("auto.text_40d446")}</p>
                  <p className="text-lg font-bold text-red-700">{stats.unpaidCount} {t("auto.text_040176")}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-200 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-amber-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit by Service Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              {t("auto.text_3f2e71")}
            </CardTitle>
            <CardDescription>Profit breakdown by service type</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byType.length > 0 ? (
              <div className="space-y-4">
                {stats.byType.map((item) => {
                  const profitPercent = stats.totalProfit > 0 ? (item.profit / stats.totalProfit) * 100 : 0;
                  return (
                    <div key={item.typeId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: `${item.color}20`, color: item.color }}
                          >
                            {item.icon}
                          </div>
                          <div>
                            <p className="font-medium">{item.typeName}</p>
                            <p className="text-sm text-muted-foreground">{item.count} {t("auto.text_9e2f33")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">${item.profit.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("finance.revenue")}: ${item.revenue.toFixed(2)} | {t("auto.text_080d04")}: ${item.cost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${profitPercent}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {profitPercent.toFixed(1)}% {t("auto.text_9e81c8")}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t("auto.text_f48797")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Services Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("auto.text_295586")}
            </CardTitle>
            <CardDescription>Detailed list of all services</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.quantity")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("customers.title")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-right">{t("auto.text_080d04")} </TableHead>
                  <TableHead className="text-right">{t("common.price")}</TableHead>
                  <TableHead className="text-right">{t("finance.profit")}</TableHead>
                  <TableHead>{t("auto.text_8c5ef6")} </TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services?.services?.map((service) => {
                  const profit = Number(service.priceAmount || 0) - Number(service.costAmount || 0);
                  return (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono text-sm">{service.serviceNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getServiceTypeIcon(service.serviceTypeId)}</span>
                          <span className="text-sm">{getServiceTypeName(service.serviceTypeId)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getCustomerName(service.customerId)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{service.description}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        ${Number(service.costAmount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        ${Number(service.priceAmount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${profit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.isPaid ? "default" : "secondary"}>
                          {service.isPaid ? t("auto.text_045bc6") : t("common.unpaid")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(service.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!services?.services || services.services.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {t("auto.text_f48797")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
