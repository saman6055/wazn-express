import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { Link, useLocation, useSearch } from "wouter";
import { lazy } from "react";
// Lazy: only the active skin's chunk is downloaded (global admin setting).
const ModernPortalFinancial = lazy(() => import("./modern/ModernPortalFinancial"));
const Skin3PortalFinancial = lazy(() => import("./skin3/Skin3PortalFinancial"));
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Wallet, ArrowDownLeft, ArrowUpRight, Calendar, FileText, 
  TrendingUp, TrendingDown, Download, CreditCard, Receipt,
  ChevronRight, DollarSign, Clock, CheckCircle2, AlertCircle,
  BarChart3, PieChart, Eye, Search, Filter, XCircle, Printer,
  Building2, MapPin, Phone, Mail, Hash, Package
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatementPdfButton } from "@/components/portal/StatementPdfButton";
import { OrderBillingGroups } from "@/components/portal/OrderBillingGroups";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { pickLang } from "@/lib/lang";
import {
  isDebt as isDebtBalance,
  isCredit as isCreditBalance,
  INVOICE_STATE_LABEL,
  INVOICE_STATE_PRINT,
  INVOICE_STATE_TONE,
  invoiceState,
  isCreditTx,
  isInvoiceOutstanding,
} from "@/lib/portalMoney";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

// Deep-link a ledger transaction to the section it was raised for, so tapping a
// row jumps straight to the relevant package/order/prohibited item.
function txHref(tx: any): string | null {
  const rid = tx?.referenceId ? String(tx.referenceId) : null;
  switch (tx?.referenceType) {
    case "service": return rid ? `/portal/prohibited-packages?focus=${rid}` : "/portal/prohibited-packages";
    case "full_package":
    case "purchase_request":
    case "commission": return rid ? `/portal/full-package?order=${rid}` : "/portal/full-package";
    case "package": return rid ? `/portal/shipments?focus=${rid}` : "/portal/shipments";
    default: return null;
  }
}

