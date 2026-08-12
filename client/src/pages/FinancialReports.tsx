import { useState, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/contexts/LanguageContext";
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
import { 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  PiggyBank,
  Landmark,
  Users,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  BarChart3,
  PieChart,
  Download,
  RefreshCw
} from "lucide-react";

export default function FinancialReports() {
    const { t } = useTranslation();
const [activeTab, setActiveTab] = useState("pnl");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Calculate date range for selected month
  const dateRange = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
    return { start, end };
  }, [selectedMonth, selectedYear]);

  // Queries
  const { data: profitLoss, isLoading: loadingPnL } = trpc.financialReports.getProfitAndLoss.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const { data: partners = [] } = trpc.partners.list.useQuery();
  const { data: debts = [] } = trpc.companyDebts.list.useQuery();
  const { data: accounts = [] } = trpc.cashAccounts.list.useQuery();
  const { data: expenseSummary } = trpc.expenses.getSummary.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // PDF Generation mutations
  const generatePnLPDF = trpc.financialReports.generateProfitLossPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success('ڕاپۆرتی PDF دروستکرا');
    },
    onError: () => toast.error('هەڵە لە دروستکردنی PDF'),
  });

  const generateBalanceSheetPDF = trpc.financialReports.generateBalanceSheetPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success('تەرازووی دارایی PDF دروستکرا');
    },
    onError: () => toast.error('هەڵە لە دروستکردنی PDF'),
  });

  const generatePartnerPDF = trpc.financialReports.generatePartnerReportPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success('ڕاپۆرتی شەریک PDF دروستکرا');
    },
    onError: () => toast.error('هەڵە لە دروستکردنی PDF'),
  });

  const generateExpensePDF = trpc.financialReports.generateExpenseReportPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success('ڕاپۆرتی مەسروفات PDF دروستکرا');
    },
    onError: () => toast.error('هەڵە لە دروستکردنی PDF'),
  });

  const generateDebtPDF = trpc.financialReports.generateDebtSchedulePDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success('خشتەی قەرز PDF دروستکرا');
    },
    onError: () => toast.error('هەڵە لە دروستکردنی PDF'),
  });

  // Month names in English for PDF
  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const formatCurrency = (amount: number | string | undefined) => {
    const num = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Calculate totals for Balance Sheet
  const totalCash = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const totalDebt = debts.filter(d => d.status === "active" || d.status === "overdue")
    .reduce((sum, d) => sum + Number(d.remainingAmount), 0);
  const totalPartnerCapital = partners.reduce((sum, p) => sum + Number(p.initialCapital), 0);
  const totalRetainedEarnings = partners.reduce((sum, p) => sum + Number(p.currentBalance), 0);
  const totalEquity = totalPartnerCapital + totalRetainedEarnings;

  // Month names in Kurdish
  const monthNames = [
    t("auto.text_655e96"),
    t("auto.text_7afb29")
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("auto.text_faf2f8")} </h1>
            <p className="text-muted-foreground">
              ڕ{t("auto.text_b94fcd")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 border-green-200 dark:border-green-800/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("finance.income")}</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(profitLoss?.revenue.totalRevenue)}
              </div>
              <p className="text-xs text-green-600/70 dark:text-green-300">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-900 border-red-200 dark:border-red-800/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("auto.text_481d09")} </CardTitle>
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {formatCurrency(profitLoss?.expenses.totalExpenses)}
              </div>
              <p className="text-xs text-red-600/70 dark:text-red-300">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${
            (profitLoss?.netProfit || 0) >= 0 
              ? 'from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800/60'
              : 'from-orange-50 to-amber-100 dark:from-orange-950 dark:to-amber-900 border-orange-200 dark:border-orange-800/60'
          }`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("auto.text_723f22")} </CardTitle>
              <DollarSign className={`h-5 w-5 ${(profitLoss?.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (profitLoss?.netProfit || 0) >= 0 
                  ? 'text-blue-700 dark:text-blue-400' 
                  : 'text-orange-700 dark:text-orange-400'
              }`}>
                {formatCurrency(profitLoss?.netProfit)}
              </div>
              <p className={`text-xs ${(profitLoss?.netProfit || 0) >= 0 ? 'text-blue-600/70' : 'text-orange-600/70'}`}>
                {t("auto.text_fbfa99")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("auto.text_3ec9b2")} </CardTitle>
              <PiggyBank className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {formatCurrency(totalCash)}
              </div>
              <p className="text-xs text-muted-foreground">{t("auto.text_e6aa78")} </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pnl" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("auto.text_bfff21")}
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              {t("auto.text_c8332a")}
            </TabsTrigger>
            <TabsTrigger value="partners" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("auto.text_b3c156")}
            </TabsTrigger>
          </TabsList>

          {/* Profit & Loss Tab */}
          <TabsContent value="pnl" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    ڕ{t("auto.text_009b83")}
                  </CardTitle>
                  <CardDescription>
                    {monthNames[selectedMonth - 1]} {selectedYear}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generatePnLPDF.mutate({
                    month: monthNamesEn[selectedMonth - 1],
                    year: selectedYear,
                  })}
                  disabled={generatePnLPDF.isPending}
                >
                  <Download className="h-4 w-4 me-2" />
                  {generatePnLPDF.isPending ? '{t("auto.text_8d68fe")}...' : 'PDF'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Revenue Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 border-b pb-2">
                      {t("finance.revenue")} (Revenue)
                    </h3>
                    <div className="space-y-2 pl-4">
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">{t("auto.text_42db23")} </span>
                        <span className="font-medium">{formatCurrency(profitLoss?.revenue.packageRevenue)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">{t("auto.text_256a1c")} </span>
                        <span className="font-medium">{formatCurrency(profitLoss?.revenue.fullPackageRevenue)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">{t("auto.text_32facb")} </span>
                        <span className="font-medium">{formatCurrency(profitLoss?.revenue.otherRevenue)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-t font-semibold text-green-700 dark:text-green-400">
                      <span>{t("auto.text_3a3774")} </span>
                      <span>{formatCurrency(profitLoss?.revenue.totalRevenue)}</span>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 border-b pb-2">
                      {t("auto.text_481d09")} (Expenses)
                    </h3>
                    <div className="space-y-2 pl-4">
                      {profitLoss?.expenses.byCategory.map((cat, index) => (
                        <div key={index} className="flex justify-between py-1">
                          <span className="text-muted-foreground">{cat.categoryName}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">-{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                      {(!profitLoss?.expenses.byCategory || profitLoss.expenses.byCategory.length === 0) && (
                        <div className="text-muted-foreground text-sm py-2">
                          {t("auto.text_f90503")}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between py-2 border-t font-semibold text-red-700 dark:text-red-400">
                      <span>{t("auto.text_5c09dc")} </span>
                      <span>-{formatCurrency(profitLoss?.expenses.totalExpenses)}</span>
                    </div>
                  </div>

                  {/* Net Profit */}
                  <div className={`rounded-xl p-4 ${
                    (profitLoss?.netProfit || 0) >= 0 
                      ? 'bg-green-100 dark:bg-green-950' 
                      : 'bg-red-100 dark:bg-red-950'
                  }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-lg font-bold">
                          {(profitLoss?.netProfit || 0) >= 0 ? t("auto.text_d62fc0") : t("auto.text_loss")}
                        </span>
                        <p className="text-sm text-muted-foreground">{t("auto.text_fbfa99")} </p>
                      </div>
                      <span className={`text-3xl font-bold ${
                        (profitLoss?.netProfit || 0) >= 0 
                          ? 'text-green-700 dark:text-green-400' 
                          : 'text-red-700 dark:text-red-400'
                      }`}>
                        {formatCurrency(profitLoss?.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="balance" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    {t("auto.text_c8332a")} (Balance Sheet)
                  </CardTitle>
                  <CardDescription>
                    {t("auto.text_89726d")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateBalanceSheetPDF.mutate()}
                  disabled={generateBalanceSheetPDF.isPending}
                >
                  <Download className="h-4 w-4 me-2" />
                  {generateBalanceSheetPDF.isPending ? '{t("auto.text_8d68fe")}...' : 'PDF'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Assets */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 border-b pb-2">
                      {t("auto.text_7f7e74")} (Assets)
                    </h3>
                    
                    {/* Current Assets */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-muted-foreground">{t("auto.text_f38a67")} </h4>
                      {accounts.filter(a => a.isActive).map((account) => (
                        <div key={account.id} className="flex justify-between py-1 pl-4">
                          <span className="text-sm">{account.accountName}</span>
                          <span className="font-medium">{formatCurrency(account.currentBalance)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between py-2 border-t font-semibold text-blue-700 dark:text-blue-400">
                      <span>{t("auto.text_398805")} </span>
                      <span>{formatCurrency(totalCash)}</span>
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 border-b pb-2">
                      {t("auto.text_60609f")} (Liabilities & Equity)
                    </h3>
                    
                    {/* Liabilities */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-muted-foreground">{t("companyFinance.debts")}</h4>
                      {debts.filter(d => d.status === "active" || d.status === "overdue").map((debt) => (
                        <div key={debt.id} className="flex justify-between py-1 pl-4">
                          <span className="text-sm">{debt.creditorName}</span>
                          <span className="font-medium text-red-600 dark:text-red-300">{formatCurrency(debt.remainingAmount)}</span>
                        </div>
                      ))}
                      {debts.filter(d => d.status === "active" || d.status === "overdue").length === 0 && (
                        <div className="text-muted-foreground text-sm py-1 pl-4">
                          {t("auto.text_87ca55")}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between py-2 border-t font-semibold text-red-700 dark:text-red-400">
                      <span>{t("finance.totalDebt")}</span>
                      <span>{formatCurrency(totalDebt)}</span>
                    </div>

                    {/* Equity */}
                    <div className="space-y-2 mt-4">
                      <h4 className="font-medium text-muted-foreground">{t("auto.text_b35f1a")} </h4>
                      <div className="flex justify-between py-1 pl-4">
                        <span className="text-sm">{t("auto.text_444ee9")} </span>
                        <span className="font-medium">{formatCurrency(totalPartnerCapital)}</span>
                      </div>
                      <div className="flex justify-between py-1 pl-4">
                        <span className="text-sm">{t("auto.text_6a31c2")} </span>
                        <span className={`font-medium ${totalRetainedEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totalRetainedEarnings)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between py-2 border-t font-semibold text-purple-700 dark:text-purple-400">
                      <span>{t("auto.text_66dedb")} </span>
                      <span>{formatCurrency(totalEquity)}</span>
                    </div>

                    <div className="flex justify-between py-2 border-t-2 font-bold">
                      <span>{t("auto.text_284919")} </span>
                      <span>{formatCurrency(totalDebt + totalEquity)}</span>
                    </div>
                  </div>
                </div>

                {/* Balance Check */}
                <div className={`mt-6 rounded-xl p-4 ${
                  Math.abs(totalCash - (totalDebt + totalEquity)) < 0.01
                    ? 'bg-green-100 dark:bg-green-950'
                    : 'bg-yellow-100 dark:bg-yellow-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {Math.abs(totalCash - (totalDebt + totalEquity)) < 0.01
                        ? '✓ تەرازوو دروستە'
                        : '⚠ تەرازوو دروست نییە'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("auto.text_59f4d0")}: {formatCurrency(Math.abs(totalCash - (totalDebt + totalEquity)))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("auto.text_b3c156")}
                </CardTitle>
                <CardDescription>
                  {t("auto.text_005a3e")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("auto.text_5003f0")} </TableHead>
                      <TableHead className="text-center">{t("auto.text_f14d9f")} </TableHead>
                      <TableHead className="text-right">{t("auto.text_444ee9")} </TableHead>
                      <TableHead className="text-right">{t("auto.text_bf07cb")} </TableHead>
                      <TableHead className="text-right">{t("auto.text_66dedb")} </TableHead>
                      <TableHead className="text-right">{t("auto.text_8857f0")} </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.map((partner) => {
                      const equity = Number(partner.initialCapital) + Number(partner.currentBalance);
                      const profitShare = (profitLoss?.netProfit || 0) * (Number(partner.ownershipPercentage) / 100);
                      return (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">
                            {partner.nameKu || partner.name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{partner.ownershipPercentage}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(partner.initialCapital)}
                          </TableCell>
                          <TableCell className={`text-right ${Number(partner.currentBalance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(partner.currentBalance)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(equity)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${profitShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(profitShare)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {partners.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t("auto.text_e4411e")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Partner Summary */}
                {partners.length > 0 && (
                  <div className="mt-6 grid md:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950 p-4">
                      <p className="text-sm text-muted-foreground">{t("auto.text_341d85")} </p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {formatCurrency(totalPartnerCapital)}
                      </p>
                    </div>
                    <div className={`rounded-xl p-4 ${totalRetainedEarnings >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                      <p className="text-sm text-muted-foreground">{t("auto.text_86655b")} </p>
                      <p className={`text-2xl font-bold ${totalRetainedEarnings >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {formatCurrency(totalRetainedEarnings)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-purple-50 dark:bg-purple-950 p-4">
                      <p className="text-sm text-muted-foreground">{t("auto.text_dd27c5")} </p>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                        {formatCurrency(totalEquity)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
