import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Wallet,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Calendar,
  CreditCard,
  Banknote,
  Users,
  Package,
  Landmark,
  PiggyBank,
  Scale,
  ArrowRight
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";

export default function BalanceSheet() {
    const { t } = useTranslation();
const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // Fetch financial data
  const { data: dashboardStats } = trpc.financeIntegration.dashboardStats.useQuery();
  const { data: cashAccounts } = trpc.cashAccounts?.list?.useQuery() || { data: [] };

  // Calculate totals
  const totalCash = (cashAccounts as any[] || []).reduce((sum: number, acc: any) => sum + parseFloat(acc.balance || '0'), 0);
  const totalReceivables = (dashboardStats as any)?.profitLoss?.netProfit || 0; // Money owed to us (approximation)
  const totalPayables = 0; // Money we owe (would come from supplier debts)
  
  const totalAssets = totalCash + totalReceivables;
  const totalLiabilities = totalPayables;
  const equity = totalAssets - totalLiabilities;

  // Generate dates for selector
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      label: date.toLocaleDateString('ku', { year: 'numeric', month: 'long', day: 'numeric' })
    });
  }

  const exportToExcel = () => {
    let csv = '{t("auto.text_ebf719")}\n';
    csv += `{t("auto.text_cb2f35")}: ${selectedDate}\n\n`;
    
    csv += '{t("auto.text_921f9e")} (Assets)\n';
    csv += `{t("auto.text_647643")},$${totalCash}\n`;
    csv += `{t("auto.text_ddf1ac")},$${totalReceivables}\n`;
    csv += `{t("auto.text_6ca2b0")},$${totalAssets}\n\n`;
    
    csv += '{t("auto.text_701a1e")} (Liabilities)\n';
    csv += `{t("auto.text_7e7304")},$${totalPayables}\n`;
    csv += `{t("auto.text_96973f")},$${totalLiabilities}\n\n`;
    
    csv += '{t("auto.text_cdeec4")} (Equity)\n';
    csv += `{t("auto.text_04b4f4")},$${equity}\n`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `balance-sheet-${selectedDate}.csv`;
    link.click();
  };

  return (
    <DashboardLayout>
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-purple-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("auto.text_5263d2")} </h1>
            <p className="text-purple-100 mt-1">{t("auto.text_cb601a")} </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                <Calendar className="h-4 w-4 ms-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dates.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 ms-2" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Balance Equation */}
      <Card className="bg-gradient-to-r from-blue-50 via-white to-purple-50 border-2 border-blue-200 dark:border-blue-800/60">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4 text-center">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_ca725c")} </p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">${totalAssets.toLocaleString()}</p>
            </div>
            <div className="text-2xl text-muted-foreground">=</div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_439568")} </p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-300">${totalLiabilities.toLocaleString()}</p>
            </div>
            <div className="text-2xl text-muted-foreground">+</div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_e4735e")} </p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-300">${equity.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assets */}
        <Card className="border-blue-200 dark:border-blue-800/60">
          <CardHeader className="bg-blue-50 dark:bg-blue-950/40 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <TrendingUp className="h-5 w-5" />
              {t("auto.text_921f9e")} (Assets)
            </CardTitle>
            <CardDescription>{t("auto.text_8e869f")} </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Current Assets */}
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">{t("auto.text_425771")} </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <span>{t("auto.text_7725d0")} </span>
                  </div>
                  <span className="font-semibold">${(totalCash * 0.6).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                    </div>
                    <span>{t("auto.text_e3d705")} </span>
                  </div>
                  <span className="font-semibold">${(totalCash * 0.4).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                      <Users className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    </div>
                    <span>{t("auto.text_ddf1ac")} </span>
                  </div>
                  <span className="font-semibold">${totalReceivables.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
                      <Package className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                    </div>
                    <span>{t("auto.text_a581a2")} </span>
                  </div>
                  <span className="font-semibold">$0</span>
                </div>
              </div>
            </div>

            {/* Total Assets */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-700 dark:text-blue-300">{t("auto.text_6ca2b0")} </span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">${totalAssets.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card className="border-red-200 dark:border-red-800/60">
          <CardHeader className="bg-red-50 dark:bg-red-950/40 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <TrendingDown className="h-5 w-5" />
              {t("auto.text_701a1e")} (Liabilities)
            </CardTitle>
            <CardDescription>{t("auto.text_e3ca66")} </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Current Liabilities */}
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">{t("auto.text_7f8766")} </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                      <Users className="h-4 w-4 text-red-600 dark:text-red-300" />
                    </div>
                    <span>{t("auto.text_7e7304")} </span>
                  </div>
                  <span className="font-semibold">${totalPayables.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-300" />
                    </div>
                    <span>{t("auto.text_a139ef")} </span>
                  </div>
                  <span className="font-semibold">$0</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center">
                      <Landmark className="h-4 w-4 text-pink-600 dark:text-pink-300" />
                    </div>
                    <span>{t("auto.text_812278")} </span>
                  </div>
                  <span className="font-semibold">$0</span>
                </div>
              </div>
            </div>

            {/* Total Liabilities */}
            <div className="p-4 bg-red-50 dark:bg-red-950/40">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-700 dark:text-red-300">{t("finance.totalDebt")}</span>
                <span className="text-xl font-bold text-red-700 dark:text-red-300">${totalLiabilities.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equity */}
        <Card className="border-emerald-200 dark:border-emerald-800/60">
          <CardHeader className="bg-emerald-50 dark:bg-emerald-950/40 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Scale className="h-5 w-5" />
              {t("auto.text_cdeec4")} (Equity)
            </CardTitle>
            <CardDescription>{t("auto.text_6388ce")} </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">{t("auto.text_f7cab8")} </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                      <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <span>{t("auto.text_444ee9")} </span>
                  </div>
                  <span className="font-semibold">$0</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                    </div>
                    <span>{t("auto.text_2252fe")} </span>
                  </div>
                  <span className="font-semibold">${equity.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-950/40 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                    </div>
                    <span>{t("auto.text_2c8e0f")} </span>
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-300">-$0</span>
                </div>
              </div>
            </div>

            {/* Total Equity */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{t("auto.text_66dedb")} </span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">${equity.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Ratios */}
      <Card>
        <CardHeader>
          <CardTitle>{t("auto.text_c0f05d")} </CardTitle>
          <CardDescription>{t("auto.text_ba5a53")} </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_1e7fbd")} </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                {totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : '∞'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("auto.text_5d5ee4")} </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_6324b1")} </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-300">
                {totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : '0'}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("auto.text_777e54")} </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_efd50b")} </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                {totalAssets > 0 ? ((equity / totalAssets) * 100).toFixed(1) : '100'}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("auto.text_d16b24")} </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">{t("auto.text_14042d")} </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                ${(totalAssets - totalLiabilities).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("auto.text_a2f5bf")} </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("auto.text_2bac84")} </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t("auto.text_e44e11")} </p>
            <p>{t("auto.text_a6de88")} </p>
            <p>{t("auto.text_95a6ec")} </p>
            <p>{t("auto.text_49ea80")} </p>
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