function ClassicPortalFinancial() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const [dateRange, setDateRange] = useState<"all" | "month" | "year">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null);
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab");
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">(
    // "invoices" used to be accepted here and rendered a blank body: there is
    // no such tab, only an invoice dialog opened from a transaction row.
    urlTab === "transactions" ? urlTab : "overview"
  );
  // Keep the active tab in the URL so navigating to an order and pressing Back
  // returns the customer to the same tab (e.g. "transactions") they came from.
  const changeTab = (tab: "overview" | "transactions") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchString);
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    setLocation(`/portal/financial${qs ? `?${qs}` : ""}`, { replace: true });
  };
  const [animatedBalance, setAnimatedBalance] = useState(0);
  
  const { data: summary, isLoading: summaryLoading } = trpc.customerPortal.getMyFinancialSummary.useQuery();
  const { data: transactions, isLoading: transactionsLoading, isError: transactionsError, isFetching: transactionsFetching, refetch: refetchTransactions } = trpc.customerPortal.getMyTransactions.useQuery({ limit: 50 });
  const { data: receiptData, isLoading: receiptLoading } = trpc.customerPortal.getReceiptData.useQuery(
    { transactionId: selectedTransaction! },
    { enabled: !!selectedTransaction }
  );
  const { data: invoices, isLoading: invoicesLoading } = trpc.customerPortal.getMyInvoices.useQuery();
  // Company info for the invoice/receipt header — via the PUBLIC
  // settings.getCompanyInfo endpoint. The old trpc.settings.list is a
  // staffProcedure: a portal customer hitting it threw FORBIDDEN, which the
  // global redirect-on-auth-error subscriber turned into a forced logout.
  const company = useCompanyInfo();
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "paid" | "cancelled">("all");

  // Animate balance on load
  const balance = summary?.balanceUsd || 0;
  useEffect(() => {
    // Landing exactly on zero used to skip this entirely, so a customer who
    // had just paid in full kept staring at the balance they had cleared.
    if (balance === 0) {
      setAnimatedBalance(0);
      return;
    }
    {
      const duration = 1500;
      const steps = 60;
      const increment = balance / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= balance) || (increment < 0 && current <= balance)) {
          setAnimatedBalance(balance);
          clearInterval(timer);
        } else {
          setAnimatedBalance(current);
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [balance]);

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    if (!transactions) return { payments: 0, charges: 0, count: 0 };
    const now = new Date();
    const thisMonth = transactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    });
    return {
      payments: thisMonth.filter(tx => isCreditTx(tx.transactionType)).reduce((sum, tx) => sum + Number(tx.amountUsd), 0),
      charges: thisMonth.filter(tx => tx.transactionType.startsWith("DEBIT_")).reduce((sum, tx) => sum + Number(tx.amountUsd), 0),
      count: thisMonth.length
    };
  }, [transactions]);

  // Last 6 months chart data
  const chartData = useMemo(() => {
    if (!transactions) return [];
    const months: { month: string; payments: number; charges: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString("en-US", { month: "short" });
      const monthTxs = transactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate.getMonth() === date.getMonth() && txDate.getFullYear() === date.getFullYear();
      });
      months.push({
        month: monthName,
        payments: monthTxs.filter(tx => isCreditTx(tx.transactionType)).reduce((sum, tx) => sum + Number(tx.amountUsd), 0),
        charges: monthTxs.filter(tx => tx.transactionType.startsWith("DEBIT_")).reduce((sum, tx) => sum + Number(tx.amountUsd), 0)
      });
    }
    return months;
  }, [transactions]);

  const maxChartValue = useMemo(() => {
    return Math.max(...chartData.map(d => Math.max(d.payments, d.charges)), 1);
  }, [chartData]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    if (currency === "IQD") {
      return new Intl.NumberFormat("en-US", { style: "decimal" }).format(amount) + " IQD";
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    if (isCreditTx(type)) {
      return <ArrowDownLeft className="w-4 h-4" />;
    }
    return <ArrowUpRight className="w-4 h-4" />;
  };

  const getTransactionColor = (type: string, isDark: boolean) => {
    if (isCreditTx(type)) {
      return { 
        bg: isDark ? "bg-emerald-900/50" : "bg-emerald-100 dark:bg-emerald-950/40", 
        icon: "text-emerald-500", 
        amount: "text-emerald-500" 
      };
    }
    return { 
      bg: isDark ? "bg-red-900/50" : "bg-red-100 dark:bg-red-950/40", 
      icon: "text-red-500", 
      amount: "text-red-500" 
    };
  };

  const getTransactionTypeName = (type: string) => {
    switch (type) {
      case "DEBIT_PACKAGE": return pickLang(language, { ku: "کرێی گەیاندن", en: "Delivery Charge", ar: "رسوم التوصيل", zh: "配送费" });
      case "DEBIT_SERVICE": return pickLang(language, { ku: "کرێی خزمەتگوزاری", en: "Service Fee", ar: "رسوم الخدمة", zh: "服务费" });
      case "CREDIT_PAYMENT": return pickLang(language, { ku: "پارەدان", en: "Payment", ar: "دفعة", zh: "付款" });
      case "CREDIT_REFUND": return pickLang(language, { ku: "گەڕاندنەوە", en: "Refund", ar: "استرداد", zh: "退款" });
      case "CREDIT_DISCOUNT": return pickLang(language, { ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" });
      default: return type.replace(/_/g, " ");
    }
  };

  const downloadReceipt = () => {
    if (!receiptData) return;
    const { transaction, customer, companyName, generatedAt } = receiptData;
    
    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt - ${transaction.transactionNumber}</title><style>body{font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}.logo{font-size:24px;font-weight:bold;color:#1e3a5f}.receipt-title{font-size:18px;margin-top:10px}.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ccc}.label{color:#666}.value{font-weight:500}.amount{font-size:24px;font-weight:bold;text-align:center;padding:20px 0}.amount.credit{color:#16a34a}.amount.debit{color:#dc2626}.footer{text-align:center;margin-top:30px;font-size:12px;color:#666}.barcode{text-align:center;font-family:monospace;font-size:14px;letter-spacing:2px;margin:20px 0}</style></head><body><div class="header"><div class="logo">📦 ${companyName}</div><div class="receipt-title">Payment Receipt</div></div><div class="info-row"><span class="label">Receipt #</span><span class="value">${transaction.transactionNumber}</span></div><div class="info-row"><span class="label">Date</span><span class="value">${new Date(transaction.createdAt).toLocaleDateString()}</span></div><div class="info-row"><span class="label">Customer</span><span class="value">${customer.fullName}</span></div><div class="info-row"><span class="label">Customer Code</span><span class="value">${customer.customerCode || "-"}</span></div><div class="info-row"><span class="label">Type</span><span class="value">${getTransactionTypeName(transaction.transactionType)}</span></div><div class="amount ${isCreditTx(transaction.transactionType) ? "credit" : "debit"}">${isCreditTx(transaction.transactionType) ? "-" : "+"}$${Number(transaction.amountUsd).toFixed(2)}</div><div class="barcode">${transaction.transactionNumber}</div><div class="footer"><p>Thank you for your business!</p><p>Generated: ${new Date(generatedAt).toLocaleString()}</p></div></body></html>`;
    
    const blob = new Blob([receiptHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${transaction.transactionNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const dateFilters = [
    { value: "all", label: "All Time", labelKu: "هەموو کات" },
    { value: "month", label: "This Month", labelKu: "ئەم مانگە" },
    { value: "year", label: "This Year", labelKu: "ئەم ساڵە" },
  ];

  const isDebt = isDebtBalance(balance);
  // Zero is neither owed nor in credit, and the old ternary printed it as
  // "-/usr/bin/bash.00" in green — a cleared account reading like a negative number.
  const isCredit = isCreditBalance(balance);

  const tabs = [
    { id: "overview", label: pickLang(language, { ku: "پوختە", en: "Overview", ar: "نظرة عامة", zh: "概览" }), icon: PieChart },
    { id: "transactions", label: pickLang(language, { ku: "مامەڵەکان", en: "Transactions", ar: "المعاملات", zh: "交易记录" }), icon: Receipt },
  ];

  return (
    <CustomerPortalLayout>
      {/* Premium Header with Gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={portalBanner} />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
        <div className="relative px-5 pt-14 pb-24">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {pickLang(language, { ku: "دارایی", en: "Financial", ar: "المالية", zh: "财务" })}
              </h1>
              <p className="text-white/70 text-sm mt-1">
                {pickLang(language, { ku: "باڵانس و مامەڵەکانت", en: "Your balance & transactions", ar: "رصيدك ومعاملاتك", zh: "您的余额与交易" })}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              "bg-white/20 backdrop-blur-sm"
            )}>
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Balance Card - Floating */}
      <div className="px-4 -mt-16 relative z-10">
        <div className={cn(
          "rounded-3xl shadow-xl overflow-hidden",
          isDark ? "bg-slate-800 shadow-slate-900/50" : "bg-white shadow-slate-200/50"
        )}>
          {/* Balance Display */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                  {pickLang(language, { ku: "باڵانسی ئێستا", en: "Current Balance", ar: "الرصيد الحالي", zh: "当前余额" })}
                </p>
                {summaryLoading ? (
                  <Skeleton className="h-12 w-40 mt-2" />
                ) : (
                  <p className={cn(
                    "text-4xl font-bold mt-1",
                    isDebt ? "text-red-500" : "text-emerald-500"
                  )}>
                    <span dir="ltr">{isCredit ? "-" : ""}{formatCurrency(Math.abs(animatedBalance))}</span>
                  </p>
                )}
              </div>
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                isDebt 
                  ? isDark ? "bg-red-900/30" : "bg-red-100 dark:bg-red-950/40" 
                  : isDark ? "bg-emerald-900/30" : "bg-emerald-100 dark:bg-emerald-950/40"
              )}>
                {isDebt ? (
                  <TrendingDown className={cn("w-8 h-8", isDebt ? "text-red-500" : "text-emerald-500")} />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className={cn(
              "mt-4 px-4 py-2 rounded-xl inline-flex items-center gap-2",
              isDebt 
                ? isDark ? "bg-red-900/30" : "bg-red-50 dark:bg-red-950/40" 
                : isDark ? "bg-emerald-900/30" : "bg-emerald-50 dark:bg-emerald-950/40"
            )}>
              {isDebt ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className={cn("text-sm font-medium", isDebt ? "text-red-600" : "text-emerald-600")}>
                    {pickLang(language, { ku: "قەرزت هەیە", en: "You have outstanding balance", ar: "لديك رصيد مستحق", zh: "您有未结余额" })}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">
                    {pickLang(language, { ku: "هیچ قەرزێکت نییە", en: "No outstanding balance", ar: "لا يوجد رصيد مستحق", zh: "无未结余额" })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className={cn(
            "grid grid-cols-3 border-t",
            isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60"
          )}>
            <div className={cn("p-4 text-center border-r", isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60")}>
              <p className={cn("text-xs mb-1", isDark ? "text-slate-500" : "text-slate-500")}>
                {pickLang(language, { ku: "سنووری قەرز", en: "Credit Limit", ar: "حد الائتمان", zh: "信用额度" })}
              </p>
              {summaryLoading ? (
                <Skeleton className="h-6 w-16 mx-auto" />
              ) : (
                <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                  {formatCurrency(summary?.creditLimitUsd || 0)}
                </p>
              )}
            </div>
            <div className={cn("p-4 text-center border-r", isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60")}>
              <p className={cn("text-xs mb-1", isDark ? "text-slate-500" : "text-slate-500")}>
                {pickLang(language, { ku: "کۆی پارەدان", en: "Total Paid", ar: "إجمالي المدفوع", zh: "已付总额" })}
              </p>
              {summaryLoading ? (
                <Skeleton className="h-6 w-16 mx-auto" />
              ) : (
                <p className="text-lg font-bold text-emerald-500">
                  {formatCurrency(summary?.totalPaid || 0)}
                </p>
              )}
            </div>
            <div className="p-4 text-center">
              <p className={cn("text-xs mb-1", isDark ? "text-slate-500" : "text-slate-500")}>
                {pickLang(language, { ku: "ئەم مانگە", en: "This Month", ar: "هذا الشهر", zh: "本月" })}
              </p>
              <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {monthlyStats.count} {pickLang(language, { ku: "مامەڵە", en: "txns", ar: "معاملة", zh: "笔" })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mt-6">
        <div className={cn(
          "flex rounded-2xl p-1.5",
          isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40"
        )}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? isDark 
                    ? "bg-slate-700 text-white shadow-lg" 
                    : "bg-white text-slate-800 dark:text-slate-200 shadow-md"
                  : isDark 
                    ? "text-slate-400 hover:text-slate-300" 
                    : "text-slate-500 hover:text-slate-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-6 pb-28">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Statement PDF + per-order consolidated billing */}
            <div className="flex items-center justify-between gap-2">
              <WhatsAppHelpButton
                language={language}
                section={language === "ku" ? "دارایی" : language === "ar" ? "المالية" : language === "zh" ? "财务" : "Financial"}
                topic={`${language === "ku" ? "باڵانس" : language === "ar" ? "الرصيد" : language === "zh" ? "余额" : "Balance"}: $${Math.abs(balance).toFixed(2)}`}
              />
              <StatementPdfButton language={language} />
            </div>
            <OrderBillingGroups transactions={transactions} language={language} isDark={isDark} />

            {/* Monthly Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className={cn(
                "rounded-2xl p-4",
                isDark ? "bg-slate-800" : "bg-white shadow-sm"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  isDark ? "bg-emerald-900/30" : "bg-emerald-100 dark:bg-emerald-950/40"
                )}>
                  <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                </div>
                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {pickLang(language, { ku: "پارەدانی ئەم مانگە", en: "Payments This Month", ar: "مدفوعات هذا الشهر", zh: "本月付款" })}
                </p>
                <p className="text-xl font-bold text-emerald-500 mt-1">
                  {formatCurrency(monthlyStats.payments)}
                </p>
              </div>
              <div className={cn(
                "rounded-2xl p-4",
                isDark ? "bg-slate-800" : "bg-white shadow-sm"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  isDark ? "bg-red-900/30" : "bg-red-100 dark:bg-red-950/40"
                )}>
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                </div>
                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {pickLang(language, { ku: "کرێی ئەم مانگە", en: "Charges This Month", ar: "رسوم هذا الشهر", zh: "本月费用" })}
                </p>
                <p className="text-xl font-bold text-red-500 mt-1">
                  {formatCurrency(monthlyStats.charges)}
                </p>
              </div>
            </div>

            {/* Chart */}
            <div className={cn(
              "rounded-2xl p-5",
              isDark ? "bg-slate-800" : "bg-white shadow-sm"
            )}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn("font-semibold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                  {pickLang(language, { ku: "چارتی ٦ مانگی ڕابردوو", en: "Last 6 Months", ar: "آخر ٦ أشهر", zh: "近 6 个月" })}
                </h3>
                <BarChart3 className={cn("w-5 h-5", isDark ? "text-slate-500" : "text-slate-400")} />
              </div>
              
              {/* Simple Bar Chart */}
              <div className="flex items-end justify-between gap-2 h-40">
                {chartData.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-1 items-end h-32">
                      {/* Payments bar */}
                      <div 
                        className="flex-1 bg-emerald-500 rounded-t-lg transition-all duration-500"
                        style={{ height: `${(data.payments / maxChartValue) * 100}%`, minHeight: data.payments > 0 ? '4px' : '0' }}
                      />
                      {/* Charges bar */}
                      <div 
                        className="flex-1 bg-red-500 rounded-t-lg transition-all duration-500"
                        style={{ height: `${(data.charges / maxChartValue) * 100}%`, minHeight: data.charges > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                      {data.month}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                    {pickLang(language, { ku: "پارەدان", en: "Payments", ar: "المدفوعات", zh: "付款" })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                    {pickLang(language, { ku: "کرێ", en: "Charges", ar: "الرسوم", zh: "费用" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Transactions Preview */}
            <div className={cn(
              "rounded-2xl overflow-hidden",
              isDark ? "bg-slate-800" : "bg-white shadow-sm"
            )}>
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className={cn("font-semibold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                  {pickLang(language, { ku: "دوایین مامەڵەکان", en: "Recent Transactions", ar: "أحدث المعاملات", zh: "最近交易" })}
                </h3>
                <button 
                  onClick={() => changeTab("transactions")}
                  className="text-sm text-indigo-500 font-medium flex items-center gap-1"
                >
                  {pickLang(language, { ku: "هەموو", en: "View All", ar: "عرض الكل", zh: "查看全部" })}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {transactionsLoading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="p-4">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))
                ) : transactions?.slice(0, 3).map((tx) => {
                  const colors = getTransactionColor(tx.transactionType, isDark);
                  return (
                    <div key={tx.id} className="p-4 flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
                        <span className={colors.icon}>{getTransactionIcon(tx.transactionType)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium text-sm", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                          {getTransactionTypeName(tx.transactionType)}
                        </p>
                        <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={cn("font-bold", colors.amount)}>
                        {isCreditTx(tx.transactionType) ? "-" : "+"}
                        {formatCurrency(Number(tx.amountUsd))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              {dateFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setDateRange(filter.value as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    dateRange === filter.value
                      ? isDark 
                        ? "bg-indigo-600 text-white" 
                        : "bg-indigo-500 text-white"
                      : isDark 
                        ? "bg-slate-800 text-slate-400" 
                        : "bg-white text-slate-600 shadow-sm"
                  )}
                >
                  {language === "ku" ? filter.labelKu : filter.label}
                </button>
              ))}
            </div>

            {/* Transaction List */}
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            ) : transactionsError ? (
              /* A failed request used to render as "no transactions yet" — on
                 the money screen, of all places. */
              <PortalErrorState onRetry={() => void refetchTransactions()} isRetrying={transactionsFetching} />
            ) : !transactions || transactions.length === 0 ? (
              <div className={cn(
                "rounded-2xl p-10 text-center",
                isDark ? "bg-slate-800" : "bg-white shadow-sm"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                  isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40"
                )}>
                  <Receipt className={cn("w-8 h-8", isDark ? "text-slate-500" : "text-slate-400")} />
                </div>
                <p className={cn("font-medium", isDark ? "text-slate-400" : "text-slate-600")}>
                  {pickLang(language, { ku: "هیچ مامەڵەیەک نییە", en: "No transactions yet", ar: "لا توجد معاملات بعد", zh: "暂无交易记录" })}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const colors = getTransactionColor(tx.transactionType, isDark);
                  const href = txHref(tx);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => { if (href) setLocation(href); }}
                      className={cn(
                        "rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5",
                        href && "cursor-pointer",
                        isDark
                          ? "bg-slate-800 hover:bg-slate-750"
                          : "bg-white shadow-sm hover:shadow-lg"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", colors.bg)}>
                          <span className={colors.icon}>{getTransactionIcon(tx.transactionType)}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                            {getTransactionTypeName(tx.transactionType)}
                          </p>
                          <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-500")}>
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <p className={cn("text-lg font-bold", colors.amount)}>
                            {isCreditTx(tx.transactionType) ? "-" : "+"}
                            {formatCurrency(Number(tx.amountUsd))}
                          </p>
                          {tx.invoiceId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInvoice(tx.invoiceId);
                              }}
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                isDark 
                                  ? "bg-indigo-900/50 hover:bg-indigo-800/50" 
                                  : "bg-indigo-100 dark:bg-indigo-950/40 hover:bg-indigo-200"
                              )}
                              title={pickLang(language, { ku: "بینینی وەسڵ", en: "View Invoice", ar: "عرض الفاتورة", zh: "查看发票" })}
                            >
                              <FileText className={cn("w-4 h-4", isDark ? "text-indigo-400" : "text-indigo-600")} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedTransaction(tx.id); }}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              isDark
                                ? "bg-slate-700 hover:bg-slate-600"
                                : "bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200"
                            )}
                            title={pickLang(language, { ku: "داگرتنی وەسڵ", en: "Download Receipt", ar: "تحميل الإيصال", zh: "下载收据" })}
                          >
                            <Download className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-600")} />
                          </button>
                        </div>
                      </div>
                      
                      {tx.description && (
                        <p className={cn("text-sm mt-2 pl-16", isDark ? "text-slate-500" : "text-slate-500")}>
                          {tx.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


      </div>

      {/* Receipt Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className={cn("max-w-sm", isDark ? "bg-slate-800 border-slate-700" : "")}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "")}>
              <Receipt className="w-5 h-5" />
              {pickLang(language, { ku: "وەسڵ", en: "Receipt", ar: "إيصال", zh: "收据" })}
            </DialogTitle>
          </DialogHeader>
          
          {receiptLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-10 w-1/2 mx-auto" />
            </div>
          ) : receiptData && (
            <div className="space-y-4">
              <div className={cn("text-center py-4 border-b", isDark ? "border-slate-700" : "")}>
                <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                  {pickLang(language, { ku: "بڕ", en: "Amount", ar: "المبلغ", zh: "金额" })}
                </p>
                <p className={cn(
                  "text-3xl font-bold",
                  isCreditTx(receiptData.transaction.transactionType) 
                    ? "text-emerald-500" 
                    : "text-red-500"
                )}>
                  {isCreditTx(receiptData.transaction.transactionType) ? "-" : "+"}
                  {formatCurrency(Number(receiptData.transaction.amountUsd))}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                    {pickLang(language, { ku: "ژمارەی وەسڵ", en: "Receipt #", ar: "رقم الإيصال", zh: "收据号" })}
                  </span>
                  <span className={cn("font-medium", isDark ? "text-white" : "")}>
                    {receiptData.transaction.transactionNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                    {pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}
                  </span>
                  <span className={cn("font-medium", isDark ? "text-white" : "")}>
                    {new Date(receiptData.transaction.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                    {pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}
                  </span>
                  <span className={cn("font-medium", isDark ? "text-white" : "")}>
                    {getTransactionTypeName(receiptData.transaction.transactionType)}
                  </span>
                </div>
              </div>
              
              <Button onClick={downloadReceipt} className="w-full">
                <Download className="w-4 h-4 me-2" />
                {pickLang(language, { ku: "داگرتنی وەسڵ", en: "Download Receipt", ar: "تحميل الإيصال", zh: "下载收据" })}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className={cn("max-w-md max-h-[90vh] overflow-y-auto", isDark ? "bg-slate-800 border-slate-700" : "")}>
          {(() => {
            const invoice = invoices?.find(inv => inv.id === selectedInvoice) as any;
            if (!invoice) return null;
            
            const downloadInvoicePDF = () => {
              const lineItems = invoice.lineItems || [];
              const pdfHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #6366f1; }
    .logo { font-size: 28px; font-weight: 700; color: #6366f1; }
    .logo-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 32px; color: #1e293b; font-weight: 700; }
    .invoice-number { font-size: 14px; color: #64748b; margin-top: 4px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .info-box { flex: 1; }
    .info-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
    .info-box p { font-size: 14px; color: #334155; margin-bottom: 4px; }
    .info-box .highlight { font-weight: 600; color: #1e293b; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .table td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .table .amount { text-align: right; font-weight: 500; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.final { border-top: 2px solid #1e293b; margin-top: 8px; padding-top: 16px; font-size: 18px; font-weight: 700; color: #6366f1; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
    .footer p { margin-bottom: 4px; }
    .qr-section { text-align: center; margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; }
    .qr-code { font-family: monospace; font-size: 16px; letter-spacing: 3px; color: #1e293b; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <div class="logo">${company.name}</div>
        <div class="logo-sub">International Shipping & Logistics</div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <span class="status ${invoiceState(invoice.status) === 'paid' ? 'status-paid' : 'status-cancelled'}">
          ${INVOICE_STATE_PRINT[invoiceState(invoice.status)]}
        </span>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-box">
        <h3>Invoice Details</h3>
        <p><span class="highlight">Date:</span> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
        ${invoice.dueDate ? '<p><span class="highlight">Due Date:</span> ' + new Date(invoice.dueDate).toLocaleDateString() + '</p>' : ''}
        ${invoice.paidAt ? '<p><span class="highlight">Paid On:</span> ' + new Date(invoice.paidAt).toLocaleDateString() + '</p>' : ''}
      </div>
      <div class="info-box" style="text-align: right;">
        <h3>From</h3>
        <p class="highlight">${company.name}</p>
        <p>International Shipping</p>
        <p>support@waznexpress.com</p>
      </div>
    </div>
    
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.length > 0 ? lineItems.map((item: any) => '<tr><td>' + item.description + '</td><td style="text-align: center;">' + item.quantity + '</td><td class="amount">$' + Number(item.unitPrice).toFixed(2) + '</td><td class="amount">$' + Number(item.total).toFixed(2) + '</td></tr>').join('') : '<tr><td>Shipping Services</td><td style="text-align: center;">1</td><td class="amount">$' + Number(invoice.subtotalUsd).toFixed(2) + '</td><td class="amount">$' + Number(invoice.subtotalUsd).toFixed(2) + '</td></tr>'}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>$${Number(invoice.subtotalUsd).toFixed(2)}</span>
      </div>
      ${Number(invoice.taxUsd) > 0 ? '<div class="total-row"><span>Tax</span><span>$' + Number(invoice.taxUsd).toFixed(2) + '</span></div>' : ''}
      <div class="total-row final">
        <span>Total</span>
        <span>$${Number(invoice.totalUsd).toFixed(2)}</span>
      </div>
      ${invoice.totalIqd ? '<div class="total-row" style="font-size: 12px; color: #64748b;"><span>IQD Equivalent</span><span>' + Number(invoice.totalIqd).toLocaleString() + ' IQD</span></div>' : ''}
    </div>
    
    <div class="qr-section">
      <div class="qr-code">${invoice.invoiceNumber}</div>
      <p style="font-size: 11px; color: #64748b; margin-top: 8px;">Scan or use this code for reference</p>
    </div>
    
    <div class="footer">
      <p><strong>Thank you for choosing ${company.name}!</strong></p>
      <p>For questions about this invoice, please contact support@waznexpress.com</p>
      <p style="margin-top: 12px;">Generated on ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
              
              const blob = new Blob([pdfHTML], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `invoice-${invoice.invoiceNumber}.html`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            };
            
            const printInvoice = () => {
              downloadInvoicePDF();
            };
            
            return (
              <>
                <DialogHeader>
                  <DialogTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "")}>
                    <FileText className="w-5 h-5" />
                    {pickLang(language, { ku: "وەسڵ", en: "Invoice", ar: "فاتورة", zh: "发票" })} {invoice.invoiceNumber}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Status banner. This used to read "Paid" for everything
                      that was not cancelled — so a draft, issued or half-paid
                      invoice told the customer there was nothing to pay. */}
                  {(() => {
                    const state = invoiceState(invoice.status);
                    const tone = INVOICE_STATE_TONE[state];
                    const settled = state === "paid";
                    return (
                      <div className={cn("p-4 rounded-xl text-center", tone.chip)}>
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2", tone.dot)}>
                          {settled
                            ? <CheckCircle2 className="w-6 h-6 text-white" />
                            : <XCircle className="w-6 h-6 text-white" />}
                        </div>
                        <p className={cn("font-semibold", tone.text)}>
                          {pickLang(language, INVOICE_STATE_LABEL[state])}
                        </p>
                      </div>
                    );
                  })()}
                  
                  {/* Amount */}
                  <div className={cn("text-center py-4 border-b", isDark ? "border-slate-700" : "")}>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                      {pickLang(language, { ku: "کۆی گشتی", en: "Total Amount", ar: "المبلغ الإجمالي", zh: "总金额" })}
                    </p>
                    <p className={cn("text-4xl font-bold mt-1", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                      ${Number(invoice.totalUsd).toFixed(2)}
                    </p>
                    {invoice.totalIqd && (
                      <p className={cn("text-sm mt-1", isDark ? "text-slate-500" : "text-slate-400")}>
                        {Number(invoice.totalIqd).toLocaleString()} IQD
                      </p>
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <Hash className="w-4 h-4 inline me-1" />
                        {pickLang(language, { ku: "ژمارەی وەسڵ", en: "Invoice Number", ar: "رقم الفاتورة", zh: "发票号" })}
                      </span>
                      <span className={cn("font-medium", isDark ? "text-white" : "")}>
                        {invoice.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <Calendar className="w-4 h-4 inline me-1" />
                        {pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}
                      </span>
                      <span className={cn("font-medium", isDark ? "text-white" : "")}>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex justify-between">
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                          <Clock className="w-4 h-4 inline me-1" />
                          {pickLang(language, { ku: "بەرواری دوایی", en: "Due Date", ar: "تاريخ الاستحقاق", zh: "到期日" })}
                        </span>
                        <span className={cn("font-medium", isDark ? "text-white" : "")}>
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {invoice.paidAt && (
                      <div className="flex justify-between">
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                          <CheckCircle2 className="w-4 h-4 inline me-1" />
                          {pickLang(language, { ku: "بەرواری پارەدان", en: "Paid On", ar: "تاريخ الدفع", zh: "支付日期" })}
                        </span>
                        <span className={cn("font-medium text-emerald-500")}>
                          {new Date(invoice.paidAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Line Items — per-package detail with multi-line description.
                      Batch-generated invoices pack weight, dimensions, CBM, charge
                      formula and cartons into `description` separated by \n, so
                      we render with `whitespace-pre-line` and a bordered card per
                      row to keep it scannable. */}
                  {invoice.lineItems && invoice.lineItems.length > 0 && (
                    <div className={cn("rounded-xl p-3", isDark ? "bg-slate-700" : "bg-slate-50 dark:bg-slate-950/40")}>
                      <p className={cn("text-xs font-medium mb-2", isDark ? "text-slate-400" : "text-slate-500")}>
                        {pickLang(language, { ku: "بەندەکان", en: "Items", ar: "البنود", zh: "项目" })}
                      </p>
                      <div className="space-y-2">
                        {invoice.lineItems.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex justify-between items-start gap-3 text-sm p-2.5 rounded-lg border",
                              isDark
                                ? "bg-slate-800 border-slate-600"
                                : "bg-white border-slate-200 dark:border-slate-800/60",
                            )}
                          >
                            <span className={cn(
                              "whitespace-pre-line leading-relaxed flex-1 min-w-0",
                              isDark ? "text-slate-300" : "text-slate-700 dark:text-slate-300",
                            )}>
                              {item.description}
                            </span>
                            <span className={cn(
                              "font-mono font-semibold text-sm shrink-0",
                              isDark ? "text-white" : "text-slate-900 dark:text-slate-200",
                            )}>
                              ${Number(item.total).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {invoice.notes && (
                    <div className={cn("rounded-xl p-3", isDark ? "bg-slate-700" : "bg-slate-50 dark:bg-slate-950/40")}>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                        {pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}
                      </p>
                      <p className={cn(
                        "text-sm whitespace-pre-line leading-relaxed",
                        isDark ? "text-slate-300" : "text-slate-700 dark:text-slate-300",
                      )}>
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={downloadInvoicePDF} className="flex-1">
                      <Download className="w-4 h-4 me-2" />
                      {pickLang(language, { ku: "داگرتن", en: "Download", ar: "تحميل", zh: "下载" })}
                    </Button>
                    <Button onClick={printInvoice} variant="outline" className="flex-1">
                      <Printer className="w-4 h-4 me-2" />
                      {pickLang(language, { ku: "چاپکردن", en: "Print", ar: "طباعة", zh: "打印" })}
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}

export default function PortalFinancial() {
  const { portalTheme } = usePortalTheme();
  
  if (portalTheme === "skin3") return <Skin3PortalFinancial />;
  if (portalTheme === "modern") return <ModernPortalFinancial />;
  return <ClassicPortalFinancial />;
}
