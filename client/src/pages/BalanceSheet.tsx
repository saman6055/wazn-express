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
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { Link } from "wouter";

export default function BalanceSheet() {
    const { t } = useTranslation();
  const { language } = useLanguage();
const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // Fetch financial data
  const { data: dashboardStats } = trpc.financeIntegration.dashboardStats.useQuery();
  const { data: cashAccounts } = trpc.cashAccounts?.list?.useQuery() || { data: [] };
  // The two sides of the sheet, each read from the screen that owns it: the
  // customer ledger for what is owed to us and held for customers, and the
  // company debts register for what we owe.
  const { data: ledgerSummary } = trpc.ledger.getSummary.useQuery();
  const { data: companyDebts } = trpc.companyDebts.list.useQuery();

  // Calculate totals
  // `acc.balance` is not a column. The account row carries `currentBalance`,
  // so this read `parseFloat(undefined || '0')` for every account and the
  // page reported the company held no cash at all, however much was in the
  // Treasury.
  const totalCash = (cashAccounts as any[] || []).reduce(
    (sum: number, acc: any) => sum + parseFloat(acc.currentBalance ?? '0'),
    0
  );
  /**
   * What customers owe us — the debtors report, summed.
   *
   * This was the month's net profit. Not an approximation of receivables: a
   * different quantity entirely, which happened to be a number in dollars, so
   * nothing about the page looked wrong.
   */
  const totalReceivables = Number((ledgerSummary as any)?.totalDebtUsd ?? 0);
  const debtorsCount = Number((ledgerSummary as any)?.debtorsCount ?? 0);

  /**
   * Money customers paid in advance and have not used. Ours to hold, not ours
   * to keep — a balance sheet that leaves it out overstates the company by
   * exactly that amount.
   */
  const customerCredit = Number((ledgerSummary as any)?.totalCreditUsd ?? 0);

  /**
   * Loans and supplier debts still outstanding.
   *
   * This was the literal 0, so the company appeared to owe nobody anything
   * however many debts were recorded on the screen next door.
   */
  const outstandingDebts = ((companyDebts as any[]) || []).filter((d) => d?.status !== "paid");
  const totalCompanyDebt = outstandingDebts.reduce(
    (sum: number, d: any) => sum + parseFloat(d?.remainingAmount ?? "0"),
    0,
  );

  const totalPayables = totalCompanyDebt + customerCredit;
  
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
    // These lines wrote the source of the translation call into the file:
    // the export was a spreadsheet of `{t("auto.text_ebf719")}` rows.
    const money = (n: number) => n.toFixed(2);
    const label = (key: string, fallback: string) => t(key) || fallback;

    let csv = `${label("nav.balanceSheet", "Balance sheet")}\n`;
    csv += `${label("common.date", "Date")}: ${selectedDate}\n\n`;

    csv += `${label("balanceSheet.assets", "Assets")}\n`;
    csv += `${label("balanceSheet.cash", "Cash")},$${money(totalCash)}\n`;
    csv += `${label("balanceSheet.receivables", "Receivables")},$${money(totalReceivables)}\n`;
    csv += `${label("balanceSheet.totalAssets", "Total assets")},$${money(totalAssets)}\n\n`;

    csv += `${label("balanceSheet.liabilities", "Liabilities")}\n`;
    csv += `${label("balanceSheet.companyDebts", "Loans and supplier debts")},$${money(totalCompanyDebt)}\n`;
    csv += `${label("balanceSheet.customerCredit", "Customer credit held")},$${money(customerCredit)}\n`;
    csv += `${label("balanceSheet.totalLiabilities", "Total liabilities")},$${money(totalLiabilities)}\n\n`;

    csv += `${label("balanceSheet.equity", "Equity")}\n`;
    csv += `${label("balanceSheet.netWorth", "Net worth")},$${money(equity)}\n`;

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
              
              {/* One row per real account, and nothing else.
                  This used to show "cash on hand" as 60% of the total and
                  "bank" as 40% — a split nobody chose, printed on a financial
                  statement as though it had been counted. */}
              <div className="space-y-3">
                {((cashAccounts as any[]) || []).map((acc: any) => (
                  <SheetRow
                    key={acc.id}
                    icon={<Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />}
                    tint="bg-emerald-100 dark:bg-emerald-950/40"
                    label={acc.name || acc.accountName || t("finance.cashAccount") || "Cash account"}
                    amount={parseFloat(acc.currentBalance ?? "0")}
                    href="/company/treasury"
                  />
                ))}

                {((cashAccounts as any[]) || []).length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {pickLang(language, {
                      ku: "هیچ حسابێکی پارە تۆمار نەکراوە",
                      en: "No cash accounts recorded",
                      ar: "لا توجد حسابات نقدية مسجلة",
                      zh: "未记录任何现金账户",
                    })}
                  </p>
                )}

                <SheetRow
                  icon={<Users className="h-4 w-4 text-amber-600 dark:text-amber-300" />}
                  tint="bg-amber-100 dark:bg-amber-950/40"
                  label={pickLang(language, {
                    ku: "قەرزی کڕیاران بەسەرمانەوە",
                    en: "Owed to us by customers",
                    ar: "مستحقات على العملاء",
                    zh: "客户欠款",
                  })}
                  note={pickLang(language, {
                    ku: `${debtorsCount} کڕیار`,
                    en: `${debtorsCount} customers`,
                    ar: `${debtorsCount} عميل`,
                    zh: `${debtorsCount} 位客户`,
                  })}
                  amount={totalReceivables}
                  href="/finance/debtors"
                />
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
              
              {/* Both lines are real records now. This card used to be one
                  figure that was always 0 and two rows hardcoded to $0, so
                  the company appeared to owe nobody anything however many
                  loans were entered on the debts screen. */}
              <div className="space-y-3">
                <SheetRow
                  icon={<Landmark className="h-4 w-4 text-red-600 dark:text-red-300" />}
                  tint="bg-red-100 dark:bg-red-950/40"
                  label={pickLang(language, {
                    ku: "قەرز و داوای دابینکەران",
                    en: "Loans and supplier debts",
                    ar: "القروض وديون الموردين",
                    zh: "贷款与供应商欠款",
                  })}
                  note={pickLang(language, {
                    ku: `${outstandingDebts.length} تۆمار`,
                    en: `${outstandingDebts.length} records`,
                    ar: `${outstandingDebts.length} سجل`,
                    zh: `${outstandingDebts.length} 条记录`,
                  })}
                  amount={totalCompanyDebt}
                  href="/company/debts"
                />

                <SheetRow
                  icon={<CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-300" />}
                  tint="bg-orange-100 dark:bg-orange-950/40"
                  label={pickLang(language, {
                    ku: "پارەی پێشەکی کڕیاران لای ئێمە",
                    en: "Customer credit we are holding",
                    ar: "أرصدة العملاء المدفوعة مقدماً",
                    zh: "代客户保管的预付款",
                  })}
                  note={pickLang(language, {
                    ku: "پارەیە کە دراوە و هێشتا بەکارنەهاتووە",
                    en: "Paid in advance and not yet used",
                    ar: "دفعت مقدماً ولم تُستخدم بعد",
                    zh: "已预付但尚未使用",
                  })}
                  amount={customerCredit}
                  href="/finance?tab=credit-customers"
                />
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
              
              {/* Equity is what is left, and saying so is the whole of it.
                  Two of the three rows here were hardcoded zeros dressed as
                  capital and drawings, which the company does not track. */}
              <div className="space-y-3">
                <SheetRow
                  icon={<PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />}
                  tint="bg-emerald-100 dark:bg-emerald-950/40"
                  label={pickLang(language, {
                    ku: "سامان − قەرز",
                    en: "Assets − liabilities",
                    ar: "الأصول − الالتزامات",
                    zh: "资产 − 负债",
                  })}
                  note={`$${totalAssets.toLocaleString()} − $${totalLiabilities.toLocaleString()}`}
                  amount={equity}
                />
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

/**
 * One line of the sheet: what it is, how much, and where the records are.
 *
 * Every line on a financial statement should be answerable. Before this the
 * page carried invented splits and hardcoded zeros that looked exactly like
 * the real figures beside them, and nothing distinguished the two.
 */
function SheetRow({
  icon,
  tint,
  label,
  note,
  amount,
  href,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  note?: string;
  amount: number;
  href?: string;
}) {
  const body = (
    <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-8 w-8 shrink-0 rounded-full ${tint} flex items-center justify-center`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate">{label}</p>
          {note && <p className="text-xs text-muted-foreground truncate">{note}</p>}
        </div>
      </div>
      <span className="font-semibold shrink-0" dir="ltr">
        ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block hover:opacity-80 transition-opacity">
      {body}
    </Link>
  );
}
