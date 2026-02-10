import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import { 
  Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, Clock, 
  CheckCircle, XCircle, TrendingUp, TrendingDown, DollarSign,
  Receipt, ChevronRight, Filter, Calendar, Download
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type TransactionFilter = "all" | "payment" | "refund" | "pending";

export default function ModernPortalFinancial() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: summary, isLoading: accountLoading } = trpc.customerPortal.getMyFinancialSummary.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.customerPortal.getMyTransactions.useQuery();

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (filter === "all") return transactions;
    return transactions.filter((t: any) => {
      if (filter === "payment") return t.type === "payment";
      if (filter === "refund") return t.type === "refund";
      if (filter === "pending") return t.status === "pending";
      return true;
    });
  }, [transactions, filter]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "payment":
        return { icon: ArrowDownLeft, gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-500/10" };
      case "refund":
        return { icon: ArrowUpRight, gradient: "from-amber-500 to-orange-600", bg: "bg-amber-500/10" };
      default:
        return { icon: Receipt, gradient: "from-slate-500 to-slate-600", bg: "bg-slate-500/10" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return { text: language === "ku" ? "تەواو" : "Completed", color: "text-emerald-500", bg: "bg-emerald-500/10" };
      case "pending":
        return { text: language === "ku" ? "چاوەڕوان" : "Pending", color: "text-amber-500", bg: "bg-amber-500/10" };
      case "failed":
        return { text: language === "ku" ? "شکستخوارد" : "Failed", color: "text-red-500", bg: "bg-red-500/10" };
      default:
        return { text: status, color: "text-slate-500", bg: "bg-slate-500/10" };
    }
  };

  const filters = [
    { value: "all", label: language === "ku" ? "هەموو" : "All" },
    { value: "payment", label: language === "ku" ? "پارەدان" : "Payments" },
    { value: "refund", label: language === "ku" ? "گەڕاندنەوە" : "Refunds" },
    { value: "pending", label: language === "ku" ? "چاوەڕوان" : "Pending" },
  ];

  return (
    <ModernPortalLayout>
      <div className={cn("min-h-screen pb-8", isRTL && "rtl")}>
        {/* Header with Balance */}
        <div className={cn(
          "relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-br from-violet-950 via-purple-900 to-slate-950" 
            : "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700"
        )}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute top-40 -left-20 w-40 h-40 rounded-full bg-violet-400/20 blur-2xl" />
          </div>

          <div className="relative px-6 pt-12 pb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-white font-bold text-2xl">
                  {language === "ku" ? "دارایی" : "Financial"}
                </h1>
                <p className="text-white/70 text-sm mt-1">
                  {language === "ku" ? "بەڕێوەبردنی باڵانس و مامەڵەکان" : "Manage your balance & transactions"}
                </p>
              </div>
            </div>

            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative overflow-hidden rounded-3xl p-6",
                "bg-white/10 backdrop-blur-xl border border-white/20"
              )}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-white/70 text-sm mb-1">
                    {language === "ku" ? "باڵانسی ئێستا" : "Current Balance"}
                  </p>
                  {accountLoading ? (
                    <Skeleton className="h-10 w-32 bg-white/20" />
                  ) : (
                    <>
                      <h2 className="text-4xl font-bold text-white">
                        ${(summary?.balanceUsd ?? 0).toFixed(2)} <span className="text-lg font-normal text-white/80">USD</span>
                      </h2>
                      {(summary?.balanceIqd ?? 0) !== 0 && (
                        <p className="text-white/80 text-sm mt-1">
                          {new Intl.NumberFormat("en-US").format(Number(summary?.balanceIqd ?? 0))} <span className="text-white/70">IQD</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 mt-6">
                <Link href="/portal/payment">
                  <button className={cn(
                    "flex-1 py-3 rounded-xl font-medium text-sm transition-all",
                    "bg-white text-violet-600 hover:bg-white/90"
                  )}>
                    <CreditCard className="w-4 h-4 inline-block mr-2" />
                    {language === "ku" ? "پارەدان" : "Pay Now"}
                  </button>
                </Link>
                <button className={cn(
                  "flex-1 py-3 rounded-xl font-medium text-sm transition-all",
                  "bg-white/20 text-white hover:bg-white/30"
                )}>
                  <Download className="w-4 h-4 inline-block mr-2" />
                  {language === "ku" ? "ڕاپۆرت" : "Report"}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 -mt-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { 
                label: language === "ku" ? "کۆی پارەدان" : "Total Paid", 
                value: `$${(transactions?.filter((t: any) => t.type === "payment" && t.status === "completed").reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0).toFixed(2)}`,
                icon: TrendingUp,
                gradient: "from-emerald-500 to-teal-600"
              },
              { 
                label: language === "ku" ? "چاوەڕوان" : "Pending", 
                value: `$${(transactions?.filter((t: any) => t.status === "pending").reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0).toFixed(2)}`,
                icon: Clock,
                gradient: "from-amber-500 to-orange-600"
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-4",
                  isDark 
                    ? "bg-slate-800/50 border border-slate-700/50" 
                    : "bg-white border border-slate-200/50",
                  "backdrop-blur-xl shadow-lg"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br",
                  stat.gradient
                )}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <p className={cn(
                  "text-lg font-bold",
                  isDark ? "text-white" : "text-slate-900"
                )}>
                  {stat.value}
                </p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-slate-500"
                )}>
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn(
              "font-bold text-lg",
              isDark ? "text-white" : "text-slate-900"
            )}>
              {language === "ku" ? "مامەڵەکان" : "Transactions"}
            </h3>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-xl transition-all",
                showFilters 
                  ? "bg-violet-500 text-white" 
                  : isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="flex flex-wrap gap-2">
                  {filters.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFilter(f.value as TransactionFilter)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                        filter === f.value
                          ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30"
                          : isDark 
                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transaction List */}
          {transactionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((transaction: any, index: number) => {
                const iconConfig = getTransactionIcon(transaction.type);
                const IconComponent = iconConfig.icon;
                const statusBadge = getStatusBadge(transaction.status);
                
                return (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "relative overflow-hidden rounded-2xl p-4 transition-all",
                      isDark 
                        ? "bg-slate-800/50 border border-slate-700/50" 
                        : "bg-white border border-slate-200/50",
                      "backdrop-blur-xl"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                        iconConfig.gradient
                      )}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={cn(
                            "font-semibold",
                            isDark ? "text-white" : "text-slate-900"
                          )}>
                            {transaction.description || (language === "ku" ? "مامەڵە" : "Transaction")}
                          </h4>
                          <span className={cn(
                            "font-bold",
                            transaction.type === "payment" ? "text-emerald-500" : "text-amber-500"
                          )}>
                            {transaction.type === "payment" ? "-" : "+"}${(transaction.amount || 0).toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-xs",
                            isDark ? "text-slate-500" : "text-slate-400"
                          )}>
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            statusBadge.bg, statusBadge.color
                          )}>
                            {statusBadge.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-3xl p-8 text-center",
                isDark 
                  ? "bg-slate-800/50 border border-slate-700/50" 
                  : "bg-white border border-slate-200/50"
              )}
            >
              <Receipt className={cn(
                "w-16 h-16 mx-auto mb-4",
                isDark ? "text-slate-600" : "text-slate-300"
              )} />
              <h3 className={cn(
                "font-bold text-lg mb-2",
                isDark ? "text-white" : "text-slate-900"
              )}>
                {language === "ku" ? "هیچ مامەڵەیەک نییە" : "No transactions"}
              </h3>
              <p className={cn(
                "text-sm",
                isDark ? "text-slate-500" : "text-slate-400"
              )}>
                {language === "ku" 
                  ? "مامەڵەکانت لێرە دەردەکەون" 
                  : "Your transactions will appear here"}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </ModernPortalLayout>
  );
}
