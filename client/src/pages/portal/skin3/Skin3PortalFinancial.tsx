import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Download,
  FileText,
  CreditCard,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type FilterTab = "all" | "credit" | "debit";

const cardBase =
  "rounded-xl border-2 border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.1)]";
const cardBaseDark =
  "rounded-xl border-2 border-white/10 shadow-[4px_4px_0px_rgba(255,255,255,0.05)]";

const spring = { type: "spring" as const, stiffness: 300, damping: 24 };

export default function Skin3PortalFinancial() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [receiptTxId, setReceiptTxId] = useState<number | null>(null);

  const { data: summary, isLoading: summaryLoading } =
    trpc.customerPortal.getMyFinancialSummary.useQuery();
  const { data: transactions, isLoading: transactionsLoading } =
    trpc.customerPortal.getMyTransactions.useQuery({ limit: 50 });
  const { data: invoices, isLoading: invoicesLoading } =
    trpc.customerPortal.getMyInvoices.useQuery();
  const _receiptQuery = trpc.customerPortal.getReceiptData.useQuery(
    { transactionId: receiptTxId! },
    { enabled: !!receiptTxId }
  );

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (activeTab === "all") return transactions;
    if (activeTab === "credit") {
      return transactions.filter(
        (tx: any) =>
          tx.transactionType === "payment" ||
          tx.transactionType === "credit" ||
          tx.transactionType === "refund"
      );
    }
    return transactions.filter(
      (tx: any) =>
        tx.transactionType === "charge" ||
        tx.transactionType === "debit" ||
        tx.transactionType === "invoice"
    );
  }, [transactions, activeTab]);

  const unpaidInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter(
      (inv: any) =>
        inv.status === "unpaid" ||
        inv.status === "pending" ||
        inv.status === "overdue"
    );
  }, [invoices]);

  const totalPaid = summary?.totalPaid ?? 0;

  const isCredit = (type: string) =>
    type === "payment" || type === "credit" || type === "refund";

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `$${Math.abs(num).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(
      language === "ku" || language === "ar" ? "ar-IQ" : "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    );
  };

  const handleDownloadReceipt = (txId: number) => {
    setReceiptTxId(txId);
  };

  const tabs: { value: FilterTab; label: string }[] = [
    { value: "all", label: t("portal.all") },
    {
      value: "credit",
      label:
        language === "ku"
          ? "واردە"
          : language === "ar"
          ? "وارد"
          : language === "zh"
          ? "收入"
          : "Credits",
    },
    {
      value: "debit",
      label:
        language === "ku"
          ? "دەرچووە"
          : language === "ar"
          ? "صادر"
          : language === "zh"
          ? "支出"
          : "Debits",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.07 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: spring },
  };

  const summaryStats = [
    {
      icon: TrendingUp,
      label: t("portal.totalPaid"),
      value: formatCurrency(totalPaid),
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: isDark ? "bg-emerald-500/15" : "bg-emerald-50",
    },
    {
      icon: CreditCard,
      label:
        language === "ku"
          ? "کۆی قەرز"
          : language === "ar"
          ? "إجمالي المدين"
          : "Total Debit",
      value: formatCurrency((summary as any)?.totalCharged ?? summary?.totalPaid ?? 0),
      accent: "text-red-500 dark:text-red-400",
      bg: isDark ? "bg-red-500/15" : "bg-red-50",
    },
    {
      icon: AlertCircle,
      label: t("portal.pending"),
      value: String(unpaidInvoices.length),
      accent: "text-amber-600 dark:text-amber-400",
      bg: isDark ? "bg-amber-500/15" : "bg-amber-50",
    },
    {
      icon: FileText,
      label:
        language === "ku"
          ? "پارەدراو"
          : language === "ar"
          ? "مدفوع"
          : "Paid",
      value: formatCurrency(summary?.totalPaid ?? 0),
      accent: "text-indigo-600 dark:text-indigo-400",
      bg: isDark ? "bg-indigo-500/15" : "bg-indigo-50",
    },
  ];

  return (
    <ModernPortalLayout>
      <div
        className={cn(
          "min-h-screen pb-24",
          isDark ? "bg-zinc-950" : "bg-amber-50/50",
          isRTL && "rtl"
        )}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
          {/* ── Balance Hero Pill ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="flex flex-col items-center pt-2"
          >
            <div
              className={cn(
                "inline-flex items-center gap-3 px-8 py-5 rounded-full border-2",
                isDark
                  ? "bg-indigo-950/60 border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500 border-indigo-600/30 shadow-[6px_6px_0px_rgba(0,0,0,0.12)]"
              )}
            >
              <Wallet
                className={cn(
                  "w-7 h-7",
                  isDark ? "text-indigo-400" : "text-white/80"
                )}
              />
              {summaryLoading ? (
                <Skeleton className="h-10 w-36 rounded-full" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-3xl font-black tabular-nums tracking-tight",
                      isDark ? "text-white" : "text-white"
                    )}
                  >
                    ${(summary?.balanceUsd ?? 0).toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold uppercase tracking-wider",
                      isDark ? "text-indigo-300/60" : "text-white/60"
                    )}
                  >
                    USD
                  </span>
                </div>
              )}
            </div>
            <p
              className={cn(
                "text-xs font-medium mt-3",
                isDark ? "text-zinc-500" : "text-zinc-400"
              )}
            >
              {t("portal.totalBalance")}
            </p>
            {!summaryLoading && (summary?.balanceIqd ?? 0) !== 0 && (
              <p
                className={cn(
                  "text-xs tabular-nums mt-1",
                  isDark ? "text-zinc-600" : "text-zinc-400"
                )}
              >
                {new Intl.NumberFormat("en-US").format(
                  Number(summary?.balanceIqd ?? 0)
                )}{" "}
                IQD
              </p>
            )}
          </motion.div>

          {/* ── 2x2 Summary Grid ── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-3"
          >
            {summaryLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-24 rounded-xl"
                  />
                ))
              : summaryStats.map((stat) => (
                  <motion.div
                    key={stat.label}
                    variants={itemVariants}
                    className={cn(
                      isDark ? cardBaseDark : cardBase,
                      "p-4 transition-transform hover:-translate-y-0.5",
                      isDark ? "bg-zinc-900" : "bg-white"
                    )}
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center mb-2",
                        stat.bg
                      )}
                    >
                      <stat.icon className={cn("w-4.5 h-4.5", stat.accent)} />
                    </div>
                    <p
                      className={cn(
                        "text-lg font-black tabular-nums",
                        isDark ? "text-white" : "text-zinc-900"
                      )}
                    >
                      {stat.value}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] font-medium leading-tight mt-0.5",
                        isDark ? "text-zinc-500" : "text-zinc-400"
                      )}
                    >
                      {stat.label}
                    </p>
                  </motion.div>
                ))}
          </motion.div>

          {/* ── Filter Chips ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...spring }}
            className="flex gap-2"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-bold border-2 transition-all duration-200",
                  activeTab === tab.value
                    ? isDark
                      ? "bg-yellow-400 text-black border-yellow-400 shadow-[3px_3px_0px_rgba(250,204,21,0.3)]"
                      : "bg-yellow-400 text-black border-yellow-500 shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                    : isDark
                    ? "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                )}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>

          {/* ── Transaction List ── */}
          <div>
            <h2
              className={cn(
                "text-lg font-black mb-3",
                isDark ? "text-white" : "text-zinc-900"
              )}
            >
              {t("portal.paymentHistory")}
            </h2>

            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredTransactions.length > 0 ? (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                <AnimatePresence mode="popLayout">
                  {filteredTransactions.map((tx: any) => {
                    const credit = isCredit(tx.transactionType);
                    return (
                      <motion.div
                        key={tx.id}
                        variants={itemVariants}
                        exit={{ opacity: 0, x: isRTL ? 30 : -30 }}
                        layout
                        className={cn(
                          isDark ? cardBaseDark : cardBase,
                          "p-4 transition-transform hover:-translate-y-0.5",
                          isDark ? "bg-zinc-900" : "bg-white"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Icon */}
                          <div
                            className={cn(
                              "w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border-2",
                              credit
                                ? isDark
                                  ? "bg-emerald-500/10 border-emerald-500/30"
                                  : "bg-emerald-50 border-emerald-200"
                                : isDark
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-red-50 border-red-200"
                            )}
                          >
                            {credit ? (
                              <ArrowDownLeft
                                className={cn(
                                  "w-5 h-5",
                                  isDark
                                    ? "text-emerald-400"
                                    : "text-emerald-600"
                                )}
                              />
                            ) : (
                              <ArrowUpRight
                                className={cn(
                                  "w-5 h-5",
                                  isDark ? "text-red-400" : "text-red-500"
                                )}
                              />
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-bold truncate",
                                isDark ? "text-white" : "text-zinc-900"
                              )}
                            >
                              {tx.description ||
                                tx.transactionNumber ||
                                (language === "ku" ? "مامەڵە" : "Transaction")}
                            </p>
                            <p
                              className={cn(
                                "text-xs mt-0.5",
                                isDark ? "text-zinc-600" : "text-zinc-400"
                              )}
                            >
                              {formatDate(tx.createdAt)}
                            </p>
                          </div>

                          {/* Amount + Download */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "text-base font-black tabular-nums",
                                credit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-500 dark:text-red-400"
                              )}
                            >
                              {credit ? "+" : "-"}
                              {formatCurrency(tx.amountUsd)}
                            </span>
                            <button
                              onClick={() => handleDownloadReceipt(tx.id)}
                              className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all",
                                isDark
                                  ? "border-zinc-700 hover:border-indigo-500 hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400"
                                  : "border-zinc-200 hover:border-indigo-400 hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600"
                              )}
                              title={t("portal.downloadInvoice")}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring}
                className={cn(
                  isDark ? cardBaseDark : cardBase,
                  "p-10 text-center",
                  isDark ? "bg-zinc-900" : "bg-white"
                )}
              >
                <Receipt
                  className={cn(
                    "w-14 h-14 mx-auto mb-3",
                    isDark ? "text-zinc-700" : "text-zinc-300"
                  )}
                />
                <h3
                  className={cn(
                    "font-black text-lg mb-1",
                    isDark ? "text-white" : "text-zinc-900"
                  )}
                >
                  {t("portal.noTransactions")}
                </h3>
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-zinc-600" : "text-zinc-400"
                  )}
                >
                  {language === "ku"
                    ? "مامەڵەکانت لێرە دەردەکەون"
                    : "Your transactions will appear here"}
                </p>
              </motion.div>
            )}
          </div>

          {/* ── Unpaid Invoices ── */}
          {!invoicesLoading && unpaidInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, ...spring }}
            >
              <div className="flex items-center gap-2 mb-3">
                <h2
                  className={cn(
                    "text-lg font-black",
                    isDark ? "text-white" : "text-zinc-900"
                  )}
                >
                  {t("portal.unpaidInvoices")}
                </h2>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-black border-2",
                    isDark
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-red-50 text-red-600 border-red-200"
                  )}
                >
                  {unpaidInvoices.length}
                </span>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {unpaidInvoices.map((inv: any) => (
                  <motion.div
                    key={inv.id}
                    variants={itemVariants}
                    className={cn(
                      isDark ? cardBaseDark : cardBase,
                      "p-4 transition-transform hover:-translate-y-0.5",
                      isDark ? "bg-zinc-900" : "bg-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border-2",
                          isDark
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-amber-50 border-amber-200"
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            "w-5 h-5",
                            isDark ? "text-amber-400" : "text-amber-600"
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-bold",
                            isDark ? "text-white" : "text-zinc-900"
                          )}
                        >
                          {inv.invoiceNumber}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-0.5",
                            isDark ? "text-zinc-600" : "text-zinc-400"
                          )}
                        >
                          {inv.dueDate
                            ? formatDate(inv.dueDate)
                            : inv.issuedAt
                            ? formatDate(inv.issuedAt)
                            : ""}
                        </p>
                      </div>

                      <div className="text-end shrink-0">
                        <p className="text-base font-black tabular-nums text-red-500 dark:text-red-400">
                          ${Number(inv.totalUsd || 0).toFixed(2)}
                        </p>
                        <span
                          className={cn(
                            "inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-black border",
                            inv.status === "overdue"
                              ? isDark
                                ? "bg-red-500/15 text-red-400 border-red-500/40"
                                : "bg-red-100 text-red-700 border-red-300"
                              : isDark
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                              : "bg-amber-100 text-amber-700 border-amber-300"
                          )}
                        >
                          {inv.status === "overdue"
                            ? language === "ku"
                              ? "دواکەوتوو"
                              : "Overdue"
                            : t("portal.pending")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </ModernPortalLayout>
  );
}
