import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Crown, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export function CustomerAnalyticsSection() {
  const { t } = useTranslation();

  const { data: topCustomers } = trpc.reports.topCustomers.useQuery({ limit: 5 });
  const { data: customersWithDebt } = trpc.reports.customersWithDebt.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();

  const getCustName = (id: number) => {
    const c = customers?.find((c) => c.id === id);
    return { name: c?.fullName || `#${id}`, code: c?.customerCode || "" };
  };

  const handleExportDebt = async () => {
    if (!customersWithDebt || customersWithDebt.length === 0) {
      toast.error(t("toast.noDataToExport"));
      return;
    }
    const data = customersWithDebt.map((c) => ({
      [t("reports.customerName")]: getCustName(c.customerId).name,
      [t("reports.customerCode")]: getCustName(c.customerId).code,
      [t("reports.outstandingDebt")]: Math.abs(Number(c.latestBalance || 0)),
    }));
    // Loaded on demand so the heavy xlsx bundle stays out of the page chunk.
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Debt Report");
    XLSX.writeFile(wb, `debt-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(t("toast.excelDownloaded"));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Top Customers */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            {t("reports.topCustomers")}
          </CardTitle>
          <CardDescription>{t("reports.topCustomersDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("reports.customerName")}</TableHead>
                <TableHead className="text-end">{t("reports.packagesCount")}</TableHead>
                <TableHead className="text-end">{t("reports.totalRevenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomers?.slice(0, 5).map((customer, index) => {
                const { name, code } = getCustName(customer.customerId);
                return (
                  <TableRow key={customer.customerId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                            index === 0
                              ? "bg-amber-500"
                              : index === 1
                                ? "bg-slate-400"
                                : index === 2
                                  ? "bg-amber-700"
                                  : "bg-slate-300"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-semibold">{customer.packageCount}</TableCell>
                    <TableCell className="text-end font-semibold text-green-600">
                      ${Number(customer.totalCharges || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!topCustomers || topCustomers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    {t("reports.noDataAvailable")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Outstanding Balances */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {t("reports.outstandingBalances")}
              </CardTitle>
              <CardDescription>{t("reports.outstandingBalancesDesc")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportDebt}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("reports.customerName")}</TableHead>
                <TableHead className="text-end">{t("reports.balance")}</TableHead>
                <TableHead className="text-end">{t("reports.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersWithDebt?.slice(0, 5).map((customer) => {
                const { name, code } = getCustName(customer.customerId);
                const balance = Number(customer.latestBalance || 0);
                return (
                  <TableRow key={customer.customerId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-semibold text-red-600">
                      -${Math.abs(balance).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end">
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:text-red-300 dark:bg-red-950/30 dark:border-red-800">
                        {t("reports.overdue")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!customersWithDebt || customersWithDebt.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                    {t("reports.noOutstandingBalances")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
