import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { Link } from "wouter";
import ModernPortalFinancial from "./modern/ModernPortalFinancial";
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
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function ClassicPortalFinancial() {
const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const [dateRange, setDateRange] = useState<"all" | "month" | "year">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "invoices">("overview");
  const [animatedBalance, setAnimatedBalance] = useState(0);
  
  const { data: summary, isLoading: summaryLoading } = trpc.customerPortal.getMyFinancialSummary.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.customerPortal.getMyTransactions.useQuery({ limit: 50 });
  const { data: receiptData, isLoading: receiptLoading } = trpc.customerPortal.getReceiptData.useQuery(
    { transactionId: selectedTransaction! },
    { enabled: !!selectedTransaction }
  );
  const { data: invoices, isLoading: invoicesLoading } = trpc.customerPortal.getMyInvoices.useQuery();
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "paid" | "cancelled">("all");

  // Animate balance on load
  const balance = summary?.balanceUsd || 0;
  useEffect(() => {
    if (balance !== 0) {
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
      payments: thisMonth.filter(tx => tx.transactionType.startsWith("CREDIT_")).reduce((sum, tx) => sum + Number(tx.amountUsd), 0),
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
        payments: monthTxs.filter(tx => tx.transactionType.startsWith("CREDIT_")).reduce((sum, tx) => sum + Number(tx.amountUsd), 0),
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
    if (type.startsWith("CREDIT_")) {
      return <ArrowDownLeft className="w-4 h-4" />;
    }
    return <ArrowUpRight className="w-4 h-4" />;
  };

  const getTransactionColor = (type: string, isDark: boolean) => {
    if (type.startsWith("CREDIT_")) {
      return { 
        bg: isDark ? "bg-emerald-900/50" : "bg-emerald-100", 
        icon: "text-emerald-500", 
        amount: "text-emerald-500" 
      };
    }
    return { 
      bg: isDark ? "bg-red-900/50" : "bg-red-100", 
      icon: "text-red-500", 
      amount: "text-red-500" 
    };
  };

  const getTransactionTypeName = (type: string) => {
    switch (type) {
      case "DEBIT_PACKAGE": return language === "ku" ? "کرێی گەیاندن" : "Delivery Charge";
      case "DEBIT_SERVICE": return language === "ku" ? "کرێی خزمەتگوزاری" : "Service Fee";
      case "CREDIT_PAYMENT": return language === "ku" ? "پارەدان" : "Payment";
      case "CREDIT_REFUND": return language === "ku" ? "گەڕاندنەوە" : "Refund";
      case "CREDIT_DISCOUNT": return language === "ku" ? "داشکاندن" : "Discount";
      default: return type.replace(/_/g, " ");
    }
  };

  const downloadReceipt = () => {
    if (!receiptData) return;
    const { transaction, customer, companyName, generatedAt } = receiptData;
    
    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt - ${transaction.transactionNumber}</title><style>body{font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}.logo{font-size:24px;font-weight:bold;color:#1e3a5f}.receipt-title{font-size:18px;margin-top:10px}.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ccc}.label{color:#666}.value{font-weight:500}.amount{font-size:24px;font-weight:bold;text-align:center;padding:20px 0}.amount.credit{color:#16a34a}.amount.debit{color:#dc2626}.footer{text-align:center;margin-top:30px;font-size:12px;color:#666}.barcode{text-align:center;font-family:monospace;font-size:14px;letter-spacing:2px;margin:20px 0}</style></head><body><div class="header"><div class="logo">📦 ${companyName}</div><div class="receipt-title">Payment Receipt</div></div><div class="info-row"><span class="label">Receipt #</span><span class="value">${transaction.transactionNumber}</span></div><div class="info-row"><span class="label">Date</span><span class="value">${new Date(transaction.createdAt).toLocaleDateString()}</span></div><div class="info-row"><span class="label">Customer</span><span class="value">${customer.fullName}</span></div><div class="info-row"><span class="label">Customer Code</span><span class="value">${customer.customerCode || "-"}</span></div><div class="info-row"><span class="label">Type</span><span class="value">${getTransactionTypeName(transaction.transactionType)}</span></div><div class="amount ${transaction.transactionType.startsWith("CREDIT_") ? "credit" : "debit"}">${transaction.transactionType.startsWith("CREDIT_") ? "-" : "+"}$${Number(transaction.amountUsd).toFixed(2)}</div><div class="barcode">${transaction.transactionNumber}</div><div class="footer"><p>Thank you for your business!</p><p>Generated: ${new Date(generatedAt).toLocaleString()}</p></div></body></html>`;
    
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

  const isDebt = balance > 0;

  const tabs = [
    { id: "overview", label: language === "ku" ? "پوختە" : "Overview", icon: PieChart },
    { id: "transactions", label: language === "ku" ? "مامەڵەکان" : "Transactions", icon: Receipt },
  ];

  return (
    <CustomerPortalLayout>
      {/* Premium Header with Gradient */}
      <div className="relative overflow-hidden">
        <div className={cn(
          "absolute inset-0",
          isDark 
            ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" 
            : "bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700"
        )} />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
        <div className="relative px-5 pt-14 pb-24">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {language === "ku" ? "دارایی" : "Financial"}
              </h1>
              <p className="text-white/70 text-sm mt-1">
                {language === "ku" ? "باڵانس و مامەڵەکانت" : "Your balance & transactions"}
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
                  {language === "ku" ? "باڵانسی ئێستا" : "Current Balance"}
                </p>
                {summaryLoading ? (
                  <Skeleton className="h-12 w-40 mt-2" />
                ) : (
                  <p className={cn(
                    "text-4xl font-bold mt-1",
                    isDebt ? "text-red-500" : "text-emerald-500"
                  )}>
                    {isDebt ? "" : "-"}{formatCurrency(Math.abs(animatedBalance))}
                  </p>
                )}
              </div>
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                isDebt 
                  ? isDark ? "bg-red-900/30" : "bg-red-100" 
                  : isDark ? "bg-emerald-900/30" : "bg-emerald-100"
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
                ? isDark ? "bg-red-900/30" : "bg-red-50" 
                : isDark ? "bg-emerald-900/30" : "bg-emerald-50"
            )}>
              {isDebt ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className={cn("text-sm font-medium", isDebt ? "text-red-600" : "text-emerald-600")}>
                    {language === "ku" ? "قەرزت هەیە" : "You have outstanding balance"}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">
                    {language === "ku" ? "هیچ قەرزێکت نییە" : "No outstanding balance"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className={cn(
            "grid grid-cols-3 border-t",
            isDark ? "border-slate-700" : "border-slate-100"
          )}>
            <div className={cn("p-4 text-center border-r", isDark ? "border-slate-700" : "border-slate-100")}>
              <p className={cn("text-xs mb-1", isDark ? "text-slate-500" : "text-slate-500")}>
                {language === "ku" ? "سنووری قەرز" : "Credit Limit"}
              </p>
              {summaryLoading ? (
                <Skeleton className="h-6 w-16 mx-auto" />
              ) : (
                <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
                  {formatCurrency(summary?.creditLimitUsd || 0)}
                </p>
              )}
            </div>
            <div className={cn("p-4 text-center border-r", isDark ? "border-slate-700" : "border-slate-100")}>
              <p className={cn("text-xs mb-1", isDark ? "text-slate-500" : "text-slate-500")}>
                {language === "ku" ? "کۆی پارەدان" : "Total Paid"}
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
                {language === "ku" ? "ئەم مانگە" : "This Month"}
              </p>
              <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
                {monthlyStats.count} {language === "ku" ? "مامەڵە" : "txns"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 mt-6">
        <div className={cn(
          "flex rounded-2xl p-1.5",
          isDark ? "bg-slate-800" : "bg-slate-100"
        )}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? isDark 
                    ? "bg-slate-700 text-white shadow-lg" 
                    : "bg-white text-slate-800 shadow-md"
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
            {/* Monthly Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className={cn(
                "rounded-2xl p-4",
                isDark ? "bg-slate-800" : "bg-white shadow-sm"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  isDark ? "bg-emerald-900/30" : "bg-emerald-100"
                )}>
                  <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                </div>
                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {language === "ku" ? "پارەدانی ئەم مانگە" : "Payments This Month"}
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
                  isDark ? "bg-red-900/30" : "bg-red-100"
                )}>
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                </div>
                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {language === "ku" ? "کرێی ئەم مانگە" : "Charges This Month"}
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
                <h3 className={cn("font-semibold", isDark ? "text-white" : "text-slate-800")}>
                  {language === "ku" ? "چارتی ٦ مانگی ڕابردوو" : "Last 6 Months"}
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
                    {language === "ku" ? "پارەدان" : "Payments"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                    {language === "ku" ? "کرێ" : "Charges"}
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
                <h3 className={cn("font-semibold", isDark ? "text-white" : "text-slate-800")}>
                  {language === "ku" ? "دوایین مامەڵەکان" : "Recent Transactions"}
                </h3>
                <button 
                  onClick={() => setActiveTab("transactions")}
                  className="text-sm text-indigo-500 font-medium flex items-center gap-1"
                >
                  {language === "ku" ? "هەموو" : "View All"}
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
                        <p className={cn("font-medium text-sm", isDark ? "text-white" : "text-slate-800")}>
                          {getTransactionTypeName(tx.transactionType)}
                        </p>
                        <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={cn("font-bold", colors.amount)}>
                        {tx.transactionType.startsWith("CREDIT_") ? "-" : "+"}
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
            ) : !transactions || transactions.length === 0 ? (
              <div className={cn(
                "rounded-2xl p-10 text-center",
                isDark ? "bg-slate-800" : "bg-white shadow-sm"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                  isDark ? "bg-slate-700" : "bg-slate-100"
                )}>
                  <Receipt className={cn("w-8 h-8", isDark ? "text-slate-500" : "text-slate-400")} />
                </div>
                <p className={cn("font-medium", isDark ? "text-slate-400" : "text-slate-600")}>
                  {language === "ku" ? "هیچ مامەڵەیەک نییە" : "No transactions yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const colors = getTransactionColor(tx.transactionType, isDark);
                  return (
                    <div 
                      key={tx.id} 
                      className={cn(
                        "rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5",
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
                          <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-800")}>
                            {getTransactionTypeName(tx.transactionType)}
                          </p>
                          <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-500")}>
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <p className={cn("text-lg font-bold", colors.amount)}>
                            {tx.transactionType.startsWith("CREDIT_") ? "-" : "+"}
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
                                  : "bg-indigo-100 hover:bg-indigo-200"
                              )}
                              title={language === "ku" ? "بینینی وەسڵ" : "View Invoice"}
                            >
                              <FileText className={cn("w-4 h-4", isDark ? "text-indigo-400" : "text-indigo-600")} />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedTransaction(tx.id)}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              isDark 
                                ? "bg-slate-700 hover:bg-slate-600" 
                                : "bg-slate-100 hover:bg-slate-200"
                            )}
                            title={language === "ku" ? "داگرتنی وەسڵ" : "Download Receipt"}
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
              {language === "ku" ? "وەسڵ" : "Receipt"}
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
                  {language === "ku" ? "بڕ" : "Amount"}
                </p>
                <p className={cn(
                  "text-3xl font-bold",
                  receiptData.transaction.transactionType.startsWith("CREDIT_") 
                    ? "text-emerald-500" 
                    : "text-red-500"
                )}>
                  {receiptData.transaction.transactionType.startsWith("CREDIT_") ? "-" : "+"}
                  {formatCurrency(Number(receiptData.transaction.amountUsd))}
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                    {language === "ku" ? "ژمارەی وەسڵ" : "Receipt #"}
                  </span>
                  <span className={cn("font-medium", isDark ? "text-white" : "")}>
                    {receiptData.transaction.transactionNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                    {language === "ku" ? "بەروار" : "Date"}
                  </span>
                  <span className={cn("font-medium", isDark ? "text-white" : "")}>
                    {new Date(receiptData.transaction.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                    {language === "ku" ? "جۆر" : "Type"}
                  </span>
                  <span className={cn("font-medium", isDark ? "text-white" : "")}>
                    {getTransactionTypeName(receiptData.transaction.transactionType)}
                  </span>
                </div>
              </div>
              
              <Button onClick={downloadReceipt} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                {language === "ku" ? "داگرتنی وەسڵ" : "Download Receipt"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className={cn("max-w-md max-h-[90vh] overflow-y-auto", isDark ? "bg-slate-800 border-slate-700" : "")}>
          {(() => {
            const invoice = invoices?.find(inv => inv.id === selectedInvoice);
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
        <div class="logo">Wazn Express</div>
        <div class="logo-sub">International Shipping & Logistics</div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <span class="status ${invoice.status === 'cancelled' ? 'status-cancelled' : 'status-paid'}">
          ${invoice.status === 'cancelled' ? 'CANCELLED' : 'PAID'}
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
        <p class="highlight">Wazn Express</p>
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
        ${lineItems.length > 0 ? lineItems.map(item => '<tr><td>' + item.description + '</td><td style="text-align: center;">' + item.quantity + '</td><td class="amount">$' + Number(item.unitPrice).toFixed(2) + '</td><td class="amount">$' + Number(item.total).toFixed(2) + '</td></tr>').join('') : '<tr><td>Shipping Services</td><td style="text-align: center;">1</td><td class="amount">$' + Number(invoice.subtotalUsd).toFixed(2) + '</td><td class="amount">$' + Number(invoice.subtotalUsd).toFixed(2) + '</td></tr>'}
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
      <p><strong>Thank you for choosing Wazn Express!</strong></p>
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
                    {language === "ku" ? "وەسڵ" : "Invoice"} {invoice.invoiceNumber}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={cn(
                    "p-4 rounded-xl text-center",
                    invoice.status === "cancelled"
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-emerald-100 dark:bg-emerald-900/30"
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2",
                      invoice.status === "cancelled" ? "bg-red-500" : "bg-emerald-500"
                    )}>
                      {invoice.status === "cancelled" ? (
                        <XCircle className="w-6 h-6 text-white" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <p className={cn(
                      "font-semibold",
                      invoice.status === "cancelled" ? "text-red-700 dark:text-red-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    )}>
                      {invoice.status === "cancelled"
                        ? (language === "ku" ? "هەڵوەشێنراو" : "Cancelled")
                        : (language === "ku" ? "پارەدراو" : "Paid")}
                    </p>
                  </div>
                  
                  {/* Amount */}
                  <div className={cn("text-center py-4 border-b", isDark ? "border-slate-700" : "")}>
                    <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                      {language === "ku" ? "کۆی گشتی" : "Total Amount"}
                    </p>
                    <p className={cn("text-4xl font-bold mt-1", isDark ? "text-white" : "text-slate-800")}>
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
                        <Hash className="w-4 h-4 inline mr-1" />
                        {language === "ku" ? "ژمارەی وەسڵ" : "Invoice Number"}
                      </span>
                      <span className={cn("font-medium", isDark ? "text-white" : "")}>
                        {invoice.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {language === "ku" ? "بەروار" : "Date"}
                      </span>
                      <span className={cn("font-medium", isDark ? "text-white" : "")}>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex justify-between">
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                          <Clock className="w-4 h-4 inline mr-1" />
                          {language === "ku" ? "بەرواری دوایی" : "Due Date"}
                        </span>
                        <span className={cn("font-medium", isDark ? "text-white" : "")}>
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {invoice.paidAt && (
                      <div className="flex justify-between">
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                          <CheckCircle2 className="w-4 h-4 inline mr-1" />
                          {language === "ku" ? "بەرواری پارەدان" : "Paid On"}
                        </span>
                        <span className={cn("font-medium text-emerald-500")}>
                          {new Date(invoice.paidAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Line Items */}
                  {invoice.lineItems && invoice.lineItems.length > 0 && (
                    <div className={cn("rounded-xl p-3", isDark ? "bg-slate-700" : "bg-slate-50")}>
                      <p className={cn("text-xs font-medium mb-2", isDark ? "text-slate-400" : "text-slate-500")}>
                        {language === "ku" ? "بەندەکان" : "Items"}
                      </p>
                      <div className="space-y-2">
                        {invoice.lineItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className={isDark ? "text-slate-300" : "text-slate-700"}>
                              {item.description} x{item.quantity}
                            </span>
                            <span className={cn("font-medium", isDark ? "text-white" : "")}>
                              ${Number(item.total).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Notes */}
                  {invoice.notes && (
                    <div className={cn("rounded-xl p-3", isDark ? "bg-slate-700" : "bg-slate-50")}>
                      <p className={cn("text-xs font-medium mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                        {language === "ku" ? "تێبینی" : "Notes"}
                      </p>
                      <p className={cn("text-sm", isDark ? "text-slate-300" : "text-slate-700")}>
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={downloadInvoicePDF} className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      {language === "ku" ? "داگرتن" : "Download"}
                    </Button>
                    <Button onClick={printInvoice} variant="outline" className="flex-1">
                      <Printer className="w-4 h-4 mr-2" />
                      {language === "ku" ? "چاپکردن" : "Print"}
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
  
  if (portalTheme === "modern") {
    return <ModernPortalFinancial />;
  }
  
  return <ClassicPortalFinancial />;
}
